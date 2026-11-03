/**
 * Client Supabase ADMIN (service_role) — BACKEND DE CONFIANCE UNIQUEMENT
 * ----------------------------------------------------------------------
 * ⚠️⚠️⚠️  SÉCURITÉ CRITIQUE  ⚠️⚠️⚠️
 * Ce client contourne TOUTES les politiques RLS. Il ne doit JAMAIS :
 *   • être importé dans un composant client ("use client")
 *   • être utilisé pour exécuter une requête déclenchée directement par le
 *     navigateur sans validation serveur préalable
 *   • voir sa clé exposée (elle vit uniquement dans les variables
 *     d'environnement serveur : Vercel > Environment Variables > Server)
 *
 * Usages légitimes : confirmation de paiement (verify_payment), modération,
 * création du premier super administrateur, tâches planifiées.
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let admin: SupabaseClient<Database> | null = null;

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY !== ""
  );
}

/** Client service_role (singleton) — null si non configuré. */
export function getSupabaseAdminClient(): SupabaseClient<Database> | null {
  if (!isSupabaseAdminConfigured()) return null;
  if (!admin) {
    admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return admin;
}

/**
 * Confirme un paiement via la fonction SQL verify_payment (idempotente).
 * Vérifie référence, montant et devise avant activation de l'annonce.
 * Retourne le verdict : CONFIRMED | ALREADY_CONFIRMED | AMOUNT_MISMATCH | …
 */
export async function verifyPaymentServerSide(params: {
  transactionReference: string;
  providerTransactionId?: string;
  success: boolean;
  amountReceived?: number;
  currency?: string;
}): Promise<string> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

  const { data, error } = await supabase.rpc("verify_payment", {
    p_transaction_reference: params.transactionReference,
    p_provider_transaction_id: params.providerTransactionId ?? null,
    p_success: params.success,
    p_amount_received: params.amountReceived ?? null,
    p_currency: params.currency ?? null,
  });
  if (error) throw error;
  return data as string;
}
