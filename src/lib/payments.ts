import "server-only";
import { db } from "@/lib/db";
import { verifyPaymentServerSide } from "@/lib/supabase/admin";
import type { ListingStatus, PaymentProvider, PaymentStatus } from "@prisma/client";
import { LISTING_DB_STATUSES, listingStatusToApi, listingStatusToDb } from "@/lib/constants";

/**
 * Correspondance des statuts de PAIEMENT à la frontière API ⇄ base.
 * ---------------------------------------------------------------------------
 * La base Supabase porte l'enum de la spec (PaymentStatus.SUCCESSFUL…), tandis
 * que l'UI React historique compare des valeurs « démo » en dur (ex.
 * `payment.status === "SUCCESS"` dans les vues publish/payments). Les réponses
 * JSON gardent donc EXACTEMENT le format d'avant : ces helpers traduisent dans
 * les deux sens (sortie → valeurs historiques ; filtres/webhook → enums SQL).
 * NB : les statuts d'ANNONCE utilisent les traductions partagées
 * `listingStatusToApi` / `listingStatusToDb` (src/lib/constants.ts).
 */

const PAYMENT_STATUS_OUT: Record<PaymentStatus, string> = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  SUCCESSFUL: "SUCCESS",
  FAILED: "FAILED",
  CANCELLED: "EXPIRED",
  REFUNDED: "REFUNDED",
};

/** Enum base → valeur historique attendue par les vues. */
export function legacyPaymentStatus(status: PaymentStatus): string {
  return PAYMENT_STATUS_OUT[status] ?? status;
}

const PAYMENT_STATUS_IN: Record<string, PaymentStatus> = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  SUCCESS: "SUCCESSFUL",
  SUCCESSFUL: "SUCCESSFUL",
  FAILED: "FAILED",
  EXPIRED: "CANCELLED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
};

/** Valeur historique (filtre API/webhook) → enum base. */
export function dbPaymentStatus(legacy: string): PaymentStatus | undefined {
  return PAYMENT_STATUS_IN[legacy];
}

/** Enum base → statut d'annonce historique attendu par les vues. */
export function legacyListingStatus(status: ListingStatus): string {
  return listingStatusToApi(status);
}

/** Filtre de statut d'annonce (historique ou spec) → enum base. */
export function dbListingStatus(legacy: string): ListingStatus | undefined {
  const mapped = listingStatusToDb(legacy);
  return (LISTING_DB_STATUSES as readonly string[]).includes(mapped)
    ? (mapped as ListingStatus)
    : undefined;
}

/**
 * Un paiement est « de test » quand sa transaction a été ouverte avec le
 * prestataire TEST (mode test clairement identifié — aucun paiement réel).
 * La colonne démo `isTest` n'existe plus dans la spec Supabase.
 */
export function isTestPayment(provider: PaymentProvider): boolean {
  return provider === "TEST";
}

/**
 * Finalisation serveur d'un paiement (jamais déclenchée par le navigateur seul).
 * Délègue toute la logique transactionnelle à la fonction SQL
 * `public.verify_payment` (SECURITY DEFINER, réservée service_role/backend) :
 * idempotence, contrôle montant/devise, passage SUCCESSFUL, publication de
 * l'annonce (publish_listing) et notifications SQL.
 * À FAILED : paiement marqué échoué, annonce laissée en attente.
 * Le format de retour est inchangé (ok / listingStatus / error).
 */
export async function finalizePayment(
  reference: string,
  status: "SUCCESS" | "FAILED",
  providerRef?: string,
  amountReceived?: number,
  currency?: string
): Promise<{ ok: boolean; listingStatus?: string; error?: string }> {
  const payment = await db.payment.findUnique({
    where: { transactionReference: reference },
    include: { listing: { select: { status: true } } },
  });
  if (!payment) return { ok: false, error: "TRANSACTION_NOT_FOUND" };

  // Prévention des doubles paiements / traitements répétés (idempotence)
  if (payment.status === "SUCCESSFUL") {
    return {
      ok: true,
      listingStatus: payment.listing ? legacyListingStatus(payment.listing.status) : "PUBLISHED",
    };
  }
  if (payment.status === "REFUNDED") return { ok: false, error: "REFUNDED" };

  let verdict: string;
  try {
    verdict = await verifyPaymentServerSide({
      transactionReference: reference,
      providerTransactionId: providerRef,
      success: status === "SUCCESS",
      amountReceived,
      currency,
    });
  } catch (error) {
    console.error("[finalizePayment] verify_payment indisponible :", error);
    return { ok: false, error: "VERIFY_UNAVAILABLE" };
  }

  if (verdict === "PAYMENT_NOT_FOUND") return { ok: false, error: "TRANSACTION_NOT_FOUND" };
  if (verdict === "AMOUNT_MISMATCH") return { ok: false, error: "AMOUNT_MISMATCH" };
  if (verdict === "CURRENCY_MISMATCH") return { ok: false, error: "CURRENCY_MISMATCH" };
  if (verdict === "NOT_CONFIRMABLE") return { ok: false, error: "NOT_CONFIRMABLE" };

  // PAYMENT_FAILED : la base a bien marqué le paiement échoué (+ notification
  // SQL) → le traitement est un succès pour le prestataire.
  if (verdict === "PAYMENT_FAILED") {
    return {
      ok: true,
      listingStatus: payment.listing ? legacyListingStatus(payment.listing.status) : undefined,
    };
  }

  // CONFIRMED : notification de confirmation applicative (la publication et sa
  // notification LISTING_PUBLISHED sont déjà gérées par la fonction SQL).
  if (verdict === "CONFIRMED") {
    await db.notification.create({
      data: {
        userId: payment.userId,
        type: "PAYMENT_CONFIRMED",
        title: "Paiement confirmé",
        message: `Votre paiement de ${payment.amount} FCFA (réf. ${payment.transactionReference}) a été confirmé.`,
        relatedId: payment.listingId,
      },
    });
  }
  // ALREADY_CONFIRMED : rien à refaire (idempotence du webhook).

  // État réel de l'annonce après passage de la fonction SQL
  let listingStatus = "NO_LISTING";
  if (payment.listingId) {
    const listing = await db.listing.findUnique({
      where: { id: payment.listingId },
      select: { status: true },
    });
    listingStatus = listing
      ? legacyListingStatus(listing.status)
      : verdict === "ALREADY_CONFIRMED"
        ? "PUBLISHED"
        : "UNKNOWN";
  }

  return { ok: true, listingStatus };
}
