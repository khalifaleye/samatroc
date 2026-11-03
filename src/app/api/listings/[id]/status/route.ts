import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { listingStatusSchema } from "@/lib/validators";
import { listingInclude, serializeListing, getPublicationFee } from "@/lib/serializers";

/** Changements de statut par le propriétaire : publier/désactiver/marquer échangée */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    const { id } = await params;
    const { status } = await readBody(req, listingStatusSchema);

    const listing = await db.listing.findUnique({ where: { id } });
    if (!listing) throw new ApiError(404, "Annonce introuvable");
    if (listing.userId !== session.id) throw new ApiError(403, "Action non autorisée");

    const allowed: Record<string, string[]> = {
      PUBLISHED: ["PUBLISHED", "DEACTIVATED", "EXCHANGED"],
      DEACTIVATED: ["PUBLISHED", "DEACTIVATED", "EXCHANGED"],
      EXCHANGED: ["EXCHANGED", "DEACTIVATED"],
      DRAFT: [],
      PENDING_PAYMENT: [],
      PENDING_MODERATION: [],
      REFUSED: [],
    };
    const from = allowed[listing.status] ?? [];
    if (!from.includes(status)) {
      throw new ApiError(
        409,
        "Transition de statut impossible. Une annonce publiée payante peut être désactivée, réactivée ou marquée comme échangée."
      );
    }

    const data: Record<string, unknown> = { status };
    if (status === "EXCHANGED") data.expiresAt = listing.expiresAt;
    if (status === "PUBLISHED" && !listing.publishedAt) data.publishedAt = new Date();

    await db.listing.update({ where: { id }, data });

    const updated = await db.listing.findUnique({ where: { id }, include: listingInclude });
    const fee = await getPublicationFee();
    return jsonOk({
      listing: updated ? serializeListing(updated, false, fee) : null,
      message:
        status === "EXCHANGED"
          ? "Félicitations ! Votre annonce est marquée comme échangée."
          : status === "DEACTIVATED"
            ? "Annonce désactivée"
            : "Annonce réactivée",
    });
  });
}
