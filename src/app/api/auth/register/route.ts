import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  buildFullName,
  loadProfileAfterSignUp,
  mapSupabaseAuthError,
  splitFullName,
} from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { handleRoute, readBody, ApiError, getClientIp, jsonOk } from "@/lib/api-utils";
import { registerSchema } from "@/lib/validators";
import { rateLimit, retryAfter } from "@/lib/rate-limit";

/**
 * Inscription — déléguée à Supabase Auth.
 * • `supabase.auth.signUp` crée l'utilisateur dans auth.users ; le trigger SQL
 *   `handle_new_user` crée automatiquement le profil (id, full_name, username,
 *   email) via `options.data.full_name`.
 * • Le serveur complète ensuite le profil avec téléphone / ville (non gérés
 *   par le trigger).
 * • Si la confirmation d'e-mail est activée dans le projet Supabase, aucune
 *   session n'est ouverte ici (Supabase envoie le lien de confirmation) ;
 *   sinon la session est posée automatiquement via les cookies @supabase/ssr.
 * • La réponse conserve le format historique : `{ user, devVerifyToken }`.
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const ip = getClientIp(req);
    if (!rateLimit(`register:${ip}`, 3, 60 * 60 * 1000)) {
      throw new ApiError(
        429,
        `Trop d'inscriptions depuis cette adresse. Réessayez dans ${retryAfter(`register:${ip}`)} secondes.`
      );
    }

    const input = await readBody(req, registerSchema);

    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      throw new ApiError(
        500,
        "Le service d'authentification n'est pas disponible. Veuillez réessayer plus tard."
      );
    }

    const existing = await db.profile.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ApiError(409, "Un compte existe déjà avec cette adresse e-mail", {
        email: "Cette adresse e-mail est déjà utilisée",
      });
    }

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: buildFullName(input.firstName, input.lastName),
          first_name: input.firstName,
          last_name: input.lastName,
          phone: input.phone || null,
          city: input.city || null,
        },
      },
    });

    if (error || !data.user) {
      const mapped = mapSupabaseAuthError(
        error,
        400,
        "Inscription impossible. Vérifiez vos informations et réessayez."
      );
      throw new ApiError(mapped.status, mapped.message, mapped.fields);
    }

    const authUser = data.user;
    const profile = await loadProfileAfterSignUp(authUser.id);
    if (!profile) {
      throw new ApiError(
        500,
        "Votre compte a été créé mais son profil n'est pas encore disponible. Réessayez de vous connecter dans quelques instants."
      );
    }

    // Le trigger ne renseigne que full_name / username / email : compléter
    // téléphone et ville collectés dans le formulaire d'inscription.
    const patch: { phone?: string; city?: string } = {};
    if (input.phone) patch.phone = input.phone;
    if (input.city) patch.city = input.city;
    const fullProfile =
      Object.keys(patch).length > 0
        ? await db.profile.update({ where: { id: profile.id }, data: patch })
        : profile;

    const { firstName, lastName } = splitFullName(fullProfile.fullName);

    return jsonOk({
      user: {
        id: fullProfile.id,
        email: fullProfile.email,
        firstName,
        lastName,
        phone: fullProfile.phone,
        avatarUrl: fullProfile.avatarUrl,
        city: fullProfile.city,
        role: fullProfile.role,
        status: fullProfile.accountStatus,
        emailVerified: Boolean(authUser.email_confirmed_at),
        phoneVerified: fullProfile.phoneVerified,
        createdAt: fullProfile.createdAt.toISOString(),
        profile: {
          bio: null,
          quartier: fullProfile.neighborhood,
          showPhone: fullProfile.showPhone,
          whatsappEnabled: true,
        },
        unreadNotifications: 0,
        unreadMessages: 0,
      },
      // La vérification d'e-mail est désormais gérée par Supabase Auth
      // (e-mail automatique) : plus de jeton de démonstration.
      devVerifyToken: null,
    });
  });
}
