import "server-only";
import { db } from "@/lib/db";
import { activateListingAfterPayment } from "@/lib/serializers";

/**
 * Finalisation serveur d'un paiement (jamais déclenchée par le navigateur seul).
 * À SUCCESS : paiement marqué, annonce activée selon modération, notifications.
 * À FAILED : paiement marqué échoué, annonce laissée en attente.
 */
export async function finalizePayment(
  reference: string,
  status: "SUCCESS" | "FAILED",
  providerRef?: string
): Promise<{ ok: boolean; listingStatus?: string; error?: string }> {
  const payment = await db.payment.findUnique({
    where: { reference },
    include: { listing: true },
  });
  if (!payment) return { ok: false, error: "TRANSACTION_NOT_FOUND" };

  // Prévention des doubles paiements / traitements répétés
  if (payment.status === "SUCCESS") {
    return { ok: true, listingStatus: payment.listing?.status ?? "PUBLISHED" };
  }
  if (payment.status === "REFUNDED") return { ok: false, error: "REFUNDED" };

  if (status === "FAILED") {
    await db.payment.update({
      where: { reference },
      data: { status: "FAILED", providerRef: providerRef ?? payment.providerRef },
    });
    return { ok: true, listingStatus: payment.listing?.status };
  }

  await db.payment.update({
    where: { reference },
    data: {
      status: "SUCCESS",
      paidAt: new Date(),
      providerRef: providerRef ?? payment.providerRef,
    },
  });

  let listingStatus = "NO_LISTING";
  if (payment.listingId) {
    const result = await activateListingAfterPayment(payment.listingId);
    listingStatus = result.status;

    // Notifications utilisateur
    await db.notification.create({
      data: {
        userId: payment.userId,
        type: "PAYMENT_CONFIRMED",
        title: "Paiement confirmé",
        body: `Votre paiement de ${payment.amount} FCFA (réf. ${payment.reference}) a été confirmé.`,
        linkView: "payments",
      },
    });
    if (listingStatus === "PUBLISHED") {
      await db.notification.create({
        data: {
          userId: payment.userId,
          type: "LISTING_PUBLISHED",
          title: "Annonce publiée",
          body: `Votre annonce « ${payment.listing?.title ?? ""} » est en ligne. Les propositions d'échange peuvent arriver !`,
          linkView: "my-listings",
        },
      });
    } else if (listingStatus === "PENDING_MODERATION") {
      await db.notification.create({
        data: {
          userId: payment.userId,
          type: "SYSTEM",
          title: "Annonce en cours de vérification",
          body: `Votre annonce « ${payment.listing?.title ?? ""} » est en attente de modération. Vous serez notifié après validation.`,
          linkView: "my-listings",
        },
      });
    }
  }

  return { ok: true, listingStatus };
}
