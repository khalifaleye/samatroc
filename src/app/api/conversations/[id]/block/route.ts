import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";

/** Bloque l'autre participant de la conversation */
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

    const otherId = conversation.userAId === session.id ? conversation.userBId : conversation.userAId;
    const existing = await db.block.findUnique({
      where: { blockerId_blockedId: { blockerId: session.id, blockedId: otherId } },
    });
    if (!existing) {
      await db.block.create({ data: { blockerId: session.id, blockedId: otherId } });
    }

    return jsonOk({ blocked: true, message: "Utilisateur bloqué. Il ne pourra plus vous contacter." });
  });
}
