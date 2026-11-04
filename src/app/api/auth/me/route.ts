import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, jsonOk } from "@/lib/api-utils";

/**
 * Retourne l'utilisateur connecté avec ses compteurs, ou `{ user: null }`.
 * `getSessionUser()` combine l'utilisateur Supabase Auth et le profil Prisma
 * (`profiles`) et renvoie null pour tout compte non actif (SUSPENDED, BANNED,
 * DELETED). Format de réponse identique à l'ancien flux.
 */
export async function GET() {
  return handleRoute(async () => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return jsonOk({ user: null });

    const [unreadNotifications, unreadMessages] = await Promise.all([
      db.notification.count({ where: { userId: sessionUser.id, isRead: false } }),
      db.message.count({
        where: {
          isRead: false,
          senderId: { not: sessionUser.id },
          conversation: { participants: { some: { userId: sessionUser.id } } },
        },
      }),
    ]);

    return jsonOk({
      user: {
        id: sessionUser.id,
        email: sessionUser.email,
        firstName: sessionUser.firstName,
        lastName: sessionUser.lastName,
        phone: sessionUser.phone,
        avatarUrl: sessionUser.avatarUrl,
        city: sessionUser.city,
        role: sessionUser.role,
        status: sessionUser.status,
        emailVerified: sessionUser.emailVerified,
        phoneVerified: sessionUser.phoneVerified,
        createdAt: sessionUser.createdAt.toISOString(),
        profile: {
          bio: null,
          quartier: sessionUser.neighborhood,
          showPhone: sessionUser.showPhone,
          whatsappEnabled: true,
        },
        unreadNotifications,
        unreadMessages,
      },
    });
  });
}
