import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { z } from "zod";
import {
  isUuid,
  loadProposalNotificationBoxes,
  serializeNotification,
} from "@/app/api/_shared/domain";

/**
 * Centre de notifications — bascule Supabase (tâche 5-c) :
 * `body` → `message`, `linkView`/`linkParams` → dérivés de `type`/`relatedId`
 * (colonnes disparues), `readAt` → `isRead` (l'UI ne teste que la nullité :
 * readAt dérivé = createdAt quand isRead). Pour les notifications PROPOSAL_*,
 * l'onglet cible (`linkParams`) est recalculé à la lecture depuis la
 * proposition (`related_id`) et le destinataire — comportement historique.
 * Le JSON de réponse reste strictement au format NotificationData consommé
 * par src/views/account/notifications.tsx.
 */

/** Centre de notifications de l'utilisateur */
export async function GET() {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: session.id },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
      db.notification.count({ where: { userId: session.id, isRead: false } }),
    ]);

    // Onglet cible des notifications PROPOSAL_* (un seul lot de requêtes)
    const proposalBoxes = await loadProposalNotificationBoxes(notifications);

    return jsonOk({
      notifications: notifications.map((n) => serializeNotification(n, proposalBoxes)),
      unreadCount,
    });
  });
}

/** Marque des notifications comme lues (ids ou toutes) — route legacy conservée */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    const { ids, all } = await readBody(
      req,
      z.object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() })
    );

    if (all) {
      await db.notification.updateMany({
        where: { userId: session.id, isRead: false },
        data: { isRead: true },
      });
    } else if (ids && ids.length > 0) {
      // Filtre uuid : un identifiant invalide ne doit pas provoquer d'erreur SQL
      const validIds = ids.filter(isUuid);
      if (validIds.length > 0) {
        await db.notification.updateMany({
          where: { userId: session.id, id: { in: validIds }, isRead: false },
          data: { isRead: true },
        });
      }
    }

    return jsonOk({ ok: true });
  });
}
