import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { conversationStartSchema } from "@/lib/validators";

function pairKeys(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Liste des conversations de l'utilisateur */
export async function GET() {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) return jsonOk({ error: "Connexion requise" }, 401);

    const conversations = await db.conversation.findMany({
      where: { OR: [{ userAId: session.id }, { userBId: session.id }] },
      orderBy: { lastMessageAt: "desc" },
      include: {
        listing: { include: { images: { take: 1, orderBy: { sortOrder: "asc" } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    const result = await Promise.all(
      conversations.map(async (c) => {
        const otherId = c.userAId === session.id ? c.userBId : c.userAId;
        const other = await db.user.findUnique({
          where: { id: otherId },
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        });
        const unreadCount = await db.message.count({
          where: { conversationId: c.id, readAt: null, senderId: { not: session.id }, type: { not: "SYSTEM" } },
        });
        const last = c.messages[0];
        return {
          id: c.id,
          listing: c.listing
            ? {
                id: c.listing.id,
                title: c.listing.title,
                images: c.listing.images.map((i) => ({ url: i.url, isPrimary: i.isPrimary })),
              }
            : null,
          other: other ?? { id: otherId, firstName: "Utilisateur", lastName: "", avatarUrl: null },
          lastMessage: last
            ? { content: last.content, type: last.type, senderId: last.senderId, createdAt: last.createdAt.toISOString() }
            : null,
          unreadCount,
          lastMessageAt: c.lastMessageAt.toISOString(),
        };
      })
    );

    return jsonOk({ conversations: result });
  });
}

/** Démarrer (ou reprendre) une conversation avec un utilisateur au sujet d'une annonce */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connectez-vous pour contacter un utilisateur");
    const input = await readBody(req, conversationStartSchema);

    if (input.userId === session.id) {
      throw new ApiError(400, "Vous ne pouvez pas vous écrire à vous-même");
    }
    const other = await db.user.findUnique({ where: { id: input.userId } });
    if (!other) throw new ApiError(404, "Utilisateur introuvable");

    // Vérifie blocage
    const blocked = await db.block.findFirst({
      where: {
        OR: [
          { blockerId: session.id, blockedId: input.userId },
          { blockerId: input.userId, blockedId: session.id },
        ],
      },
    });
    if (blocked) throw new ApiError(403, "Cette conversation n'est pas disponible");

    const [userAId, userBId] = pairKeys(session.id, input.userId);
    let conversation = await db.conversation.findFirst({
      where: {
        listingId: input.listingId ?? null,
        userAId,
        userBId,
      },
    });
    if (!conversation) {
      conversation = await db.conversation.create({
        data: { listingId: input.listingId ?? null, userAId, userBId },
      });
    }

    await db.message.create({
      data: { conversationId: conversation.id, senderId: session.id, content: input.message },
    });
    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    await db.notification.create({
      data: {
        userId: input.userId,
        type: "MESSAGE",
        title: "Nouveau message",
        body: `${session.firstName} vous a envoyé un message sur SamaTroc.`,
        linkView: "messages",
        linkParams: JSON.stringify({ id: conversation.id }),
      },
    });

    return jsonOk({ conversationId: conversation.id }, 201);
  });
}
