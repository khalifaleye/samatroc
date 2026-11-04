import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { reportSchema } from "@/lib/validators";
import { isUuid } from "@/app/api/_shared/domain";

/**
 * Signalement d'une conversation — bascule Supabase : l'ancien couple
 * `targetType/targetId` devient `reportedUserId` (+ contexte `listingId`),
 * `details` devient `description`. La cible (l'autre participant) est
 * dérivée de la conversation côté serveur. Identifiant de conversation non
 * uuid → 404 (les cibles Supabase sont des uuid).
 */

/** Signale l'autre participant de la conversation */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Conversation introuvable");
    const input = await readBody(req, reportSchema);

    const conversation = await db.conversation.findUnique({
      where: { id },
      include: { participants: { select: { userId: true } } },
    });
    if (!conversation) throw new ApiError(404, "Conversation introuvable");

    const isParticipant = conversation.participants.some((p) => p.userId === session.id);
    if (!isParticipant) throw new ApiError(403, "Accès interdit");

    const otherId =
      conversation.participants.find((p) => p.userId !== session.id)?.userId ?? "";

    await db.report.create({
      data: {
        reporterId: session.id,
        reportedUserId: otherId || null,
        listingId: conversation.listingId,
        reason: input.reason,
        description: input.details || `Signalé depuis la conversation ${id}`,
      },
    });

    return jsonOk({ ok: true, message: "Signalement envoyé. Notre équipe de modération va l'examiner." });
  });
}
