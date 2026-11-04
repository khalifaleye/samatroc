import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { paymentInitiateSchema } from "@/lib/validators";
import { generatePaymentReference, getPublicationFee } from "@/lib/serializers";
import { legacyPaymentStatus } from "@/lib/payments";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import type { Payment, PaymentProvider } from "@prisma/client";

/**
 * Initialisation d'un paiement de publication.
 * - Référence de transaction unique (générée par la base pour create_payment)
 * - Prévention des doubles paiements (idempotent sur PENDING)
 * - Création préférée via la fonction SQL `create_payment` (SECURITY DEFINER,
 *   JWT utilisateur : le propriétaire est vérifié en base), repli applicatif
 *   Prisma si le SDK/la fonction n'est pas disponible
 * - Aucun code PIN Mobile Money n'est jamais demandé ni stocké
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    const input = await readBody(req, paymentInitiateSchema);

    if (!rateLimit(`pay:${session.id}`, 10, 60 * 1000)) {
      throw new ApiError(429, "Trop de demandes de paiement. Patientez une minute.");
    }

    const listing = await db.listing.findUnique({ where: { id: input.listingId } });
    if (!listing || listing.userId !== session.id) {
      throw new ApiError(404, "Annonce introuvable");
    }
    if (listing.status === "PUBLISHED") {
      throw new ApiError(409, "Cette annonce est déjà publiée (paiement déjà confirmé)");
    }
    if (!["PENDING_PAYMENT", "DRAFT", "REJECTED"].includes(listing.status)) {
      throw new ApiError(409, "Cette annonce ne nécessite pas de paiement pour le moment");
    }

    const fee = await getPublicationFee();
    const mode = process.env.PAYMENT_MODE === "LIVE" ? "LIVE" : "TEST";
    const effectiveMode =
      mode === "LIVE" && process.env.PAYMENT_API_KEY && process.env.PAYMENT_WEBHOOK_SECRET
        ? "LIVE"
        : "TEST";

    // Mode test clairement identifié : la transaction porte le prestataire TEST
    // (aucun paiement réel n'est débité). En LIVE : prestataire choisi.
    const provider: PaymentProvider = effectiveMode === "TEST" ? "TEST" : input.provider;
    const method =
      input.provider === "WAVE" ? "Wave" : input.provider === "ORANGE_MONEY" ? "Orange Money" : "Test";

    // Idempotence : réutilise un paiement PENDING/PROCESSING existant pour cette annonce
    let payment: Payment | null = await db.payment.findFirst({
      where: { listingId: listing.id, status: { in: ["PENDING", "PROCESSING"] } },
      orderBy: { createdAt: "desc" },
    });

    if (!payment) {
      // 1) Fonction SQL create_payment (auth.uid() = propriétaire via cookies)
      const supabase = await getSupabaseServerClient();
      if (supabase) {
        // Aligne le frais facturé (snapshot annonce) sur le paramétrage
        // site_settings — comportement historique (fee lu par l'UI).
        if (listing.publicationFee !== fee) {
          await db.listing.update({
            where: { id: listing.id },
            data: { publicationFee: fee },
          });
        }
        try {
          const { data, error } = await supabase.rpc("create_payment", {
            p_listing_id: listing.id,
            p_provider: provider,
            p_method: method,
          });
          if (error) throw error;
          if (data?.transaction_reference) {
            payment = await db.payment.findUnique({
              where: { transactionReference: data.transaction_reference },
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes("ANNONCE_DEJA_PAYEE")) {
            throw new ApiError(409, "Cette annonce est déjà publiée (paiement déjà confirmé)");
          }
          if (message.includes("PAS_PROPRIETAIRE") || message.includes("ANNONCE_INTROUVABLE")) {
            throw new ApiError(404, "Annonce introuvable");
          }
          console.error("[payments/initiate] create_payment SQL :", message);
        }
      }

      // 2) Repli applicatif (backend de confiance) — mêmes règles que la SQL
      if (!payment) {
        payment = await db.payment.create({
          data: {
            transactionReference: generatePaymentReference(),
            userId: session.id,
            listingId: listing.id,
            amount: fee,
            paymentProvider: provider,
            paymentMethod: method,
            status: "PENDING",
          },
        });
      }
    }

    // publish_listing (SQL) n'active que les annonces en PENDING_PAYMENT
    await db.listing.update({
      where: { id: listing.id },
      data: { status: "PENDING_PAYMENT" },
    });

    // En production LIVE : appel ici au SDK du prestataire (Wave / OM via agrégateur)
    // avec redirection vers l'URL de paiement, puis confirmation par webhook signé.
    const instructions =
      effectiveMode === "TEST"
        ? `Mode test clairement identifié : aucun paiement réel n'est débité. Référence ${payment.transactionReference} — utilisez le bouton « Simuler la confirmation (mode test) » pour valider le flux serveur complet.`
        : `Suivez les instructions ${payment.paymentMethod ?? method} sur votre téléphone. Votre annonce sera activée dès confirmation du paiement par le serveur.`;

    return jsonOk(
      {
        payment: {
          reference: payment.transactionReference,
          amount: payment.amount,
          status: legacyPaymentStatus(payment.status),
          provider: payment.paymentProvider,
        },
        effectiveMode,
        instructions,
      },
      201
    );
  });
}
