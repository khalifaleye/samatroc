import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/auth";
import { handleRoute, readBody, ApiError, getClientIp, jsonOk } from "@/lib/api-utils";
import { forgotPasswordSchema } from "@/lib/validators";
import { rateLimit, retryAfter } from "@/lib/rate-limit";

/**
 * Demande de réinitialisation de mot de passe.
 * En production, le lien est envoyé par e-mail. En développement,
 * le jeton est retourné dans la réponse (aucun SMTP configuré).
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const input = await readBody(req, forgotPasswordSchema);
    const ip = getClientIp(req);
    if (!rateLimit(`forgot:${ip}:${input.email}`, 3, 60 * 60 * 1000)) {
      throw new ApiError(429, `Trop de demandes. Réessayez dans ${retryAfter(`forgot:${ip}:${input.email}`)} secondes.`);
    }

    const user = await db.user.findUnique({ where: { email: input.email } });

    // Réponse identique que le compte existe ou non (anti-énumération)
    let devResetToken: string | null = null;
    if (user) {
      const token = generateToken();
      await db.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: await hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 h
        },
      });
      if (process.env.NODE_ENV !== "production") {
        devResetToken = token;
      }
    }

    return jsonOk({
      ok: true,
      message:
        "Si un compte existe avec cette adresse, vous recevrez un lien de réinitialisation.",
      devResetToken,
    });
  });
}
