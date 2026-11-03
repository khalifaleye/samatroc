import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";
import { listingInclude, serializeListing, getPublicationFee } from "@/lib/serializers";

/** Profil public d'un utilisateur + ses annonces publiées */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { id } = await params;
    const session = await getSessionUser();

    const user = await db.user.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!user) throw new ApiError(404, "Utilisateur introuvable");

    const listingsRaw = await db.listing.findMany({
      where: { userId: id, status: "PUBLISHED" },
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
      include: listingInclude,
    });

    const fee = await getPublicationFee();
    let favoriteIds = new Set<string>();
    if (session) {
      favoriteIds = new Set(
        (
          await db.favorite.findMany({
            where: { userId: session.id, listingId: { in: listingsRaw.map((l) => l.id) } },
            select: { listingId: true },
          })
        ).map((f) => f.listingId)
      );
    }

    return jsonOk({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        city: user.city,
        memberSince: user.createdAt.toISOString(),
        listingsCount: listingsRaw.length,
        // Le numéro n'est jamais exposé sans le choix de son propriétaire
        showPhone: user.profile?.showPhone ?? false,
        phone: user.profile?.showPhone ? user.phone : null,
        whatsappEnabled: user.profile?.whatsappEnabled ?? true,
      },
      listings: listingsRaw.map((l) => serializeListing(l, favoriteIds.has(l.id), fee)),
    });
  });
}
