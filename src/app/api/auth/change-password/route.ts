import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { handleRoute, readBody, requireAuth, ApiError, jsonOk } from "@/lib/api-utils";
import { changePasswordSchema } from "@/lib/validators";

/**
 * Changement de mot de passe (utilisateur connecté) — délégué à Supabase Auth.
 * • Le mot de passe actuel est revérifié par une reconnexion silencieuse
 *   (`signInWithPassword`) : l'équivalent de l'ancien `verifyPassword`.
 * • La mise à jour passe par `supabase.auth.updateUser({ password })`.
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const sessionUser = await requireAuth();
    const input = await readBody(req, changePasswordSchema);

    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      throw new ApiError(
        500,
        "Le service d'authentification n'est pas disponible. Veuillez réessayer plus tard."
      );
    }

    // Revérification du mot de passe actuel via Supabase Auth
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: sessionUser.email,
      password: input.currentPassword,
    });
    if (verifyError) {
      throw new ApiError(400, "Le mot de passe actuel est incorrect", {
        currentPassword: "Mot de passe incorrect",
      });
    }

    const { error } = await supabase.auth.updateUser({ password: input.newPassword });
    if (error) {
      throw new ApiError(
        400,
        "Impossible de modifier le mot de passe. Choisissez-en un autre et réessayez.",
        { newPassword: error.message }
      );
    }

    return jsonOk({ ok: true, message: "Mot de passe modifié avec succès." });
  });
}
