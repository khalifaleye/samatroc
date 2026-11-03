import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, requireAdmin, jsonOk, escapeLike } from "@/lib/api-utils";

/** Gestion des paiements (aucun secret de paiement exposé) */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim() || "";
    const status = sp.get("status") || "";
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const pageSize = 20;

    const where: Record<string, unknown> = {};
    if (q) where.reference = { contains: `%${escapeLike(q)}%` };
    if (status) where.status = status;

    const [total, paymentsRaw, revenueAgg] = await Promise.all([
      db.payment.count({ where }),
      db.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          listing: { select: { id: true, title: true } },
        },
      }),
      db.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
    ]);

    return jsonOk({
      payments: paymentsRaw.map((p) => ({
        reference: p.reference,
        amount: p.amount,
        status: p.status,
        provider: p.provider,
        method: p.method,
        isTest: p.isTest,
        phone: p.phone,
        createdAt: p.createdAt.toISOString(),
        paidAt: p.paidAt?.toISOString() ?? null,
        user: p.user ? { name: `${p.user.firstName} ${p.user.lastName}`, email: p.user.email } : null,
        listing: p.listing ? { id: p.listing.id, title: p.listing.title } : null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      revenue: revenueAgg._sum.amount ?? 0,
    });
  });
}
