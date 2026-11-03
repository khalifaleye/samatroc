import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, requireAdmin, jsonOk } from "@/lib/api-utils";

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
        include: { admin: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    return jsonOk({
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        details: l.details,
        createdAt: l.createdAt.toISOString(),
        admin: `${l.admin.firstName} ${l.admin.lastName}`,
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  });
}
