import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { paymentInitiateSchema } from "@/lib/validators";
import { generatePaymentReference, getPublicationFee } from "@/lib/serializers";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Initialisation d'un paiement de publication.
 * - Référence de transaction unique
 * - Prévention des doubles paiements (idempotent sur PENDING)
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
    if (!["PENDING_PAYMENT", "DRAFT", "REFUSED"].includes(listing.status)) {
      throw new ApiError(409, "Cette annonce ne nécessite pas de paiement pour le moment");
    }

    const fee = await getPublicationFee();
    const mode = process.env.PAYMENT_MODE === "LIVE" ? "LIVE" : "TEST";
    const effectiveMode =
      mode === "LIVE" && process.env.PAYMENT_API_KEY && process.env.PAYMENT_WEBHOOK_SECRET
        ? "LIVE"
        : "TEST";

    // Idempotence : réutilise un paiement PENDING existant pour cette annonce
    let payment = await db.payment.findFirst({
      where: { listingId: listing.id, status: { in: ["PENDING", "PROCESSING"] } },
    });

    if (!payment) {
      payment = await db.payment.create({
        data: {
          reference: generatePaymentReference(),
          userId: session.id,
          listingId: listing.id,
          amount: fee,
          provider: input.provider,
          method: input.provider === "WAVE" ? "Wave" : input.provider === "ORANGE_MONEY" ? "Orange Money" : "Test",
          phone: input.phone || null,
          status: "PENDING",
          isTest: effectiveMode === "TEST",
        },
      });
    }

    await db.listing.update({
      where: { id: listing.id },
      data: { status: "PENDING_PAYMENT" },
    });

    // En production LIVE : appel ici au SDK du prestataire (Wave / OM via agrégateur)
    // avec redirection vers l'URL de paiement, puis confirmation par webhook signé.
    const instructions =
      effectiveMode === "TEST"
        ? `Mode test clairement identifié : aucun paiement réel n'est débité. Référence ${payment.reference} — utilisez le bouton « Simuler la confirmation (mode test) » pour valider le flux serveur complet.`
        : `Suivez les instructions ${payment.method} sur votre téléphone. Votre annonce sera activée dès confirmation du paiement par le serveur.`;

    return jsonOk(
      {
        payment: {
          reference: payment.reference,
          amount: payment.amount,
          status: payment.status,
          provider: payment.provider,
        },
        effectiveMode,
        instructions,
      },
      201
    );
  });
}
