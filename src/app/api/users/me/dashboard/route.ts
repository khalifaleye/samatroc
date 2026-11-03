import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, jsonOk } from "@/lib/api-utils";
import { listingInclude, serializeListing, getPublicationFee } from "@/lib/serializers";

/** Indicateurs du tableau de bord utilisateur */
export async function GET() {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) return jsonOk({ error: "Non autorisé" }, 401);

    const userId = session.id;
    const fee = await getPublicationFee();

    const [
      activeListings,
      pendingListings,
      proposalsReceived,
      proposalsSent,
      completedExchanges,
      favoritesCount,
      unreadMessages,
      unreadNotifications,
      myActiveListingsRaw,
      recentProposalsRaw,
      recentNotificationsRaw,
    ] = await Promise.all([
      db.listing.count({ where: { userId, status: "PUBLISHED" } }),
      db.listing.count({
        where: { userId, status: { in: ["DRAFT", "PENDING_PAYMENT", "PENDING_MODERATION", "REFUSED"] } },
      }),
      db.exchangeProposal.count({ where: { listing: { userId }, status: "PENDING" } }),
      db.exchangeProposal.count({ where: { proposerId: userId, status: "PENDING" } }),
      db.exchangeProposal.count({
        where: {
          status: "COMPLETED",
          OR: [{ proposerId: userId }, { listing: { userId } }],
        },
      }),
      db.favorite.count({ where: { userId } }),
      db.message.count({
        where: {
          readAt: null,
          senderId: { not: userId },
          conversation: { OR: [{ userAId: userId }, { userBId: userId }] },
        },
      }),
      db.notification.count({ where: { userId, readAt: null } }),
      db.listing.findMany({
        where: { userId, status: { in: ["PUBLISHED", "PENDING_MODERATION", "PENDING_PAYMENT"] } },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: listingInclude,
      }),
      db.exchangeProposal.findMany({
        where: { OR: [{ proposerId: userId }, { listing: { userId } }] },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: {
          listing: { include: listingInclude },
          offeredListing: { include: listingInclude },
          proposer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      }),
      db.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    const favoriteIds = new Set(
      (
        await db.favorite.findMany({
          where: { userId, listingId: { in: myActiveListingsRaw.map((l) => l.id) } },
          select: { listingId: true },
        })
      ).map((f) => f.listingId)
    );

    return jsonOk({
      activeListings,
      pendingListings,
      proposalsReceived,
      proposalsSent,
      completedExchanges,
      favoritesCount,
      unreadMessages,
      unreadNotifications,
      myActiveListings: myActiveListingsRaw.map((l) =>
        serializeListing(l, favoriteIds.has(l.id), fee)
      ),
      recentProposals: recentProposalsRaw.map((p) => ({
        id: p.id,
        status: p.status,
        message: p.message,
        createdAt: p.createdAt.toISOString(),
        direction: p.proposerId === userId ? ("sent" as const) : ("received" as const),
        listing: {
          id: p.listing.id,
          title: p.listing.title,
          images: p.listing.images.map((i) => ({ url: i.url, isPrimary: i.isPrimary })),
        },
        proposer: p.proposer,
      })),
      recentNotifications: recentNotificationsRaw.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  });
}
