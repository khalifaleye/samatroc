import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser, splitFullName } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";
import { proposalSchema } from "@/lib/validators";
import {
  listingInclude,
  serializeListing,
  getPublicationFee,
  loadDesiredCategoryNames,
} from "@/lib/serializers";

/** Les ids d'annonce sont des uuid en base (PostgreSQL Supabase). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `proposed_images` est une colonne Json (peut contenir un tableau ou la
 * chaîne « [] » selon l'origine de la ligne) — lecture défensive en string[].
 * Compatibilité : la réponse continue d'exposer `offeredImages`.
 */
function readImageList(value: Prisma.JsonValue | null): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Création d'une proposition d'échange sur une annonce.
 * Effets : notification au propriétaire + conversation créée avec message système.
 * Mapping Supabase : offeredListingId → proposedListingId, offeredText →
 * proposedDescription, offeredImages → proposedImages (Json), status
 * DISCUSSING → COUNTERED ; conversations = conversation + participants.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connectez-vous pour proposer un échange");
    const { id } = await params;
    if (!UUID_RE.test(id)) throw new ApiError(404, "Cette annonce n'est pas disponible pour un échange");
    const input = await proposalSchema.parseAsync(await req.json());

    const listing = await db.listing.findUnique({ where: { id } });
    if (!listing || listing.status !== "PUBLISHED") {
      throw new ApiError(404, "Cette annonce n'est pas disponible pour un échange");
    }
    if (listing.userId === session.id) {
      throw new ApiError(400, "Vous ne pouvez pas proposer un échange sur votre propre annonce");
    }

    // Pas de proposition en attente en double (DISCUSSING → COUNTERED)
    const duplicate = await db.exchangeProposal.findFirst({
      where: {
        listingId: id,
        proposerId: session.id,
        status: { in: ["PENDING", "COUNTERED", "ACCEPTED"] },
      },
    });
    if (duplicate) {
      throw new ApiError(409, "Vous avez déjà une proposition en cours sur cette annonce");
    }

    // Vérifie l'annonce offerte si fournie
    if (input.offeredListingId) {
      if (!UUID_RE.test(input.offeredListingId)) {
        throw new ApiError(400, "L'annonce sélectionnée ne vous appartient pas");
      }
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
        ownerId: listing.userId,
        proposedListingId: input.offeredListingId || null,
        proposedDescription: input.offeredText || null,
        proposedImages: input.images ?? [],
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
        message: `${session.firstName} propose un échange pour « ${listing.title} ». Répondez depuis votre espace.`,
        relatedId: proposal.id,
      },
    });

    // Conversation automatique : paire de participants liée à l'annonce
    // (unicité vérifiée applicativement — cf. docs migration Supabase).
    let conversation = await db.conversation.findFirst({
      where: {
        listingId: id,
        AND: [
          { participants: { some: { userId: session.id } } },
          { participants: { some: { userId: listing.userId } } },
          { participants: { every: { userId: { in: [session.id, listing.userId] } } } },
        ],
      },
    });
    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          listingId: id,
          participants: { create: [{ userId: session.id }, { userId: listing.userId }] },
        },
      });
    }

    // Le modèle Message n'a plus de type « SYSTEM » ni d'expéditeur nullable :
    // le message d'information est envoyé au nom du proposant.
    await db.message.create({
      data: {
        conversationId: conversation.id,
        senderId: session.id,
        content: `Proposition d'échange envoyée par ${session.firstName} pour « ${listing.title} ».`,
      },
    });
    if (input.message) {
      await db.message.create({
        data: { conversationId: conversation.id, senderId: session.id, content: input.message },
      });
    }
    // Ancien `lastMessageAt` : l'horodatage de dernière activité est porté par
    // `updated_at` (mis à jour explicitement pour le tri des conversations).
    await db.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    const full = await db.exchangeProposal.findUnique({
      where: { id: proposal.id },
      include: {
        listing: { include: listingInclude },
        proposedListing: { include: listingInclude },
        proposer: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
    const fee = await getPublicationFee();

    let proposer = null as { id: string; firstName: string; lastName: string; avatarUrl: string | null } | null;
    let desiredCategoryNames: Map<string, string> | undefined;
    if (full) {
      const name = splitFullName(full.proposer.fullName);
      proposer = {
        id: full.proposer.id,
        firstName: name.firstName,
        lastName: name.lastName,
        avatarUrl: full.proposer.avatarUrl,
      };
      desiredCategoryNames = await loadDesiredCategoryNames(
        full.proposedListing ? [full.listing, full.proposedListing] : [full.listing]
      );
    }

    return jsonOk(
      {
        proposal: full
          ? {
              id: full.id,
              status: full.status,
              message: full.message,
              // La colonne counter_text a disparu : la contre-proposition est
              // portée par le statut COUNTERED + proposedDescription.
              counterText: null,
              offeredText: full.proposedDescription,
              offeredImages: readImageList(full.proposedImages),
              createdAt: full.createdAt.toISOString(),
              listing: serializeListing(full.listing, false, fee, desiredCategoryNames),
              offeredListing: full.proposedListing
                ? serializeListing(full.proposedListing, false, fee, desiredCategoryNames)
                : null,
              proposer,
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
