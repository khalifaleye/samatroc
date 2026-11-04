/**
 * Helpers du domaine « Échanges & messagerie & notifications » (tâche 5-c)
 * ---------------------------------------------------------------------------
 * Module PRIVÉ du domaine (dossier `_shared` : jamais exposé en route Next),
 * partagé par /api/conversations, /api/notifications, /api/proposals,
 * /api/reports, /api/users, /api/my et /api/contact après la bascule Supabase.
 *
 * RÉPARTITION DES RESPONSABILITÉS (après finalisation de la vague listings) :
 *   • la SÉRIALISATION DES ANNONCES (ListingSummary) est déléguée aux helpers
 *     de la vague listings — `src/lib/serializers.ts` (tâche 5-b) :
 *     `listingInclude`, `serializeListing`, `getPublicationFee`,
 *     `loadDesiredCategoryNames`. Ce module ne recode plus rien : il passe
 *     simplement la carte `desiredCategoryNames` en 4e argument pour peupler
 *     `wantedCategory` (nom de catégorie) comme le font les routes annonces.
 *   • le double vocabulaire des STATUTS de proposition vit dans
 *     `src/lib/constants.ts` (`proposalStatusToApi` / `proposalStatusToDb`,
 *     même pattern que listingStatusToApi/ToDb).
 *   • ce module garde uniquement ce qui est propre au domaine : profils
 *     (fullName ⇄ firstName/lastName), messages, conversations, blocages,
 *     assemblage des propositions et dérivation des liens de notification.
 *
 * Mappings de compatibilité préservés (contrats src/lib/types.ts — aucune vue
 * modifiée) :
 *   • profiles.full_name                → firstName/lastName (splitFullName)
 *   • listing.desired_item              → wantedText
 *   • listing.neighborhood              → quartier
 *   • message.attachment_url / is_read  → imageUrl / readAt (dérivé, l'UI ne
 *     teste que la nullité) — `type` n'existe plus : toujours "TEXT"
 *   • notification.message / related_id / is_read → body / linkView+linkParams
 *     (dérivés du type, cf. notificationLink) / readAt (dérivé)
 *   • proposal.proposed_listing_id / proposed_description / proposed_images
 *                                       → offeredListing / offeredText /
 *                                         offeredImages (counterText supprimé :
 *                                         la contre-proposition REMPLIT
 *                                         proposed_description)
 *   • statuts stockés COUNTERED / REJECTED (enum Supabase), exposés en
 *     DISCUSSING / REFUSED (vocabulaire legacy attendu par les vues) —
 *     traduction via proposalStatusToApi (constants)
 *   • payment SUCCESSFUL → SUCCESS, confirmedAt → paidAt, provider TEST → isTest
 *
 * Blocages : le schéma Supabase n'a PAS de table `blocks` (l'ancienne table
 * démo a disparu). Le blocage est conservé via un registre en mémoire du
 * process (fonctionnel pour la démo/aperçu, réinitialisé au redémarrage) —
 * tous les endpoints conservent leur contrat JSON d'origine.
 */
import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { splitFullName } from "@/lib/auth";
import { proposalStatusToApi } from "@/lib/constants";
import {
  listingInclude,
  serializeListing,
} from "@/lib/serializers";

// ---------------------------------------------------------------------------
// Divers
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Vérifie le format uuid (les cibles Supabase sont des uuid, pas des cuid). */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Extrait les urls d'images d'une colonne Json `proposed_images`
 * (stockée en tableau JSON ; tolère une chaîne JSON ou null).
 */
