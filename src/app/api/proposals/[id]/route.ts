import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { proposalActionSchema } from "@/lib/validators";
import { listingInclude, serializeListing, getPublicationFee } from "@/lib/serializers";

/**
 * Réponse à une proposition d'échange :
 * accept / refuse / discuss / counter (propriétaire) — cancel (proposant) — complete (les deux)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    const { id } = await params;
    const input = await readBody(req, proposalActionSchema);

    const proposal = await db.exchangeProposal.findUnique({
      where: { id },
      include: { listing: true },
    });
    if (!proposal) throw new ApiError(404, "Proposition introuvable");

    const isOwner = proposal.listing.userId === session.id;
    const isProposer = proposal.proposerId === session.id;
    if (!isOwner && !isProposer) throw new ApiError(403, "Action non autorisée");

    const data: Record<string, unknown> = {};
    let notifyUser = "";
    let notifTitle = "";
    let notifBody = "";

    if (input.action === "cancel") {
      if (!isProposer) throw new ApiError(403, "Seul l'auteur peut annuler sa proposition");
      if (!["PENDING", "DISCUSSING"].includes(proposal.status)) {
        throw new ApiError(409, "Cette proposition ne peut plus être annulée");
      }
      data.status = "CANCELLED";
      notifyUser = proposal.listing.userId;
      notifTitle = "Proposition annulée";
      notifBody = `${session.firstName} a annulé sa proposition pour « ${proposal.listing.title} ».`;
    } else if (input.action === "complete") {
      if (proposal.status !== "ACCEPTED") {
        throw new ApiError(409, "Seule une proposition acceptée peut être marquée comme réalisée");
      }
      if (!isOwner && !isProposer) throw new ApiError(403, "Action non autorisée");
      data.status = "COMPLETED";
      data.completedAt = new Date();
      await db.listing.update({
        where: { id: proposal.listingId },
        data: { status: "EXCHANGED" },
      });
      const otherUser = isOwner ? proposal.proposerId : proposal.listing.userId;
      notifyUser = otherUser;
      notifTitle = "Échange réalisé";
      notifBody = `L'échange pour « ${proposal.listing.title} » est marqué comme réalisé. Merci à vous !`;
    } else {
      if (!isOwner) {
        throw new ApiError(403, "Seul le propriétaire de l'annonce peut répondre à une proposition");
      }
      if (input.action === "accept") {
        if (proposal.status !== "PENDING" && proposal.status !== "DISCUSSING") {
          throw new ApiError(409, "Cette proposition a déjà été traitée");
        }
        data.status = "ACCEPTED";
        data.respondedAt = new Date();
        notifyUser = proposal.proposerId;
        notifTitle = "Proposition acceptée";
        notifBody = `Bonne nouvelle ! ${session.firstName} a accepté votre proposition pour « ${proposal.listing.title} ». Organisez la remise via la messagerie.`;
      } else if (input.action === "refuse") {
        if (proposal.status !== "PENDING" && proposal.status !== "DISCUSSING") {
          throw new ApiError(409, "Cette proposition a déjà été traitée");
        }
        data.status = "REFUSED";
        data.respondedAt = new Date();
        notifyUser = proposal.proposerId;
        notifTitle = "Proposition refusée";
        notifBody = `${session.firstName} a refusé votre proposition pour « ${proposal.listing.title} ».`;
      } else if (input.action === "discuss") {
        if (proposal.status !== "PENDING") {
          throw new ApiError(409, "Cette proposition a déjà été traitée");
        }
        data.status = "DISCUSSING";
        data.respondedAt = new Date();
        notifyUser = proposal.proposerId;
        notifTitle = "Demande de précisions";
        notifBody = `${session.firstName} souhaite discuter de votre proposition pour « ${proposal.listing.title} ». Poursuivez via la messagerie.`;
      } else if (input.action === "counter") {
        if (!["PENDING", "DISCUSSING"].includes(proposal.status)) {
          throw new ApiError(409, "Cette proposition a déjà été traitée");
        }
        if (!input.counterText) {
          throw new ApiError(400, "Précisez votre contre-proposition", {
            counterText: "Champ requis",
          });
        }
        data.status = "DISCUSSING";
        data.counterText = input.counterText;
        data.respondedAt = new Date();
        notifyUser = proposal.proposerId;
        notifTitle = "Contre-proposition reçue";
        notifBody = `${session.firstName} a formulé une contre-proposition pour « ${proposal.listing.title} » : consultez-la depuis vos propositions.`;
      }
    }

    await db.exchangeProposal.update({ where: { id }, data });

    if (notifyUser) {
      await db.notification.create({
        data: {
          userId: notifyUser,
          type: input.action === "complete" ? "PROPOSAL_COMPLETED" : `PROPOSAL_${input.action.toUpperCase()}`,
          title: notifTitle,
          body: notifBody,
          linkView: "proposals",
          linkParams: JSON.stringify({ tab: isOwner ? "sent" : "received" }),
        },
      });

      // Message système dans la conversation liée
      const conv = await db.conversation.findFirst({
        where: { listingId: proposal.listingId, OR: [{ userAId: proposal.proposerId }, { userBId: proposal.proposerId }] },
      });
      if (conv) {
        await db.message.create({
          data: {
            conversationId: conv.id,
            senderId: null,
            type: "SYSTEM",
            content: notifTitle + " — " + notifBody,
          },
        });
        await db.conversation.update({
          where: { id: conv.id },
          data: { lastMessageAt: new Date() },
        });
      }
    }

    const updated = await db.exchangeProposal.findUnique({
      where: { id },
      include: {
        listing: { include: listingInclude },
        offeredListing: { include: listingInclude },
        proposer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
    const fee = await getPublicationFee();

    const messageMap: Record<string, string> = {
      accept: "Proposition acceptée. Organisez la remise des objets via la messagerie.",
      refuse: "Proposition refusée.",
      discuss: "Discussion engagée avec le proposant.",
      counter: "Contre-proposition envoyée.",
      cancel: "Proposition annulée.",
      complete: "Échange marqué comme réalisé. Merci !",
    };

    return jsonOk({
      proposal: updated
        ? {
            id: updated.id,
            status: updated.status,
            message: updated.message,
            counterText: updated.counterText,
            offeredText: updated.offeredText,
            offeredImages: JSON.parse(updated.offeredImages ?? "[]") as string[],
            createdAt: updated.createdAt.toISOString(),
            respondedAt: updated.respondedAt?.toISOString() ?? null,
            completedAt: updated.completedAt?.toISOString() ?? null,
            listing: serializeListing(updated.listing, false, fee),
            offeredListing: updated.offeredListing
              ? serializeListing(updated.offeredListing, false, fee)
              : null,
            proposer: updated.proposer,
            direction: isOwner ? ("received" as const) : ("sent" as const),
          }
        : null,
      message: messageMap[input.action],
    });
  });
}
