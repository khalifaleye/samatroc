import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, jsonOk } from "@/lib/api-utils";

/** Retourne l'utilisateur connecté avec ses compteurs, ou null */
export async function GET() {
  return handleRoute(async () => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return jsonOk({ user: null });

    const user = await db.user.findUnique({
      where: { id: sessionUser.id },
      include: { profile: true },
    });
    if (!user || user.status === "SUSPENDED") return jsonOk({ user: null });

    const [unreadNotifications, unreadMessages] = await Promise.all([
      db.notification.count({ where: { userId: user.id, readAt: null } }),
      db.message.count({
        where: {
          readAt: null,
          senderId: { not: user.id },
          conversation: { OR: [{ userAId: user.id }, { userBId: user.id }] },
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
