/**
 * Client Supabase NAVIGATEUR (frontend)
 * --------------------------------------
 * Utilise la clé publique (anon) — exposée volontairement : la sécurité est
 * garantie par les politiques RLS, jamais par la secretivité de cette clé.
 *
 * ⚠️ Ne jamais importer ce fichier côté serveur, et n'y placer JAMAIS
 *    SUPABASE_SERVICE_ROLE_KEY.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Client unique côté navigateur (singleton) — null si non configuré. */
export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
