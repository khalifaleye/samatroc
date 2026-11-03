import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";

/** Historique des paiements de l'utilisateur */
export async function GET() {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");

    const payments = await db.payment.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      include: {
        listing: { select: { id: true, title: true, images: { take: 1, orderBy: { sortOrder: "asc" } } } },
      },
    });

    return jsonOk({
      payments: payments.map((p) => ({
        reference: p.reference,
        amount: p.amount,
        status: p.status,
        provider: p.provider,
        method: p.method,
        isTest: p.isTest,
        createdAt: p.createdAt.toISOString(),
        paidAt: p.paidAt?.toISOString() ?? null,
        listing: p.listing
          ? {
              id: p.listing.id,
              title: p.listing.title,
              images: p.listing.images.map((i) => ({ url: i.url, isPrimary: i.isPrimary })),
            }
          : null,
      })),
    });
  });
}
