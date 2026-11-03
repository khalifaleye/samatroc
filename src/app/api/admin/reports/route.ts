import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, requireAdmin, jsonOk } from "@/lib/api-utils";

/** Liste des signalements */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const status = req.nextUrl.searchParams.get("status") || "";
    const where: Record<string, unknown> = status ? { status } : {};

    const reports = await db.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true } },
        handledBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Aperçu de la cible
    const enriched = await Promise.all(
      reports.map(async (r) => {
        let targetPreview: string | null = null;
        let targetUrl: string | null = null;
        try {
          if (r.targetType === "LISTING") {
            const l = await db.listing.findUnique({
              where: { id: r.targetId },
              select: { title: true },
            });
            targetPreview = l?.title ?? "(annonce supprimée)";
            targetUrl = l ? `listing:${r.targetId}` : null;
          } else if (r.targetType === "USER") {
            const u = await db.user.findUnique({
              where: { id: r.targetId },
              select: { firstName: true, lastName: true, email: true },
            });
            targetPreview = u ? `${u.firstName} ${u.lastName} (${u.email})` : "(utilisateur supprimé)";
            targetUrl = u ? `user:${r.targetId}` : null;
          } else if (r.targetType === "MESSAGE") {
            const m = await db.message.findUnique({
              where: { id: r.targetId },
              select: { content: true },
            });
            targetPreview = m?.content?.slice(0, 120) ?? "(message supprimé)";
          }
        } catch {
          targetPreview = null;
        }
        return {
          id: r.id,
          targetType: r.targetType,
          targetId: r.targetId,
          targetPreview,
          targetUrl,
          reason: r.reason,
          details: r.details,
          status: r.status,
          resolution: r.resolution,
          createdAt: r.createdAt.toISOString(),
          reporter: `${r.reporter.firstName} ${r.reporter.lastName}`,
          handledBy: r.handledBy ? `${r.handledBy.firstName} ${r.handledBy.lastName}` : null,
        };
      })
    );

    return jsonOk({ reports: enriched });
  });
}
