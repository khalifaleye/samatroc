import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";

/** Les ids d'annonce sont des uuid en base (PostgreSQL Supabase). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ajout / retrait des favoris (toggle) */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connectez-vous pour gérer vos favoris");
    const { id } = await params;
    if (!UUID_RE.test(id)) throw new ApiError(404, "Annonce introuvable");

    const listing = await db.listing.findUnique({ where: { id } });
    if (!listing) throw new ApiError(404, "Annonce introuvable");

    const existing = await db.favorite.findUnique({
      where: { userId_listingId: { userId: session.id, listingId: id } },
    });

    if (existing) {
      await db.favorite.delete({ where: { id: existing.id } });
      return jsonOk({ isFavorite: false });
    }

    await db.favorite.create({ data: { userId: session.id, listingId: id } });
    return jsonOk({ isFavorite: true });
  });
}
