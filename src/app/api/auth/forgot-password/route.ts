import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { handleRoute, readBody, ApiError, getClientIp, jsonOk } from "@/lib/api-utils";
import { forgotPasswordSchema } from "@/lib/validators";
import { rateLimit, retryAfter } from "@/lib/rate-limit";

/**
 * Demande de réinitialisation de mot de passe — déléguée à Supabase Auth
 * (`resetPasswordForEmail`). Supabase envoie le lien (code PKCE) directement
 * par e-mail ; plus de jeton maison en base.
 * Réponse identique que le compte existe ou non (anti-énumération).
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const input = await readBody(req, forgotPasswordSchema);
    const ip = getClientIp(req);
    if (!rateLimit(`forgot:${ip}:${input.email}`, 3, 60 * 60 * 1000)) {
      throw new ApiError(429, `Trop de demandes. Réessayez dans ${retryAfter(`forgot:${ip}:${input.email}`)} secondes.`);
    }

    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      throw new ApiError(
        500,
        "Le service d'authentification n'est pas disponible. Veuillez réessayer plus tard."
      );
    }

    const { error } = await supabase.auth.resetPasswordForEmail(input.email);
    if (error) {
      const status = typeof error.status === "number" ? error.status : undefined;
      if (status === 429) {
        throw new ApiError(429, "Trop de tentatives. Réessayez dans quelques minutes.");
      }
      if (status !== undefined && status >= 500) {
        throw new ApiError(
          502,
          "Le service d'authentification est momentanément indisponible. Veuillez réessayer."
        );
      }
      // Tout autre échec (adresse inconnue, etc.) reste silencieux :
      // la réponse ne doit pas révéler l'existence du compte.
    }

    return jsonOk({
      ok: true,
      message:
        "Si un compte existe avec cette adresse, vous recevrez un lien de réinitialisation.",
      devResetToken: null,
    });
  });
}
