import { db } from "@/lib/db";
import { handleRoute, requireAdmin, jsonOk } from "@/lib/api-utils";

/** Tableau de bord administrateur : indicateurs clés */
export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      usersTotal,
      usersNew7d,
      usersSuspended,
      listingsPublished,
      listingsPendingModeration,
      listingsPendingPayment,
      listingsRefused,
      listingsExchanged,
      listingsTotal,
      paymentsSuccess,
      paymentsRevenueAgg,
      paymentsTest,
      proposalsTotal,
      proposalsCompleted,
      reportsPending,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: weekAgo } } }),
      db.user.count({ where: { status: "SUSPENDED" } }),
      db.listing.count({ where: { status: "PUBLISHED" } }),
      db.listing.count({ where: { status: "PENDING_MODERATION" } }),
      db.listing.count({ where: { status: "PENDING_PAYMENT" } }),
      db.listing.count({ where: { status: "REFUSED" } }),
      db.listing.count({ where: { status: "EXCHANGED" } }),
      db.listing.count(),
      db.payment.count({ where: { status: "SUCCESS" } }),
      db.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
      db.payment.count({ where: { status: "SUCCESS", isTest: true } }),
      db.exchangeProposal.count(),
      db.exchangeProposal.count({ where: { status: "COMPLETED" } }),
      db.report.count({ where: { status: "PENDING" } }),
    ]);

    const [recentPayments, recentReports, recentLogs] = await Promise.all([
      db.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          user: { select: { firstName: true, lastName: true } },
          listing: { select: { title: true } },
        },
      }),
      db.report.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { reporter: { select: { firstName: true, lastName: true } } },
      }),
      db.adminLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { admin: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    return jsonOk({
      users: { total: usersTotal, new7d: usersNew7d, suspended: usersSuspended },
      listings: {
        published: listingsPublished,
        pendingModeration: listingsPendingModeration,
        pendingPayment: listingsPendingPayment,
        refused: listingsRefused,
        exchanged: listingsExchanged,
        total: listingsTotal,
      },
      payments: {
        success: paymentsSuccess,
        revenue: paymentsRevenueAgg._sum.amount ?? 0,
        test: paymentsTest,
      },
      proposals: { total: proposalsTotal, completed: proposalsCompleted },
      reports: { pending: reportsPending },
      recentPayments: recentPayments.map((p) => ({
        reference: p.reference,
        amount: p.amount,
        status: p.status,
        provider: p.provider,
        isTest: p.isTest,
        createdAt: p.createdAt.toISOString(),
        user: p.user ? `${p.user.firstName} ${p.user.lastName}` : "—",
        listingTitle: p.listing?.title ?? "—",
      })),
      recentReports: recentReports.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
        reporter: `${r.reporter.firstName} ${r.reporter.lastName}`,
      })),
      recentLogs: recentLogs.map((l) => ({
        id: l.id,
        action: l.action,
        targetType: l.targetType,
        details: l.details,
        createdAt: l.createdAt.toISOString(),
        admin: `${l.admin.firstName} ${l.admin.lastName}`,
      })),
    });
  });
}
