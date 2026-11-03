import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, hashToken } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { resetPasswordSchema } from "@/lib/validators";

/** Réinitialisation effective du mot de passe via un jeton valide */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const input = await readBody(req, resetPasswordSchema);

    const record = await db.passwordResetToken.findUnique({
      where: { tokenHash: await hashToken(input.token) },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new ApiError(400, "Ce lien de réinitialisation est invalide ou expiré. Faites une nouvelle demande.");
    }

    await db.$transaction([
      db.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(input.password) },
      }),
      db.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return jsonOk({ ok: true, message: "Votre mot de passe a été réinitialisé avec succès." });
  });
}
