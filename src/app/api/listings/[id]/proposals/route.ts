import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { proposalSchema } from "@/lib/validators";
import { listingInclude, serializeListing, getPublicationFee } from "@/lib/serializers";

/**
 * Création d'une proposition d'échange sur une annonce.
 * Effets : notification au propriétaire + conversation créée avec message système.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connectez-vous pour proposer un échange");
    const { id } = await params;
    const input = await proposalSchema.parseAsync(await req.json());

    const listing = await db.listing.findUnique({ where: { id } });
    if (!listing || listing.status !== "PUBLISHED") {
      throw new ApiError(404, "Cette annonce n'est pas disponible pour un échange");
    }
    if (listing.userId === session.id) {
      throw new ApiError(400, "Vous ne pouvez pas proposer un échange sur votre propre annonce");
    }

    // Pas de proposition en attente en double
    const duplicate = await db.exchangeProposal.findFirst({
      where: { listingId: id, proposerId: session.id, status: { in: ["PENDING", "DISCUSSING", "ACCEPTED"] } },
    });
    if (duplicate) {
      throw new ApiError(409, "Vous avez déjà une proposition en cours sur cette annonce");
    }

    // Vérifie l'annonce offerte si fournie
    if (input.offeredListingId) {
      const offered = await db.listing.findUnique({ where: { id: input.offeredListingId } });
      if (!offered || offered.userId !== session.id) {
        throw new ApiError(400, "L'annonce sélectionnée ne vous appartient pas");
      }
    }
    if (!input.offeredListingId && !input.offeredText) {
      throw new ApiError(400, "Décrivez l'objet que vous proposez ou sélectionnez une de vos annonces", {
        offeredText: "Champ requis",
      });
    }

    const proposal = await db.exchangeProposal.create({
      data: {
        listingId: id,
        proposerId: session.id,
        offeredListingId: input.offeredListingId || null,
        offeredText: input.offeredText || null,
        offeredImages: JSON.stringify(input.images ?? []),
        message: input.message || null,
        status: "PENDING",
      },
    });

    // Notification au propriétaire
    await db.notification.create({
      data: {
        userId: listing.userId,
        type: "PROPOSAL_RECEIVED",
        title: "Nouvelle proposition d'échange",
        body: `${session.firstName} propose un échange pour « ${listing.title} ». Répondez depuis votre espace.`,
        linkView: "proposals",
        linkParams: JSON.stringify({ tab: "received" }),
      },
    });

    // Conversation automatique (tri lexicographique des participants)
    const [userAId, userBId] = [session.id, listing.userId].sort();
    let conversation = await db.conversation.findUnique({
      where: {
        listingId_userAId_userBId: { listingId: id, userAId, userBId },
      },
    });
    if (!conversation) {
      conversation = await db.conversation.create({
        data: { listingId: id, userAId, userBId },
      });
    }
    await db.message.create({
      data: {
        conversationId: conversation.id,
        senderId: null,
        type: "SYSTEM",
        content: `Proposition d'échange envoyée par ${session.firstName} pour « ${listing.title} ».`,
      },
    });
    if (input.message) {
      await db.message.create({
        data: { conversationId: conversation.id, senderId: session.id, content: input.message },
      });
    }
    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    const full = await db.exchangeProposal.findUnique({
      where: { id: proposal.id },
      include: {
        listing: { include: listingInclude },
        offeredListing: { include: listingInclude },
        proposer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
    const fee = await getPublicationFee();

    return jsonOk(
      {
        proposal: full
          ? {
              id: full.id,
              status: full.status,
              message: full.message,
              counterText: full.counterText,
              offeredText: full.offeredText,
              offeredImages: JSON.parse(full.offeredImages ?? "[]") as string[],
              createdAt: full.createdAt.toISOString(),
              listing: serializeListing(full.listing, false, fee),
              offeredListing: full.offeredListing
                ? serializeListing(full.offeredListing, false, fee)
                : null,
              proposer: full.proposer,
              direction: "sent" as const,
            }
          : null,
        conversationId: conversation.id,
        message: "Votre proposition a été envoyée au propriétaire.",
      },
      201
    );
  });
}
