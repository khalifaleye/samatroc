import { NextRequest } from "next/server";
import { extractSupabaseCode } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { resetPasswordSchema } from "@/lib/validators";

const INVALID_RESET_MESSAGE =
  "Ce lien de réinitialisation est invalide ou expiré. Faites une nouvelle demande.";

/**
 * Réinitialisation effective du mot de passe — déléguée à Supabase Auth.
 * • Le « token » du formulaire est le code PKCE contenu dans le lien e-mail
 *   Supabase (l'utilisateur colle le code, ou le lien complet).
 * • `exchangeCodeForSession` ouvre la session de récupération, puis
 *   `updateUser({ password })` change le mot de passe.
 * • La session de récupération est purgée après : l'utilisateur se reconnecte
 *   avec son nouveau mot de passe (comportement identique à l'ancien flux).
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const input = await readBody(req, resetPasswordSchema);

    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      throw new ApiError(
        500,
        "Le service d'authentification n'est pas disponible. Veuillez réessayer plus tard."
      );
    }

    const code = extractSupabaseCode(input.token);
    if (!code) throw new ApiError(400, INVALID_RESET_MESSAGE);

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      // Le code peut avoir déjà été échangé côté navigateur (lien cliqué) :
      // dans ce cas la session de récupération est déjà présente dans les cookies.
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new ApiError(400, INVALID_RESET_MESSAGE);
    }

    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) {
      throw new ApiError(
        400,
        "Impossible de réinitialiser le mot de passe. Choisissez-en un autre et réessayez.",
        { password: error.message }
      );
    }

    await supabase.auth.signOut();

    return jsonOk({ ok: true, message: "Votre mot de passe a été réinitialisé avec succès." });
  });
}
