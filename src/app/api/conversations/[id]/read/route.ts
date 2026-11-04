import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";
import { isUuid } from "@/app/api/_shared/domain";

/**
 * Marquage « lu » — bascule Supabase : `readAt: null` → `isRead: false`,
 * participant vérifié via `conversation_participants`. Identifiant de
 * conversation non uuid → 404 (les cibles Supabase sont des uuid).
 */

/** Marque tous les messages entrants de la conversation comme lus */
export async function POST(
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
      include: { participants: { select: { userId: true } } },
    });
    if (!conversation) throw new ApiError(404, "Conversation introuvable");

    const isParticipant = conversation.participants.some((p) => p.userId === session.id);
    if (!isParticipant) throw new ApiError(403, "Accès interdit");

    await db.message.updateMany({
      where: { conversationId: id, isRead: false, senderId: { not: session.id } },
      data: { isRead: true },
    });

    return jsonOk({ ok: true });
  });
}
