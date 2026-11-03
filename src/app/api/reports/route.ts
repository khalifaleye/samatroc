import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { reportSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";

/** Création d'un signalement (annonce, utilisateur, message) */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connectez-vous pour signaler un contenu");
    const input = await readBody(req, reportSchema);

    if (!rateLimit(`report:${session.id}`, 10, 60 * 60 * 1000)) {
      throw new ApiError(429, "Trop de signalements. Notre équipe examine déjà vos demandes.");
    }

    await db.report.create({
      data: {
        reporterId: session.id,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        details: input.details || null,
      },
    });

    return jsonOk({
      ok: true,
      message: "Signalement envoyé. Notre équipe de modération va l'examiner rapidement.",
    });
  });
}
