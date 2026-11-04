import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { conversationStartSchema } from "@/lib/validators";
import {
  blockedBetween,
  CONVERSATION_LIST_INCLUDE,
  isUuid,
  profileBrief,
  serializeMessage,
} from "@/app/api/_shared/domain";

/**
 * Conversations — bascule Supabase (tâche 5-c) :
 * l'ancien modèle démo `userAId/userBId` est remplacé par
 * `conversations` + `conversation_participants` (accès via
 * db.conversationParticipant.findMany({ where: { userId } })). L'unicité
 * (paire + annonce) se vérifie applicativement. La colonne `lastMessageAt`
 * a disparu : elle est dérivée du dernier message. Les notifications
 * s'écrivent avec `message`/`relatedId` (anciennement body/linkView/linkParams).
 * Les identifiants non uuid renvoient 404/400 sans requête SQL (les cibles
 * Supabase sont des uuid, cf. convention de la vague listings).
 */

/** Liste des conversations de l'utilisateur */
export async function GET() {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) return jsonOk({ error: "Connexion requise" }, 401);

    const participations = await db.conversationParticipant.findMany({
      where: { userId: session.id },
      orderBy: { joinedAt: "desc" },
      include: { conversation: { include: CONVERSATION_LIST_INCLUDE } },
    });

    const result = await Promise.all(
      participations.map(async (participation) => {
        const conversation = participation.conversation;
        const otherParticipant = conversation.participants.find(
          (p) => p.userId !== session.id
        );
        const other = otherParticipant
          ? profileBrief(otherParticipant.user)
          : { id: "", firstName: "Utilisateur", lastName: "", avatarUrl: null };
        const unreadCount = await db.message.count({
          where: {
            conversationId: conversation.id,
            isRead: false,
            senderId: { not: session.id },
          },
        });
        const last = conversation.messages[0];
        return {
          id: conversation.id,
          listing: conversation.listing
            ? {
                id: conversation.listing.id,
                title: conversation.listing.title,
                images: conversation.listing.images.map((i) => ({
                  url: i.imageUrl,
                  isPrimary: i.isPrimary,
                })),
              }
            : null,
          other,
          lastMessage: last ? serializeMessage(last) : null,
          unreadCount,
          // Colonne lastMessageAt disparue : dérivée du dernier message
          lastMessageAt: (last?.createdAt ?? conversation.updatedAt).toISOString(),
        };
      })
    );

    // Tri par dernier message décroissant (anciennement lastMessageAt en SQL)
    result.sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));

    return jsonOk({ conversations: result });
  });
}

/** Démarrer (ou reprendre) une conversation avec un utilisateur au sujet d'une annonce */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connectez-vous pour contacter un utilisateur");
    const input = await readBody(req, conversationStartSchema);

    // Identifiants non uuid : réponse 400/404 propre au lieu d'une erreur SQL
    if (!isUuid(input.userId)) throw new ApiError(404, "Utilisateur introuvable");
    if (input.listingId && !isUuid(input.listingId)) {
      throw new ApiError(400, "Annonce introuvable");
    }

    if (input.userId === session.id) {
      throw new ApiError(400, "Vous ne pouvez pas vous écrire à vous-même");
    }
    const other = await db.profile.findUnique({ where: { id: input.userId } });
    if (!other) throw new ApiError(404, "Utilisateur introuvable");

    // Vérifie blocage (registre mémoire — l'ancienne table `blocks` n'existe
    // plus dans le schéma Supabase)
    const blocks = blockedBetween(session.id, input.userId);
    if (blocks.fromMe || blocks.fromOther) {
      throw new ApiError(403, "Cette conversation n'est pas disponible");
    }

    // Unicité (paire + annonce) vérifiée applicativement : exactement
    // deux participants sur la même annonce (ou sans annonce).
    const existing = await db.conversation.findFirst({
      where: {
        listingId: input.listingId ?? null,
        AND: [
          { participants: { some: { userId: session.id } } },
          { participants: { some: { userId: input.userId } } },
        ],
      },
      select: { id: true, participants: { select: { userId: true } } },
    });

    let conversationId: string;
    if (existing && existing.participants.length === 2) {
      conversationId = existing.id;
    } else {
      const created = await db.conversation.create({
        data: {
          listingId: input.listingId ?? null,
          participants: { create: [{ userId: session.id }, { userId: input.userId }] },
        },
        select: { id: true },
      });
      conversationId = created.id;
    }

    await db.message.create({
      data: { conversationId, senderId: session.id, content: input.message },
    });

    await db.notification.create({
      data: {
        userId: input.userId,
        type: "MESSAGE",
        title: "Nouveau message",
        message: `${session.firstName} vous a envoyé un message sur SamaTroc.`,
        relatedId: conversationId,
      },
    });

    return jsonOk({ conversationId }, 201);
  });
}
