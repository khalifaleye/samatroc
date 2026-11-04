import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, jsonOk } from "@/lib/api-utils";
import { proposalStatusToApi } from "@/lib/constants";
import {
  listingInclude,
  serializeListing,
  getPublicationFee,
  loadDesiredCategoryNames,
} from "@/lib/serializers";
import { profileBrief } from "@/app/api/_shared/domain";

/**
 * Indicateurs du tableau de bord utilisateur — bascule Supabase (tâche 5-c) :
 * • statuts annonces traduits vers le vocabulaire historique des vues via
 *   `serializeListing` (PENDING_REVIEW → PENDING_MODERATION…) ;
 * • conversations : `userAId/userBId` → `conversation_participants` ;
 * • messages/notifications : `readAt: null` → `isRead: false` ;
 * • propositions : destinataire = colonne `ownerId`, statuts exposés en
 *   vocabulaire legacy (DISCUSSING/REFUSED) via `proposalStatusToApi` ;
 * • `firstName`/`lastName` → `fullName` via splitFullName (profileBrief).
 * `recentProposals` expose en plus `owner` (la vue dashboard y accède pour
 * les propositions envoyées — absent de l'ancien JSON).
 */
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
        where: { userId, status: { in: ["DRAFT", "PENDING_PAYMENT", "PENDING_REVIEW", "REJECTED"] } },
      }),
      db.exchangeProposal.count({ where: { ownerId: userId, status: "PENDING" } }),
      db.exchangeProposal.count({ where: { proposerId: userId, status: "PENDING" } }),
      db.exchangeProposal.count({
        where: {
          status: "COMPLETED",
          OR: [{ proposerId: userId }, { ownerId: userId }],
        },
      }),
      db.favorite.count({ where: { userId } }),
      db.message.count({
        where: {
          isRead: false,
          senderId: { not: userId },
          conversation: { participants: { some: { userId } } },
        },
      }),
      db.notification.count({ where: { userId, isRead: false } }),
      db.listing.findMany({
        where: { userId, status: { in: ["PUBLISHED", "PENDING_REVIEW", "PENDING_PAYMENT"] } },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: listingInclude,
      }),
      db.exchangeProposal.findMany({
        where: { OR: [{ proposerId: userId }, { ownerId: userId }] },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: {
          listing: { include: listingInclude },
          proposer: { select: { id: true, fullName: true, avatarUrl: true } },
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

    // Noms des catégories recherchées (wantedCategory) — un seul lot pour
    // toutes les annonces sérialisées (helpers de la vague listings).
    const desiredNames = await loadDesiredCategoryNames(myActiveListingsRaw);

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
        serializeListing(l, favoriteIds.has(l.id), fee, desiredNames)
      ),
      recentProposals: recentProposalsRaw.map((p) => ({
        id: p.id,
        status: proposalStatusToApi(p.status),
        message: p.message,
        createdAt: p.createdAt.toISOString(),
        direction: (p.proposerId === userId ? "sent" : "received") as "sent" | "received",
        listing: {
          id: p.listing.id,
          title: p.listing.title,
          images: p.listing.images.map((i) => ({ url: i.imageUrl, isPrimary: i.isPrimary })),
        },
        proposer: profileBrief(p.proposer),
        owner: profileBrief(p.listing.user),
      })),
      recentNotifications: recentNotificationsRaw.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.message,
        readAt: n.isRead ? n.createdAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  });
}
