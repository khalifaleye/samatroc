import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, jsonOk } from "@/lib/api-utils";
import {
  listingInclude,
  serializeListing,
  getPublicationFee,
  loadDesiredCategoryNames,
} from "@/lib/serializers";

/** Mes annonces (espace personnel) */
export async function GET() {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) return jsonOk({ error: "Connexion requise" }, 401);

    const listingsRaw = await db.listing.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      include: listingInclude,
    });

    const fee = await getPublicationFee();
    const favoriteIds = new Set(
      (
        await db.favorite.findMany({
          where: { userId: session.id, listingId: { in: listingsRaw.map((l) => l.id) } },
          select: { listingId: true },
        })
      ).map((f) => f.listingId)
    );

    // wantedCategory (string) : résolution nom de catégorie depuis desired_category_id
    const desiredCategoryNames = await loadDesiredCategoryNames(listingsRaw);

    return jsonOk({
      listings: listingsRaw.map((l) =>
        serializeListing(l, favoriteIds.has(l.id), fee, desiredCategoryNames)
      ),
    });
  });
}
