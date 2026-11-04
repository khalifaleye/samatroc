import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { proposalActionSchema } from "@/lib/validators";
import { getPublicationFee, loadDesiredCategoryNames } from "@/lib/serializers";
import {
  PROPOSAL_INCLUDE,
  findPairConversation,
  isUuid,
  proposalCardListings,
  serializeProposal,
} from "@/app/api/_shared/domain";

/**
 * Réponse à une proposition d'échange — bascule Supabase (tâche 5-c).
 *
 * Mapping des actions vers l'enum `ProposalStatus` Supabase
 * (PENDING/ACCEPTED/REJECTED/COUNTERED/CANCELLED/COMPLETED) :
 *   • accept  → ACCEPTED (depuis PENDING ou COUNTERED)
 *   • refuse  → REJECTED  (ex « REFUSED »)
 *   • discuss → COUNTERED (ex « DISCUSSING »)
 *   • counter → COUNTERED + la contre-proposition remplit
 *     `proposed_description` (la colonne `counterText` a disparu)
 *   • cancel  → CANCELLED (depuis PENDING ou COUNTERED)
 *   • complete→ COMPLETED (+ annonce liée passe à EXCHANGED)
 *
 * Les réponses JSON conservent le vocabulaire legacy (DISCUSSING/REFUSED)
 * via serializeProposal — les vues ne changent pas. Les notifications sont
 * écrites avec `message`/`relatedId` ; le message de suivi dans la
 * conversation liée est émis par l'auteur de l'action (l'ancien message
 * « système » sans expéditeur n'est plus possible : messages.sender_id est
 * NOT NULL dans le schéma Supabase).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    const { id } = await params;
    // Les cibles Supabase sont des uuid : un identifiant invalide ne doit pas
    // provoquer d'erreur SQL 500 (cf. convention de la vague listings).
    if (!isUuid(id)) throw new ApiError(404, "Proposition introuvable");
    const input = await readBody(req, proposalActionSchema);

    const proposal = await db.exchangeProposal.findUnique({
      where: { id },
      include: { listing: { select: { id: true, userId: true, title: true } } },
    });
    if (!proposal) throw new ApiError(404, "Proposition introuvable");

    const isOwner = proposal.listing.userId === session.id;
    const isProposer = proposal.proposerId === session.id;
    if (!isOwner && !isProposer) throw new ApiError(403, "Action non autorisée");

    const data: Prisma.ExchangeProposalUpdateInput = {};
    let notifyUser = "";
    let notifTitle = "";
    let notifBody = "";

    if (input.action === "cancel") {
      if (!isProposer) throw new ApiError(403, "Seul l'auteur peut annuler sa proposition");
      if (proposal.status !== "PENDING" && proposal.status !== "COUNTERED") {
        throw new ApiError(409, "Cette proposition ne peut plus être annulée");
      }
      data.status = "CANCELLED";
      notifyUser = proposal.ownerId;
      notifTitle = "Proposition annulée";
      notifBody = `${session.firstName} a annulé sa proposition pour « ${proposal.listing.title} ».`;
    } else if (input.action === "complete") {
      if (proposal.status !== "ACCEPTED") {
        throw new ApiError(409, "Seule une proposition acceptée peut être marquée comme réalisée");
      }
      data.status = "COMPLETED";
      await db.listing.update({
        where: { id: proposal.listingId },
        data: { status: "EXCHANGED" },
      });
      notifyUser = isOwner ? proposal.proposerId : proposal.ownerId;
      notifTitle = "Échange réalisé";
      notifBody = `L'échange pour « ${proposal.listing.title} » est marqué comme réalisé. Merci à vous !`;
    } else {
      if (!isOwner) {
        throw new ApiError(403, "Seul le propriétaire de l'annonce peut répondre à une proposition");
      }
      if (input.action === "accept") {
        if (proposal.status !== "PENDING" && proposal.status !== "COUNTERED") {
          throw new ApiError(409, "Cette proposition a déjà été traitée");
        }
        data.status = "ACCEPTED";
        notifyUser = proposal.proposerId;
        notifTitle = "Proposition acceptée";
        notifBody = `Bonne nouvelle ! ${session.firstName} a accepté votre proposition pour « ${proposal.listing.title} ». Organisez la remise via la messagerie.`;
      } else if (input.action === "refuse") {
        if (proposal.status !== "PENDING" && proposal.status !== "COUNTERED") {
          throw new ApiError(409, "Cette proposition a déjà été traitée");
        }
        data.status = "REJECTED";
        notifyUser = proposal.proposerId;
        notifTitle = "Proposition refusée";
        notifBody = `${session.firstName} a refusé votre proposition pour « ${proposal.listing.title} ».`;
      } else if (input.action === "discuss") {
        if (proposal.status !== "PENDING") {
          throw new ApiError(409, "Cette proposition a déjà été traitée");
        }
        data.status = "COUNTERED";
        notifyUser = proposal.proposerId;
        notifTitle = "Demande de précisions";
        notifBody = `${session.firstName} souhaite discuter de votre proposition pour « ${proposal.listing.title} ». Poursuivez via la messagerie.`;
      } else if (input.action === "counter") {
        if (proposal.status !== "PENDING" && proposal.status !== "COUNTERED") {
          throw new ApiError(409, "Cette proposition a déjà été traitée");
        }
        if (!input.counterText) {
          throw new ApiError(400, "Précisez votre contre-proposition", {
            counterText: "Champ requis",
          });
        }
        data.status = "COUNTERED";
        // La contre-proposition devient la description courante de l'échange
        // (la colonne dédiée `counterText` n'existe plus dans le schéma).
        data.proposedDescription = input.counterText;
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
          message: notifBody,
          relatedId: id,
        },
      });

      // Message de suivi dans la conversation liée (paire + annonce)
      const conv = await findPairConversation(
        proposal.listingId,
        proposal.proposerId,
        proposal.ownerId
      );
      if (conv) {
        await db.message.create({
          data: {
            conversationId: conv.id,
            senderId: session.id,
            content: notifTitle + " — " + notifBody,
          },
        });
      }
    }

    const updated = await db.exchangeProposal.findUnique({
      where: { id },
      include: PROPOSAL_INCLUDE,
    });
    const fee = await getPublicationFee();
    const desiredNames = updated
      ? await loadDesiredCategoryNames(proposalCardListings([updated]))
      : undefined;

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
        ? serializeProposal(updated, isOwner ? "received" : "sent", fee, desiredNames)
        : null,
      message: messageMap[input.action],
    });
  });
}
