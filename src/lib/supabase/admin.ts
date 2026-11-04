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
import { db } from "@/lib/db";

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
 * Confirme un paiement via la fonction SQL `public.verify_payment`
 * (signature vérifiée dans supabase/migrations/20260101000002_functions.sql :
 * (p_transaction_reference text, p_provider_transaction_id text,
 *  p_success boolean, p_amount_received bigint, p_currency text) → text).
 * Idempotente : vérifie référence, montant et devise avant activation de
 * l'annonce (publish_listing). Verdict : CONFIRMED | ALREADY_CONFIRMED |
 * PAYMENT_FAILED | AMOUNT_MISMATCH | CURRENCY_MISMATCH | NOT_CONFIRMABLE |
 * PAYMENT_NOT_FOUND.
 *
 * Chemin privilégié : rpc service_role (fonction réservée à ce rôle).
 * Repli : la même fonction SQL via la connexion PostgreSQL de confiance
 * (Prisma, rôle postgres — propriétaire de la fonction) quand la clé
 * service_role n'est pas configurée.
 */
export async function verifyPaymentServerSide(params: {
  transactionReference: string;
  providerTransactionId?: string;
  success: boolean;
  amountReceived?: number;
  currency?: string;
}): Promise<string> {
  // p_amount_received est un bigint SQL (montants FCFA entiers) : on coerce
  // le montant reçu du prestataire en entier sûr sur les deux chemins.
  const amountReceived =
    typeof params.amountReceived === "number" && Number.isFinite(params.amountReceived)
      ? Math.round(params.amountReceived)
      : null;

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    // Signature EXACTE de la migration (20260101000002_functions.sql) et des
    // types générés (database.types.ts > Functions.verify_payment) :
    // (p_transaction_reference text, p_provider_transaction_id text,
    //  p_success boolean, p_amount_received bigint, p_currency text) → text
    const { data, error } = await supabase.rpc("verify_payment", {
      p_transaction_reference: params.transactionReference,
      p_provider_transaction_id: params.providerTransactionId ?? null,
      p_success: params.success,
      p_amount_received: amountReceived,
      p_currency: params.currency ?? null,
    });
    if (!error && typeof data === "string") return data;
    if (error) {
      console.error("[verify_payment] rpc service_role :", error.message);
    }
  }

  // Repli backend de confiance : même fonction SQL, mêmes garanties
  // transactionnelles (rôle postgres = propriétaire de la fonction).
  const rows = await db.$queryRaw<{ verdict: string }[]>`
    select public.verify_payment(
      ${params.transactionReference}::text,
      ${params.providerTransactionId ?? null}::text,
      ${params.success}::boolean,
      ${amountReceived}::bigint,
      ${params.currency ?? null}::text
    ) as verdict`;
  return rows[0]?.verdict ?? "PAYMENT_NOT_FOUND";
}
