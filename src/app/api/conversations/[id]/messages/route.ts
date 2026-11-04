import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { messageSchema } from "@/lib/validators";
import { blockedBetween, isUuid, serializeMessage } from "@/app/api/_shared/domain";

/**
 * Envoi d'un message — bascule Supabase : `imageUrl` → `attachmentUrl`,
 * participant vérifié via `conversation_participants`, notification écrite
 * avec `message`/`relatedId` (ex body/linkView/linkParams). Identifiant de
 * conversation non uuid → 404 (les cibles Supabase sont des uuid).
 */

/** Envoi d'un message dans une conversation */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Conversation introuvable");
    const input = await readBody(req, messageSchema);

    const conversation = await db.conversation.findUnique({
      where: { id },
      include: { participants: { select: { userId: true } } },
    });
    if (!conversation) throw new ApiError(404, "Conversation introuvable");

    const isParticipant = conversation.participants.some((p) => p.userId === session.id);
    if (!isParticipant) throw new ApiError(403, "Cette conversation est privée");

    const otherId =
      conversation.participants.find((p) => p.userId !== session.id)?.userId ?? "";

    const blocks = blockedBetween(session.id, otherId);
    if (blocks.fromOther) {
      throw new ApiError(403, "Vous ne pouvez plus envoyer de message dans cette conversation");
    }
    if (blocks.fromMe) {
      throw new ApiError(403, "Vous avez bloqué cet utilisateur. Débloquez-le pour lui écrire.");
    }

    const message = await db.message.create({
      data: {
        conversationId: id,
        senderId: session.id,
        content: input.content,
        attachmentUrl: input.imageUrl || null,
      },
    });

    if (otherId) {
      await db.notification.create({
        data: {
          userId: otherId,
          type: "MESSAGE",
          title: "Nouveau message",
          message: `${session.firstName} : ${input.content.slice(0, 80)}${input.content.length > 80 ? "…" : ""}`,
          relatedId: id,
        },
      });
    }

    return jsonOk({ message: serializeMessage(message) }, 201);
  });
}
