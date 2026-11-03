/**
 * Client Supabase SERVEUR (Server Components, Route Handlers, Server Actions)
 * ---------------------------------------------------------------------------
 * Utilise la clé anon + les cookies de session de l'utilisateur : les requêtes
 * sont exécutées AVEC l'identité de l'utilisateur → les politiques RLS
 * s'appliquent intégralement.
 *
 * Pour les opérations de backend de confiance (webhooks paiement, modération),
 * utiliser admin.ts (service_role) — jamais ce client.
 */
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Client serveur lié à la session courante (cookie HTTP).
 * Le rafraîchissement des jetons est géré par src/middleware.ts.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient<Database> | null> {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Appelé depuis un Server Component : le middleware rafraîchira
            // la session avant que le navigateur ne la reçoive.
          }
        },
      },
    }
  );
}

/** Retourne l'utilisateur Supabase Auth connecté (ou null). */
export async function getSupabaseUser() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
