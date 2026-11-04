import { NextRequest } from "next/server";
import { requireAuth, handleRoute, ApiError, jsonOk } from "@/lib/api-utils";
import { isBlocked, isUuid, setBlocked } from "@/app/api/_shared/domain";

/**
 * Bloquer / débloquer un utilisateur — bascule Supabase : l'ancienne table
 * `blocks` (blockerId/blockedId) n'existe plus dans le schéma Supabase
 * (aucune table équivalente dans les migrations SQL). Le blocage est tenu
 * dans le registre mémoire du domaine (src/app/api/_shared/domain.ts) ; le
 * contrat JSON de réponse est conservé à l'identique. Un identifiant non
 * uuid renvoie 404 (les cibles Supabase sont des uuid).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await requireAuth();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Utilisateur introuvable");
    if (id === session.id) throw new ApiError(400, "Vous ne pouvez pas vous bloquer vous-même");

    const existing = isBlocked(session.id, id);

    if (existing) {
      setBlocked(session.id, id, false);
      return jsonOk({ blocked: false, message: "Utilisateur débloqué" });
    }

    setBlocked(session.id, id, true);
    return jsonOk({ blocked: true, message: "Utilisateur bloqué" });
  });
}
