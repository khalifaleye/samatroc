import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";
import { isTestPayment, legacyPaymentStatus } from "@/lib/payments";

/** Historique des paiements de l'utilisateur */
export async function GET() {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");

    const payments = await db.payment.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            images: { take: 1, orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }] },
          },
        },
      },
    });

    // Format JSON historique conservé (l'UI React ne change pas) :
    // reference/provider/method/isTest/paidAt sont traduits depuis les
    // colonnes Supabase transaction_reference/payment_provider/payment_method/
    // confirmed_at (isTest = prestataire TEST).
    return jsonOk({
      payments: payments.map((p) => ({
        reference: p.transactionReference,
        amount: p.amount,
        status: legacyPaymentStatus(p.status),
        provider: p.paymentProvider,
        method: p.paymentMethod,
        isTest: isTestPayment(p.paymentProvider),
        createdAt: p.createdAt.toISOString(),
        paidAt: p.confirmedAt?.toISOString() ?? null,
        listing: p.listing
          ? {
              id: p.listing.id,
              title: p.listing.title,
              images: p.listing.images.map((i) => ({ url: i.imageUrl, isPrimary: i.isPrimary })),
            }
          : null,
      })),
    });
  });
}
