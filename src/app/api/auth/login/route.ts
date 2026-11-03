import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { handleRoute, readBody, ApiError, getClientIp, jsonOk } from "@/lib/api-utils";
import { loginSchema } from "@/lib/validators";
import { rateLimit, retryAfter } from "@/lib/rate-limit";

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

    const user = await db.user.findUnique({
      where: { email: input.email },
      include: { profile: true },
    });

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new ApiError(401, "E-mail ou mot de passe incorrect");
    }

    if (user.status === "SUSPENDED") {
      throw new ApiError(
        403,
        "Votre compte est suspendu. Contactez l'assistance SamaTroc pour plus d'informations."
      );
    }

    await createSession(user.id);

    const [unreadNotifications, unreadMessages] = await Promise.all([
      db.notification.count({ where: { userId: user.id, readAt: null } }),
      db.message.count({
        where: {
          readAt: null,
          senderId: { not: user.id },
          conversation: {
            OR: [{ userAId: user.id }, { userBId: user.id }],
          },
        },
      }),
    ]);

    return jsonOk({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        city: user.city,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        createdAt: user.createdAt.toISOString(),
        profile: user.profile
          ? {
              bio: user.profile.bio,
              quartier: user.profile.quartier,
              showPhone: user.profile.showPhone,
              whatsappEnabled: user.profile.whatsappEnabled,
            }
          : null,
        unreadNotifications,
        unreadMessages,
      },
    });
  });
}
