import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";

/** Détail d'une conversation : participants, annonces, messages (accès participants uniquement) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    const { id } = await params;

    const conversation = await db.conversation.findUnique({
      where: { id },
      include: {
        listing: { include: { images: { take: 1, orderBy: { sortOrder: "asc" } } } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!conversation) throw new ApiError(404, "Conversation introuvable");

    const isParticipant = conversation.userAId === session.id || conversation.userBId === session.id;
    if (!isParticipant) throw new ApiError(403, "Cette conversation est privée");

    const otherId = conversation.userAId === session.id ? conversation.userBId : conversation.userAId;
    const other = await db.user.findUnique({
      where: { id: otherId },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true, city: true },
    });

    const blockFromMe = await db.block.findFirst({
      where: { blockerId: session.id, blockedId: otherId },
    });
    const blockFromOther = await db.block.findFirst({
      where: { blockerId: otherId, blockedId: session.id },
    });

    // Marque les messages entrants comme lus
    await db.message.updateMany({
      where: { conversationId: id, readAt: null, senderId: { not: session.id } },
      data: { readAt: new Date() },
    });

    return jsonOk({
      conversation: {
        id: conversation.id,
        listing: conversation.listing
          ? {
              id: conversation.listing.id,
              title: conversation.listing.title,
              images: conversation.listing.images.map((i) => ({
                url: i.url,
                isPrimary: i.isPrimary,
              })),
            }
          : null,
        other: other ?? { id: otherId, firstName: "Utilisateur", lastName: "", avatarUrl: null, city: null },
        blocked: !!blockFromMe,
        blockedByOther: !!blockFromOther,
      },
      messages: conversation.messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        type: m.type,
        content: m.content,
        imageUrl: m.imageUrl,
        readAt: m.readAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  });
}
