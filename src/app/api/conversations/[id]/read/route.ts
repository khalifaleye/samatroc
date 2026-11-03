import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";

/** Marque tous les messages entrants de la conversation comme lus */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    const { id } = await params;

    const conversation = await db.conversation.findUnique({ where: { id } });
    if (!conversation) throw new ApiError(404, "Conversation introuvable");
    if (conversation.userAId !== session.id && conversation.userBId !== session.id) {
      throw new ApiError(403, "Accès interdit");
    }

    await db.message.updateMany({
      where: { conversationId: id, readAt: null, senderId: { not: session.id } },
      data: { readAt: new Date() },
    });

    return jsonOk({ ok: true });
  });
}
