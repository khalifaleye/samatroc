import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { z } from "zod";

/** Vérification de l'adresse e-mail via jeton */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const { token } = await readBody(req, z.object({ token: z.string().min(10) }));

    const record = await db.verificationToken.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expiresAt < new Date() || record.type !== "EMAIL") {
      throw new ApiError(400, "Lien de vérification invalide ou expiré.");
    }

    await db.$transaction([
      db.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
      db.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);

    return jsonOk({ ok: true, message: "Votre adresse e-mail a été vérifiée avec succès." });
  });
}
