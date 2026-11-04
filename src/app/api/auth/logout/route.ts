import { getSupabaseServerClient } from "@/lib/supabase/server";
import { handleRoute, jsonOk } from "@/lib/api-utils";

/**
 * Déconnexion — déléguée à Supabase Auth (`signOut`).
 * Les cookies de session (access + refresh tokens) sont purgés par le client
 * @supabase/ssr. La déconnexion est idempotente : elle répond toujours `{ ok: true }`.
 */
export async function POST() {
  return handleRoute(async () => {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    return jsonOk({ ok: true });
  });
}
