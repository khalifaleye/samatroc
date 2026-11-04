import { NextRequest } from "next/server";
import type { AccountStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { mapSupabaseAuthError, splitFullName } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { handleRoute, readBody, ApiError, getClientIp, jsonOk } from "@/lib/api-utils";
import { loginSchema } from "@/lib/validators";
import { rateLimit, retryAfter } from "@/lib/rate-limit";

const STATUS_MESSAGES: Record<AccountStatus, string> = {
  ACTIVE: "",
  SUSPENDED:
    "Votre compte est suspendu. Contactez l'assistance SamaTroc pour plus d'informations.",
  BANNED:
    "Votre compte est banni. Contactez l'assistance SamaTroc pour plus d'informations.",
  DELETED: "Ce compte n'existe plus ou a été supprimé.",
};

/**
 * Connexion — déléguée à Supabase Auth (`signInWithPassword`).
 * • Le client serveur @supabase/ssr pose automatiquement les cookies de session
 *   (access + refresh tokens) lors du succès.
 * • Le profil applicatif est chargé via Prisma ; un compte non actif
 *   (SUSPENDED / BANNED / DELETED) est traité comme non connecté.
 * • Format de réponse identique à l'ancien flux : `{ user: { …, unreadNotifications, unreadMessages } }`.
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const input = await readBody(req, loginSchema);
    const ip = getClientIp(req);
    const limitKey = `login:${input.email}:${ip}`;

    if (!rateLimit(limitKey, 5, 15 * 60 * 1000)) {
      throw new ApiError(
        429,
        `Trop de tentatives de connexion. Réessayez dans ${Math.ceil(retryAfter(limitKey) / 60)} minute(s).`
      );
    }

    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      throw new ApiError(
        500,
        "Le service d'authentification n'est pas disponible. Veuillez réessayer plus tard."
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    // Anti-énumération : tout échec d'authentification → même message générique
    // (sauf e-mail non confirmé / limite de débit, traduits par le mapper).
    if (error || !data.user || !data.session) {
      const mapped = mapSupabaseAuthError(error, 401, "E-mail ou mot de passe incorrect");
      throw new ApiError(mapped.status, mapped.message, mapped.fields);
    }

    const profile = await db.profile.findUnique({ where: { id: data.user.id } });
    if (!profile) {
      throw new ApiError(401, "E-mail ou mot de passe incorrect");
    }

    if (profile.accountStatus !== "ACTIVE") {
      // Purge tout cookie de session fraîchement posé par signInWithPassword
      await supabase.auth.signOut();
      throw new ApiError(403, STATUS_MESSAGES[profile.accountStatus]);
    }

    const [unreadNotifications, unreadMessages] = await Promise.all([
      db.notification.count({ where: { userId: profile.id, isRead: false } }),
      db.message.count({
        where: {
          isRead: false,
          senderId: { not: profile.id },
          conversation: { participants: { some: { userId: profile.id } } },
        },
      }),
    ]);

    const { firstName, lastName } = splitFullName(profile.fullName);

    return jsonOk({
      user: {
        id: profile.id,
        email: profile.email,
        firstName,
        lastName,
        phone: profile.phone,
        avatarUrl: profile.avatarUrl,
        city: profile.city,
        role: profile.role,
        status: profile.accountStatus,
        emailVerified: Boolean(data.user.email_confirmed_at),
        phoneVerified: profile.phoneVerified,
        createdAt: profile.createdAt.toISOString(),
        profile: {
          bio: null,
          quartier: profile.neighborhood,
          showPhone: profile.showPhone,
          whatsappEnabled: true,
        },
        unreadNotifications,
        unreadMessages,
      },
    });
  });
}
