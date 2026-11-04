import { NextRequest } from "next/server";
import { Prisma, ReportStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { handleRoute, requireAdmin, jsonOk } from "@/lib/api-utils";

const REPORT_STATUSES: readonly string[] = ["PENDING", "RESOLVED", "DISMISSED"];

/**
 * Liste des signalements.
 * Bascule Supabase : les colonnes démo targetType/targetId/details/resolution/
 * handledBy n'existent plus — la cible est portée par listing_id /
 * reported_user_id, la note d'administration par admin_notes, l'auteur du
 * traitement reconstitué depuis admin_logs (fonction SQL resolve_report et
 * routes admin journalisent REPORT_RESOLVED / REPORT_DISMISSED avec
 * target_id = id du signalement). Le format de réponse des vues est conservé.
 */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const status = req.nextUrl.searchParams.get("status") || "";
    const where: Prisma.ReportWhereInput = {};
    if (status && REPORT_STATUSES.includes(status)) {
      where.status = status as ReportStatus;
    }

    const reports = await db.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { reporter: { select: { id: true, fullName: true } } },
    });

    // Dernier admin ayant traité chaque signalement (une seule requête)
    const reportIds = reports.map((r) => r.id);
    const logs = reportIds.length
      ? await db.adminLog.findMany({
          where: {
            action: { in: ["REPORT_RESOLVED", "REPORT_DISMISSED"] },
            targetId: { in: reportIds },
          },
          include: { admin: { select: { fullName: true } } },
          orderBy: { createdAt: "desc" },
        })
      : [];
    const handledByMap = new Map<string, string>();
    for (const log of logs) {
      if (log.targetId && !handledByMap.has(log.targetId)) {
        handledByMap.set(log.targetId, log.admin.fullName);
      }
    }

    // Aperçu de la cible
    const enriched = await Promise.all(
      reports.map(async (r) => {
        let targetType: string | null = null;
        let targetId: string | null = null;
        let targetPreview: string | null = null;
        let targetUrl: string | null = null;
        try {
          if (r.listingId) {
            targetType = "LISTING";
            targetId = r.listingId;
            const l = await db.listing.findUnique({
              where: { id: r.listingId },
              select: { title: true },
            });
            targetPreview = l?.title ?? "(annonce supprimée)";
            targetUrl = l ? `listing:${r.listingId}` : null;
          } else if (r.reportedUserId) {
            targetType = "USER";
            targetId = r.reportedUserId;
            const u = await db.profile.findUnique({
              where: { id: r.reportedUserId },
              select: { fullName: true, email: true },
            });
            targetPreview = u ? `${u.fullName} (${u.email})` : "(utilisateur supprimé)";
            targetUrl = u ? `user:${r.reportedUserId}` : null;
          }
        } catch {
          targetPreview = null;
        }
        return {
          id: r.id,
          targetType,
          targetId,
          targetPreview,
          targetUrl,
          reason: r.reason,
          // details → description, resolution → admin_notes
          details: r.description,
          status: r.status,
          resolution: r.adminNotes,
          createdAt: r.createdAt.toISOString(),
          reporter: r.reporter.fullName,
          handledBy: handledByMap.get(r.id) ?? null,
        };
      })
    );

    return jsonOk({ reports: enriched });
  });
}
