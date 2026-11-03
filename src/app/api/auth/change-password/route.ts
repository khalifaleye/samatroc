import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { handleRoute, readBody, requireAuth, ApiError, jsonOk } from "@/lib/api-utils";
import { changePasswordSchema } from "@/lib/validators";

/** Changement de mot de passe (utilisateur connecté) */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const user = await requireAuth();
    const input = await readBody(req, changePasswordSchema);

    const full = await db.user.findUnique({ where: { id: user.id } });
    if (!full || !(await verifyPassword(input.currentPassword, full.passwordHash))) {
      throw new ApiError(400, "Le mot de passe actuel est incorrect", {
        currentPassword: "Mot de passe incorrect",
      });
    }

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });

    return jsonOk({ ok: true, message: "Mot de passe modifié avec succès." });
  });
}
