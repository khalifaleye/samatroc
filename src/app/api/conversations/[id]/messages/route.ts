import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { messageSchema } from "@/lib/validators";

/** Envoi d'un message dans une conversation */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    const { id } = await params;
    const input = await readBody(req, messageSchema);

    const conversation = await db.conversation.findUnique({ where: { id } });
    if (!conversation) throw new ApiError(404, "Conversation introuvable");
    if (conversation.userAId !== session.id && conversation.userBId !== session.id) {
      throw new ApiError(403, "Cette conversation est privée");
    }

    const otherId = conversation.userAId === session.id ? conversation.userBId : conversation.userAId;

    const blockFromMe = await db.block.findFirst({ where: { blockerId: session.id, blockedId: otherId } });
    const blockFromOther = await db.block.findFirst({ where: { blockerId: otherId, blockedId: session.id } });
    if (blockFromOther) throw new ApiError(403, "Vous ne pouvez plus envoyer de message dans cette conversation");
    if (blockFromMe) throw new ApiError(403, "Vous avez bloqué cet utilisateur. Débloquez-le pour lui écrire.");

    const message = await db.message.create({
      data: {
        conversationId: id,
        senderId: session.id,
        content: input.content,
        imageUrl: input.imageUrl || null,
      },
    });
    await db.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    });

    await db.notification.create({
      data: {
        userId: otherId,
        type: "MESSAGE",
        title: "Nouveau message",
        body: `${session.firstName} : ${input.content.slice(0, 80)}${input.content.length > 80 ? "…" : ""}`,
        linkView: "messages",
        linkParams: JSON.stringify({ id }),
      },
    });

    return jsonOk(
      {
        message: {
          id: message.id,
          senderId: message.senderId,
          type: message.type,
          content: message.content,
          imageUrl: message.imageUrl,
          readAt: null,
          createdAt: message.createdAt.toISOString(),
        },
      },
      201
    );
  });
}