function parseImageArray(value: Prisma.JsonValue): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === "string");
      }
    } catch {
      // valeur non JSON : ignorée
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Profils — fullName ⇄ firstName/lastName
// ---------------------------------------------------------------------------

/** Bloc « propriétaire / proposant / autre participant » attendu par les vues (OwnerData). */
export function profileBrief(profile: {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}): { id: string; firstName: string; lastName: string; avatarUrl: string | null } {
  const { firstName, lastName } = splitFullName(profile.fullName);
  return { id: profile.id, firstName, lastName, avatarUrl: profile.avatarUrl };
}

// ---------------------------------------------------------------------------
// Messages — compat MessageData
// ---------------------------------------------------------------------------

/** Sérialise un message vers le format historique (type "TEXT", readAt dérivé). */
export function serializeMessage(m: {
  id: string;
  senderId: string;
  content: string;
  attachmentUrl: string | null;
  isRead: boolean;
  createdAt: Date;
}) {
  return {
    id: m.id,
    senderId: m.senderId,
    type: "TEXT",
    content: m.content,
    imageUrl: m.attachmentUrl,
    readAt: m.isRead ? m.createdAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

/** Include pour la liste des conversations (dernier message + participants). */
export const CONVERSATION_LIST_INCLUDE = {
  listing: { include: { images: { take: 1, orderBy: { displayOrder: "asc" } } } },
  messages: { orderBy: { createdAt: "desc" }, take: 1 },
  participants: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
} satisfies Prisma.ConversationInclude;

/**
 * Retrouve la conversation liée à une proposition (paire proposer/owner sur
 * l'annonce). L'unicité « paire + annonce » se vérifie applicativement :
 * on exige exactement deux participants.
 */
export async function findPairConversation(
  listingId: string,
  userAId: string,
  userBId: string
): Promise<{ id: string } | null> {
  const conversation = await db.conversation.findFirst({
    where: {
      listingId,
      AND: [
        { participants: { some: { userId: userAId } } },
        { participants: { some: { userId: userBId } } },
      ],
    },
    select: { id: true, participants: { select: { userId: true } } },
  });
  if (conversation && conversation.participants.length === 2) {
    return { id: conversation.id };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Blocages (registre mémoire — voir note d'en-tête)
// ---------------------------------------------------------------------------

const blockGlobal = globalThis as unknown as {
  __samatrocBlockRegistry?: Map<string, Set<string>>;
};

function blockStore(): Map<string, Set<string>> {
  if (!blockGlobal.__samatrocBlockRegistry) {
    blockGlobal.__samatrocBlockRegistry = new Map<string, Set<string>>();
  }
  return blockGlobal.__samatrocBlockRegistry;
}

/** true si `blockerId` a bloqué `blockedId`. */
export function isBlocked(blockerId: string, blockedId: string): boolean {
  return blockStore().get(blockerId)?.has(blockedId) ?? false;
}

/** Pose ou retire un blocage. */
export function setBlocked(blockerId: string, blockedId: string, blocked: boolean): void {
  const store = blockStore();
  if (blocked) {
    const set = store.get(blockerId) ?? new Set<string>();
    set.add(blockedId);
    store.set(blockerId, set);
  } else {
    store.get(blockerId)?.delete(blockedId);
  }
}

/** Blocages dans les deux sens (flags `blocked` / `blockedByOther` de l'UI). */
export function blockedBetween(
  a: string,
  b: string
): { fromMe: boolean; fromOther: boolean } {
  return { fromMe: isBlocked(a, b), fromOther: isBlocked(b, a) };
}

// ---------------------------------------------------------------------------
// Propositions d'échange
// ---------------------------------------------------------------------------

export const PROPOSAL_INCLUDE = {
  listing: { include: listingInclude },
  proposedListing: { include: listingInclude },
  proposer: { select: { id: true, fullName: true, avatarUrl: true } },
} satisfies Prisma.ExchangeProposalInclude;

export type ProposalWithRelations = Prisma.ExchangeProposalGetPayload<{
  include: typeof PROPOSAL_INCLUDE;
}>;

/**
 * Sérialise une proposition vers le format historique (ProposalData).
 * • respondedAt / completedAt : colonnes disparues — dérivées de updated_at.
 * • counterText : colonne disparue — toujours null ; la contre-proposition
 *   du propriétaire remplace proposed_description (elle s'affiche alors dans
 *   l'emplacement « objet proposé »).
 * • `desiredCategoryNames` : carte id → nom chargée en amont par
 *   `loadDesiredCategoryNames` (helpers 5-b) pour peupler `wantedCategory`
 *   des annonces sérialisées (contrat ListingSummary complet).
 */
export function serializeProposal(
  proposal: ProposalWithRelations,
  direction: "sent" | "received",
  fee: number,
  desiredCategoryNames?: Map<string, string>
) {
  return {
    id: proposal.id,
    status: proposalStatusToApi(proposal.status),
    message: proposal.message,
    counterText: null as string | null,
    offeredText: proposal.proposedDescription,
    offeredImages: parseImageArray(proposal.proposedImages),
    createdAt: proposal.createdAt.toISOString(),
    respondedAt: proposal.status === "PENDING" ? null : proposal.updatedAt.toISOString(),
    completedAt: proposal.status === "COMPLETED" ? proposal.updatedAt.toISOString() : null,
    listing: serializeListing(proposal.listing, false, fee, desiredCategoryNames),
    offeredListing: proposal.proposedListing
      ? serializeListing(proposal.proposedListing, false, fee, desiredCategoryNames)
      : null,
    proposer: profileBrief(proposal.proposer),
    owner: profileBrief(proposal.listing.user),
    direction,
  };
}

/**
 * Résume les annonces d'une liste de propositions (cible + objet proposé)
 * pour un unique chargement des noms de catégories recherchées
 * (`loadDesiredCategoryNames` — helpers de la vague listings).
 */
export function proposalCardListings(
  proposals: ProposalWithRelations[]
): ProposalWithRelations["listing"][] {
  return proposals.flatMap((p) =>
    p.proposedListing ? [p.listing, p.proposedListing] : [p.listing]
  );
}

// ---------------------------------------------------------------------------
// Notifications — dérivation linkView/linkParams (colonnes disparues)
// ---------------------------------------------------------------------------

/** Onglet de la boîte propositions visé par une notification PROPOSAL_*. */
export type ProposalNotificationBox = "sent" | "received";

/**
 * Calcule, pour chaque notification PROPOSAL_*, l'onglet cible du DESTINATAIRE
 * (comportement historique : linkParams était écrit à la création avec l'onglet
 * du destinataire — « sent » pour le proposant, « received » pour le
 * propriétaire). La colonne link_params ayant disparu, l'onglet est dérivé à
 * la lecture : proposition chargée par `related_id`, comparaison avec
 * `user_id` du destinataire. Les ids non uuid (anciennes données) sont ignorés.
 */
export async function loadProposalNotificationBoxes(
  notifications: { type: string; userId: string; relatedId: string | null }[]
): Promise<Map<string, ProposalNotificationBox>> {
  const proposalIds = [
    ...new Set(
      notifications
        .filter(
          (n) =>
            n.type.startsWith("PROPOSAL") &&
            typeof n.relatedId === "string" &&
            isUuid(n.relatedId)
        )
        .map((n) => n.relatedId as string)
    ),
  ];
  if (proposalIds.length === 0) return new Map();

  const rows = await db.exchangeProposal.findMany({
    where: { id: { in: proposalIds } },
    select: { id: true, proposerId: true },
  });
  const proposerByProposalId = new Map(rows.map((r) => [r.id, r.proposerId]));

  const boxes = new Map<string, ProposalNotificationBox>();
  for (const n of notifications) {
    if (!n.type.startsWith("PROPOSAL") || !n.relatedId) continue;
    const proposerId = proposerByProposalId.get(n.relatedId);
    if (proposerId) {
      boxes.set(n.relatedId, proposerId === n.userId ? "sent" : "received");
    }
  }
  return boxes;
}

/**
 * Reconstruit `linkView` / `linkParams` (JSON string) depuis `type` et
 * `related_id` : les colonnes link_view/link_params ont disparu du schéma.
 * Cibles vérifiées dans le registre de vues (src/components/app-router.tsx) :
 * messages, proposals, payments, my-listings, listing, admin-dashboard.
 * Pour les notifications PROPOSAL_*, `proposalTab` (précalculé par
 * `loadProposalNotificationBoxes`) donne l'onglet du destinataire ; à défaut,
 * heuristique par type (PROPOSAL_RECEIVED → boîte « reçues » du propriétaire,
 * autres → boîte « envoyées » du proposant).
 */
export function notificationLink(
  type: string,
  relatedId: string | null,
  proposalTab?: ProposalNotificationBox
): { linkView: string | null; linkParams: string | null } {
  if (type === "MESSAGE") {
    return {
      linkView: "messages",
      linkParams: relatedId ? JSON.stringify({ id: relatedId }) : null,
    };
  }
  if (type.startsWith("PROPOSAL")) {
    const tab =
      proposalTab ?? (type === "PROPOSAL_RECEIVED" ? "received" : "sent");
    return { linkView: "proposals", linkParams: JSON.stringify({ tab }) };
  }
  if (type === "SYSTEM") {
    // Canaux émetteurs actuels : formulaire de contact → espace admin.
    return { linkView: "admin-dashboard", linkParams: null };
  }
  if (type.startsWith("PAYMENT")) {
    return { linkView: "payments", linkParams: null };
  }
  if (type === "LISTING_PUBLISHED") {
    return {
      linkView: "listing",
      linkParams: relatedId ? JSON.stringify({ id: relatedId }) : null,
    };
  }
  if (type.startsWith("LISTING")) {
    return { linkView: "my-listings", linkParams: null };
  }
  return { linkView: null, linkParams: null };
}

/**
 * Sérialise une notification vers le format historique (NotificationData) :
 * `body` ← message, `readAt` dérivé de is_read, `linkView`/`linkParams`
 * reconstruits (voir notificationLink).
 */
export function serializeNotification(
  n: {
    id: string;
    type: string;
    title: string;
    message: string;
    relatedId: string | null;
    isRead: boolean;
    createdAt: Date;
  },
  proposalBoxes?: Map<string, ProposalNotificationBox>
) {
  const link = notificationLink(
    n.type,
    n.relatedId,
    proposalBoxes?.get(n.relatedId ?? "")
  );
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.message,
    linkView: link.linkView,
    linkParams: link.linkParams,
    readAt: n.isRead ? n.createdAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}
