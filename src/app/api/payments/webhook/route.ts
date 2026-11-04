import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";
import { finalizePayment } from "@/lib/payments";
import { z } from "zod";

/**
 * Webhook prestataire de paiement (confirmation serveur obligatoire).
 * Sécurité : signature HMAC-SHA256 du corps brut via PAYMENT_WEBHOOK_SECRET.
 * L'annonce n'est JAMAIS activée sur la seule base d'une redirection navigateur.
 * La confirmation passe par la fonction SQL verify_payment (idempotente,
 * contrôle référence / montant / devise) via le backend de confiance.
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const rawBody = await req.text();
    const signature = req.headers.get("x-samatroc-signature") ?? "";

    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) {
      throw new ApiError(503, "Webhook non configuré : PAYMENT_WEBHOOK_SECRET manquant");
    }

    const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    const expectedBuf = Buffer.from(expected, "utf8");
    const receivedBuf = Buffer.from(signature, "utf8");
    if (
      receivedBuf.length !== expectedBuf.length ||
      !timingSafeEqual(receivedBuf, expectedBuf)
    ) {
      throw new ApiError(401, "Signature webhook invalide");
    }

    // Contrat historique conservé (reference / status / providerRef) ; les
    // champs amount / currency sont optionnels et transmis à verify_payment
    // pour le contrôle du montant et de la devise côté base.
    const parsed = z
      .object({
        reference: z.string().min(5),
        status: z.enum(["SUCCESS", "FAILED"]),
        providerRef: z.string().optional(),
        amount: z.number().optional(),
        currency: z.string().optional(),
      })
      .parse(JSON.parse(rawBody));

    const result = await finalizePayment(
      parsed.reference,
      parsed.status,
      parsed.providerRef,
      parsed.amount,
      parsed.currency
    );
    if (!result.ok && result.error === "TRANSACTION_NOT_FOUND") {
      throw new ApiError(404, "Transaction introuvable");
    }

    return jsonOk({ received: true });
  });
}
