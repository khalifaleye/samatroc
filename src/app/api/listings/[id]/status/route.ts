import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { listingStatusSchema } from "@/lib/validators";
import { listingInclude, serializeListing, getPublicationFee, loadDesiredCategoryNames } from "@/lib/serializers";
import { listingStatusToDb } from "@/lib/constants";

/** Les ids d'annonce sont des uuid en base (PostgreSQL Supabase). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Changements de statut par le propriétaire : publier/désactiver/marquer échangée.
 * L'UI envoie le vocabulaire historique (« DEACTIVATED ») — normalisé vers
 * l'enum Supabase (« INACTIVE ») via listingStatusToDb.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    const { id } = await params;
    if (!UUID_RE.test(id)) throw new ApiError(404, "Annonce introuvable");
    const { status } = await readBody(req, listingStatusSchema);

    const listing = await db.listing.findUnique({ where: { id } });
    if (!listing) throw new ApiError(404, "Annonce introuvable");
    if (listing.userId !== session.id) throw new ApiError(403, "Action non autorisée");

    const target = listingStatusToDb(status);

    const allowed: Record<string, string[]> = {
      PUBLISHED: ["PUBLISHED", "INACTIVE", "EXCHANGED"],
      INACTIVE: ["PUBLISHED", "INACTIVE", "EXCHANGED"],
      EXCHANGED: ["EXCHANGED", "INACTIVE"],
      DRAFT: [],
      PENDING_PAYMENT: [],
      PENDING_REVIEW: [],
      REJECTED: [],
    };
    const from = allowed[listing.status] ?? [];
    if (!from.includes(target)) {
      throw new ApiError(
        409,
        "Transition de statut impossible. Une annonce publiée payante peut être désactivée, réactivée ou marquée comme échangée."
      );
    }

    const data: Record<string, unknown> = { status: target };
    if (target === "EXCHANGED") data.expiresAt = listing.expiresAt;
    if (target === "PUBLISHED" && !listing.publishedAt) data.publishedAt = new Date();

    await db.listing.update({ where: { id }, data });

    const updated = await db.listing.findUnique({ where: { id }, include: listingInclude });
    const fee = await getPublicationFee();
    const desiredCategoryNames = updated ? await loadDesiredCategoryNames([updated]) : undefined;
    return jsonOk({
      listing: updated ? serializeListing(updated, false, fee, desiredCategoryNames) : null,
      message:
        target === "EXCHANGED"
          ? "Félicitations ! Votre annonce est marquée comme échangée."
          : target === "INACTIVE"
            ? "Annonce désactivée"
            : "Annonce réactivée",
    });
  });
}
