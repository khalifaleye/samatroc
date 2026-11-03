import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";

/** Statut d'une transaction (polling client) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    const { reference } = await params;

    const payment = await db.payment.findUnique({
      where: { reference },
      include: { listing: { select: { id: true, status: true } } },
    });
    if (!payment) throw new ApiError(404, "Transaction introuvable");
    if (payment.userId !== session.id && session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      throw new ApiError(403, "Accès interdit");
    }

    return jsonOk({
      payment: {
        reference: payment.reference,
        amount: payment.amount,
        status: payment.status,
        provider: payment.provider,
        isTest: payment.isTest,
        listingId: payment.listingId,
        listingStatus: payment.listing?.status ?? null,
        paidAt: payment.paidAt?.toISOString() ?? null,
      },
    });
  });
}
