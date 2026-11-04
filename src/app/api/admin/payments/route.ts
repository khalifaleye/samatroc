import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handleRoute, requireAdmin, jsonOk, escapeLike } from "@/lib/api-utils";
import { splitFullName } from "@/lib/auth";
import { dbPaymentStatus, isTestPayment, legacyPaymentStatus } from "@/lib/payments";

/** Gestion des paiements (aucun secret de paiement exposé) */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim() || "";
    const status = sp.get("status") || "";
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const pageSize = 20;

    const where: Prisma.PaymentWhereInput = {};
    if (q) where.transactionReference = { contains: `%${escapeLike(q)}%` };
    if (status) {
      // Les vues filtrent avec le vocabulaire historique (SUCCESS, EXPIRED…) :
      // traduction vers l'enum base (SUCCESSFUL, CANCELLED…) — statut inconnu
      // → aucun résultat plutôt qu'une erreur SQL.
      const dbStatus = dbPaymentStatus(status);
      where.status = dbStatus ?? { in: [] };
    }

    const [total, paymentsRaw, revenueAgg] = await Promise.all([
      db.payment.count({ where }),
      db.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { fullName: true, email: true } },
          listing: { select: { id: true, title: true } },
        },
      }),
      db.payment.aggregate({ where: { status: "SUCCESSFUL" }, _sum: { amount: true } }),
    ]);

    return jsonOk({
      payments: paymentsRaw.map((p) => {
        const { firstName, lastName } = splitFullName(p.user.fullName);
        return {
          reference: p.transactionReference,
          amount: p.amount,
          status: legacyPaymentStatus(p.status),
          provider: p.paymentProvider,
          method: p.paymentMethod,
          isTest: isTestPayment(p.paymentProvider),
          // Colonne démo `phone` supprimée par la spec (l'UI ne l'affiche pas)
          phone: null,
          createdAt: p.createdAt.toISOString(),
          paidAt: p.confirmedAt?.toISOString() ?? null,
          user: { name: `${firstName} ${lastName}`.trim(), email: p.user.email },
          listing: p.listing ? { id: p.listing.id, title: p.listing.title } : null,
        };
      }),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      revenue: revenueAgg._sum?.amount ?? 0,
    });
  });
}
