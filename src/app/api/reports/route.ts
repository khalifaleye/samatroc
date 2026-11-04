import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { reportSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/app/api/_shared/domain";

/**
 * Création d'un signalement — bascule Supabase (tâche 5-c) :
 * l'ancien couple polymorphe `targetType/targetId` devient les colonnes
 * dédiées `listingId` / `reportedUserId` (+ `description` pour details).
 * Les vues envoient toujours targetType/targetId (et la vue messagerie
 * n'en envoie pas du tout — cf. reportSchema désormais optionnel) : le
 * mapping est fait ici, avec validation uuid (les cibles Supabase sont des
 * uuid). Un signalement de MESSAGE remonte à l'auteur du message.
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connectez-vous pour signaler un contenu");
    const input = await readBody(req, reportSchema);

    if (!rateLimit(`report:${session.id}`, 10, 60 * 60 * 1000)) {
      throw new ApiError(429, "Trop de signalements. Notre équipe examine déjà vos demandes.");
    }

    if (!input.targetType || !input.targetId) {
      throw new ApiError(400, "Cible du signalement manquante");
    }

    let listingId: string | null = null;
    let reportedUserId: string | null = null;

    if (input.targetType === "LISTING") {
      if (!isUuid(input.targetId)) throw new ApiError(400, "Annonce introuvable");
      listingId = input.targetId;
    } else if (input.targetType === "USER") {
      if (!isUuid(input.targetId)) throw new ApiError(400, "Utilisateur introuvable");
      reportedUserId = input.targetId;
    } else {
      // MESSAGE : le signalement remonte à l'auteur du message
      if (!isUuid(input.targetId)) throw new ApiError(400, "Message introuvable");
      const message = await db.message.findUnique({
        where: { id: input.targetId },
        select: { senderId: true },
      });
      reportedUserId = message?.senderId ?? null;
    }

    if (!listingId && !reportedUserId) {
      throw new ApiError(400, "Cible du signalement introuvable");
    }

    await db.report.create({
      data: {
        reporterId: session.id,
        listingId,
        reportedUserId,
        reason: input.reason,
        description: input.details || null,
      },
    });

    return jsonOk({
      ok: true,
      message: "Signalement envoyé. Notre équipe de modération va l'examiner rapidement.",
    });
  });
}
