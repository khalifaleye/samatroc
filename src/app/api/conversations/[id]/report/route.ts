import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { reportSchema } from "@/lib/validators";

/** Signale l'autre participant de la conversation */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    const { id } = await params;
    const input = await readBody(req, reportSchema);

    const conversation = await db.conversation.findUnique({ where: { id } });
    if (!conversation) throw new ApiError(404, "Conversation introuvable");
    if (conversation.userAId !== session.id && conversation.userBId !== session.id) {
      throw new ApiError(403, "Accès interdit");
    }

    const otherId = conversation.userAId === session.id ? conversation.userBId : conversation.userAId;

    await db.report.create({
      data: {
        reporterId: session.id,
        targetType: "USER",
        targetId: otherId,
        reason: input.reason,
        details: input.details || `Signalé depuis la conversation ${id}`,
      },
    });

    return jsonOk({ ok: true, message: "Signalement envoyé. Notre équipe de modération va l'examiner." });
  });
}
