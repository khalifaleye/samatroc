import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, requireAdmin, jsonOk, escapeLike } from "@/lib/api-utils";

/** Liste et recherche des utilisateurs (administration) */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim() || "";
    const status = sp.get("status") || "";
    const role = sp.get("role") || "";
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const pageSize = 20;

    const where: Record<string, unknown> = {};
    if (q) {
      const like = `%${escapeLike(q)}%`;
      where.OR = [
        { firstName: { contains: like } },
        { lastName: { contains: like } },
        { email: { contains: like } },
        { phone: { contains: like } },
      ];
    }
    if (status) where.status = status;
    if (role) where.role = role;

    const [total, usersRaw] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { listings: true } },
        },
      }),
    ]);

    return jsonOk({
      users: usersRaw.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        city: u.city,
        role: u.role,
        status: u.status,
        emailVerified: u.emailVerified,
        isDemo: u.isDemo,
        createdAt: u.createdAt.toISOString(),
        listingsCount: u._count.listings,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  });
}
