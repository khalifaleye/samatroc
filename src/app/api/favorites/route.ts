import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";
import {
  listingInclude,
  serializeListing,
  getPublicationFee,
  loadDesiredCategoryNames,
} from "@/lib/serializers";

/** Mes favoris */
export async function GET() {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");

    const favorites = await db.favorite.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      include: { listing: { include: listingInclude } },
    });

    const fee = await getPublicationFee();
    const listings = favorites
      .filter((f) => f.listing)
      .map((f) => f.listing);
    const desiredCategoryNames = await loadDesiredCategoryNames(listings);

    return jsonOk({
      listings: listings.map((l) => serializeListing(l, true, fee, desiredCategoryNames)),
    });
  });
}
