import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, requireAdmin, jsonOk } from "@/lib/api-utils";

/**
 * Normalise admin_logs.details (jsonb — les fonctions SQL y stockent des
 * objets) vers le contrat des vues : string | null.
 */
function logDetailsToString(details: unknown): string | null {
  if (details === null || details === undefined) return null;
  return typeof details === "string" ? details : JSON.stringify(details);
}

/** Journal des actions administratives (traçabilité) */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = 30;

    const [total, logs] = await Promise.all([
      db.adminLog.count(),
      db.adminLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { admin: { select: { fullName: true } } },
      }),
    ]);

    return jsonOk({
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        details: logDetailsToString(l.details),
        createdAt: l.createdAt.toISOString(),
        admin: l.admin.fullName,
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  });
}
