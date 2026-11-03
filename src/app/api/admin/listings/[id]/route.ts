import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, readBody, requireAdmin, ApiError, jsonOk, logAdminAction } from "@/lib/api-utils";
import { adminListingActionSchema } from "@/lib/validators";
import { listingInclude, serializeListing, getPublicationFee } from "@/lib/serializers";

/** Modération d'une annonce : validation, refus, mise en avant, édition */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const input = await readBody(req, adminListingActionSchema);

    const listing = await db.listing.findUnique({ where: { id } });
    if (!listing) throw new ApiError(404, "Annonce introuvable");

    let message = "";
    const data: Record<string, unknown> = {};

    if (input.action === "publish") {
      if (!["PENDING_MODERATION", "REFUSED", "DEACTIVATED"].includes(listing.status)) {
        throw new ApiError(409, "Cette annonce n'attend pas de validation");
      }
      data.status = "PUBLISHED";
      data.refusalReason = null;
      if (!listing.publishedAt) data.publishedAt = new Date();
      message = "Annonce validée et publiée";
      await db.notification.create({
        data: {
          userId: listing.userId,
          type: "LISTING_PUBLISHED",
          title: "Annonce validée",
          body: `Votre annonce « ${listing.title} » a été validée par la modération et est maintenant en ligne.`,
          linkView: "my-listings",
        },
      });
    } else if (input.action === "refuse") {
      if (!input.reason) throw new ApiError(400, "Un motif de refus est requis", { reason: "Motif requis" });
      data.status = "REFUSED";
      data.refusalReason = input.reason;
      message = "Annonce refusée";
      await db.notification.create({
        data: {
          userId: listing.userId,
          type: "LISTING_REFUSED",
          title: "Annonce refusée",
          body: `Votre annonce « ${listing.title} » a été refusée. Motif : ${input.reason}`,
          linkView: "my-listings",
        },
      });
    } else if (input.action === "feature") {
      data.featured = true;
      message = "Annonce mise en avant";
    } else if (input.action === "unfeature") {
      data.featured = false;
      message = "Mise en avant retirée";
    }

    // Édition administrative
    if (input.edits) {
      if (input.edits.title !== undefined) data.title = input.edits.title;
      if (input.edits.description !== undefined) data.description = input.edits.description;
      if (input.edits.city !== undefined) data.city = input.edits.city;
      if (input.edits.wantedText !== undefined) data.wantedText = input.edits.wantedText;
    }

    await db.listing.update({ where: { id }, data });
    await logAdminAction(
      admin.id,
      `LISTING_${input.action.toUpperCase()}`,
      "LISTING",
      id,
      input.reason ?? input.edits ? JSON.stringify({ reason: input.reason, edits: input.edits }) : undefined
    );

    const updated = await db.listing.findUnique({ where: { id }, include: listingInclude });
    const fee = await getPublicationFee();
    return jsonOk({ listing: updated ? serializeListing(updated, false, fee) : null, message });
  });
}

/** Suppression administrative */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const listing = await db.listing.findUnique({ where: { id } });
    if (!listing) throw new ApiError(404, "Annonce introuvable");

    await db.listing.delete({ where: { id } });
    await logAdminAction(admin.id, "LISTING_DELETE", "LISTING", id, listing.title);
    return jsonOk({ ok: true, message: "Annonce supprimée" });
  });
}
