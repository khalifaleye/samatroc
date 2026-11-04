import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, splitFullName } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";
import {
  listingInclude,
  serializeListing,
  getPublicationFee,
  loadDesiredCategoryNames,
} from "@/lib/serializers";
import { isUuid } from "@/app/api/_shared/domain";

/**
 * Profil public d'un utilisateur — bascule Supabase : `db.user` + relation
 * `profile` → une seule table `profiles` (`fullName` → firstName/lastName
 * via splitFullName). Les colonnes `bio`/`whatsappEnabled` ont disparu :
 * `whatsappEnabled` est renvoyé à sa valeur historique (true) et le numéro
 * n'est toujours exposé que si `show_phone` est activé. Les annonces sont
 * sérialisées via les helpers de la vague listings (`serializeListing` +
 * `loadDesiredCategoryNames`) ; un identifiant non uuid renvoie 404 (les
 * cibles Supabase sont des uuid, cf. convention de la vague listings).
 */

/** Profil public d'un utilisateur + ses annonces publiées */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Utilisateur introuvable");
    const session = await getSessionUser();

    const profile = await db.profile.findUnique({ where: { id } });
    if (!profile) throw new ApiError(404, "Utilisateur introuvable");

    const listingsRaw = await db.listing.findMany({
      where: { userId: id, status: "PUBLISHED" },
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
      include: listingInclude,
    });

    const [fee, desiredNames] = await Promise.all([
      getPublicationFee(),
      loadDesiredCategoryNames(listingsRaw),
    ]);

    let favoriteIds = new Set<string>();
    if (session && listingsRaw.length > 0) {
      favoriteIds = new Set(
        (
          await db.favorite.findMany({
            where: { userId: session.id, listingId: { in: listingsRaw.map((l) => l.id) } },
            select: { listingId: true },
          })
        ).map((f) => f.listingId)
      );
    }

    const { firstName, lastName } = splitFullName(profile.fullName);

    return jsonOk({
      user: {
        id: profile.id,
        firstName,
        lastName,
        avatarUrl: profile.avatarUrl,
        city: profile.city,
        memberSince: profile.createdAt.toISOString(),
        listingsCount: listingsRaw.length,
        // Le numéro n'est jamais exposé sans le choix de son propriétaire
        showPhone: profile.showPhone,
        phone: profile.showPhone ? profile.phone : null,
        whatsappEnabled: true, // colonne supprimée du schéma — valeur historique
      },
      listings: listingsRaw.map((l) =>
        serializeListing(l, favoriteIds.has(l.id), fee, desiredNames)
      ),
    });
  });
}
