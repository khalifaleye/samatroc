import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";
import { isUuid, setBlocked } from "@/app/api/_shared/domain";

/**
 * Blocage du participant — bascule Supabase : l'ancienne table `blocks` a
 * disparu du schéma (aucune table équivalente dans les migrations SQL). Le
 * blocage est enregistré dans le registre mémoire du domaine
 * (src/app/api/_shared/domain.ts) ; le contrat JSON de réponse est conservé.
 * Identifiant de conversation non uuid → 404 (les cibles Supabase sont des
 * uuid).
 */

/** Bloque l'autre participant de la conversation */
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

    const otherId =
      conversation.participants.find((p) => p.userId !== session.id)?.userId ?? "";
    if (otherId) setBlocked(session.id, otherId, true);

    return jsonOk({ blocked: true, message: "Utilisateur bloqué. Il ne pourra plus vous contacter." });
  });
}
