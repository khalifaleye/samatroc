import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { finalizePayment } from "@/lib/payments";
import { z } from "zod";

/**
 * CONFIRMATION EN MODE TEST UNIQUEMENT.
 * Active si PAYMENT_MODE != "LIVE" ou si les clés prestataires sont absentes.
 * Permet de tester le flux complet (initiation → confirmation serveur → activation)
 * sans simuler un vrai paiement : le mode test est clairement identifié dans toute l'UI.
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");

    const mode = process.env.PAYMENT_MODE === "LIVE" ? "LIVE" : "TEST";
    const liveConfigured = !!process.env.PAYMENT_API_KEY && !!process.env.PAYMENT_WEBHOOK_SECRET;
    if (mode === "LIVE" && liveConfigured) {
      throw new ApiError(
        403,
        "La plateforme est en mode LIVE : la simulation est désactivée. La confirmation doit venir du webhook du prestataire."
      );
    }

    const { reference } = await readBody(req, z.object({ reference: z.string().min(5) }));

    const payment = await db.payment.findUnique({ where: { transactionReference: reference } });
    if (!payment) throw new ApiError(404, "Transaction introuvable");
    if (payment.userId !== session.id) throw new ApiError(403, "Action non autorisée");
    // Bascule Supabase : une transaction de test porte le prestataire TEST
    if (payment.paymentProvider !== "TEST") {
      throw new ApiError(409, "Cette transaction n'est pas une transaction de test");
    }

    const result = await finalizePayment(reference, "SUCCESS", `TEST-${Date.now()}`);
    if (!result.ok && result.error === "TRANSACTION_NOT_FOUND") {
      throw new ApiError(404, "Transaction introuvable");
    }
    if (!result.ok) {
      throw new ApiError(
        409,
        "Cette transaction ne peut plus être confirmée (déjà traitée ou refusée)."
      );
    }

    return jsonOk({
      ok: true,
      listingStatus: result.listingStatus,
      message:
        result.listingStatus === "PUBLISHED"
          ? "Paiement de test confirmé : votre annonce est en ligne."
          : result.listingStatus === "PENDING_MODERATION"
            ? "Paiement de test confirmé : votre annonce attend la validation de la modération."
            : "Paiement de test confirmé.",
    });
  });
}
