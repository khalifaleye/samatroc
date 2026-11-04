import { NextRequest } from "next/server";
import { extractSupabaseCode } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { z } from "zod";

/**
 * Vérification de l'adresse e-mail — déléguée à Supabase Auth.
 * Le « token » est le code PKCE du lien de confirmation envoyé par Supabase
 * (l'utilisateur colle le code, ou le lien complet). L'échange du code confirme
 * l'adresse (email_confirmed_at) côté Supabase Auth.
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const { token } = await readBody(req, z.object({ token: z.string().min(10) }));

    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      throw new ApiError(
        500,
        "Le service d'authentification n'est pas disponible. Veuillez réessayer plus tard."
      );
    }

    const code = extractSupabaseCode(token);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw new ApiError(400, "Lien de vérification invalide ou expiré.");
    }

    return jsonOk({ ok: true, message: "Votre adresse e-mail a été vérifiée avec succès." });
  });
}
