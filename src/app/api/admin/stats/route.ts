import { db } from "@/lib/db";
import { handleRoute, requireAdmin, jsonOk } from "@/lib/api-utils";
import { legacyListingStatus, legacyPaymentStatus, isTestPayment } from "@/lib/payments";

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
      db.profile.count(),
      db.profile.count({ where: { createdAt: { gte: weekAgo } } }),
      db.profile.count({ where: { accountStatus: "SUSPENDED" } }),
      db.listing.count({ where: { status: "PUBLISHED" } }),
      db.listing.count({ where: { status: "PENDING_REVIEW" } }),
      db.listing.count({ where: { status: "PENDING_PAYMENT" } }),
      db.listing.count({ where: { status: "REJECTED" } }),
      db.listing.count({ where: { status: "EXCHANGED" } }),
      db.listing.count(),
      db.payment.count({ where: { status: "SUCCESSFUL" } }),
      db.payment.aggregate({ where: { status: "SUCCESSFUL" }, _sum: { amount: true } }),
      db.payment.count({ where: { status: "SUCCESSFUL", paymentProvider: "TEST" } }),
      db.exchangeProposal.count(),
      db.exchangeProposal.count({ where: { status: "COMPLETED" } }),
      db.report.count({ where: { status: "PENDING" } }),
    ]);

    const [recentPayments, recentReports, recentLogs] = await Promise.all([
      db.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          user: { select: { fullName: true } },
          listing: { select: { title: true } },
        },
      }),
      db.report.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { reporter: { select: { fullName: true } } },
      }),
      db.adminLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { admin: { select: { fullName: true } } },
      }),
    ]);

    // Format JSON historique conservé (vues admin inchangées) : statuts
    // traduits vers le vocabulaire des vues (SUCCESS, PENDING_MODERATION…),
    // fullName unique affiché tel quel (équivalent « prénom nom »).
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
        revenue: paymentsRevenueAgg._sum?.amount ?? 0,
        test: paymentsTest,
      },
      proposals: { total: proposalsTotal, completed: proposalsCompleted },
      reports: { pending: reportsPending },
      recentPayments: recentPayments.map((p) => ({
        reference: p.transactionReference,
        amount: p.amount,
        status: legacyPaymentStatus(p.status),
        provider: p.paymentProvider,
        isTest: isTestPayment(p.paymentProvider),
        createdAt: p.createdAt.toISOString(),
        user: p.user?.fullName ?? "—",
        listingTitle: p.listing?.title ?? "—",
      })),
      recentReports: recentReports.map((r) => ({
        id: r.id,
        // Spec Supabase : la cible est portée par listing_id / reported_user_id
        targetType: r.listingId ? "LISTING" : r.reportedUserId ? "USER" : null,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
        reporter: r.reporter.fullName,
      })),
      recentLogs: recentLogs.map((l) => ({
        id: l.id,
        action: l.action,
        targetType: l.targetType,
        // admin_logs.details est jsonb : les fonctions SQL y stockent des
        // objets — normalisé en chaîne pour le contrat des vues (string | null).
        details:
          l.details === null || l.details === undefined
            ? null
            : typeof l.details === "string"
              ? l.details
              : JSON.stringify(l.details),
        createdAt: l.createdAt.toISOString(),
        admin: l.admin.fullName,
      })),
    });
  });
}
