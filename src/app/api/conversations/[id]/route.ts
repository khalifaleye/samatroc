import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";
import { blockedBetween, isUuid, profileBrief, serializeMessage } from "@/app/api/_shared/domain";

/**
 * Détail d'une conversation (accès participants uniquement) — bascule
 * Supabase : participants via `conversation_participants`, messages avec
 * `attachmentUrl` (ex imageUrl) et `isRead` (ex readAt), plus de table
 * `blocks` (registre mémoire du domaine). Identifiant non uuid → 404
 * (les cibles Supabase sont des uuid).
 */

/** Détail d'une conversation : participants, annonces, messages (accès participants uniquement) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Conversation introuvable");

    const conversation = await db.conversation.findUnique({
      where: { id },
      include: {
        listing: { include: { images: { take: 1, orderBy: { displayOrder: "asc" } } } },
        messages: { orderBy: { createdAt: "asc" } },
        participants: {
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true, city: true } },
          },
        },
      },
    });
    if (!conversation) throw new ApiError(404, "Conversation introuvable");

    const isParticipant = conversation.participants.some((p) => p.userId === session.id);
    if (!isParticipant) throw new ApiError(403, "Cette conversation est privée");

    const otherParticipant = conversation.participants.find((p) => p.userId !== session.id);
    const otherId = otherParticipant?.userId ?? "";
    const other = otherParticipant
      ? { ...profileBrief(otherParticipant.user), city: otherParticipant.user.city }
      : { id: otherId, firstName: "Utilisateur", lastName: "", avatarUrl: null, city: null };

    const blocks = blockedBetween(session.id, otherId);

    // Marque les messages entrants comme lus (isRead remplace readAt)
    await db.message.updateMany({
      where: { conversationId: id, isRead: false, senderId: { not: session.id } },
      data: { isRead: true },
    });

    return jsonOk({
      conversation: {
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
        blocked: blocks.fromMe,
        blockedByOther: blocks.fromOther,
      },
      messages: conversation.messages.map(serializeMessage),
    });
  });
}
