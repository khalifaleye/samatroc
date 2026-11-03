import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, requireAdmin, jsonOk, escapeLike } from "@/lib/api-utils";
import { listingInclude, serializeListing, getPublicationFee } from "@/lib/serializers";

/** Liste complète des annonces avec filtres (administration) */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim() || "";
    const status = sp.get("status") || "";
    const category = sp.get("category") || "";
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const pageSize = 20;

    const where: Record<string, unknown> = {};
    if (q) {
      const like = `%${escapeLike(q)}%`;
      where.OR = [
        { title: { contains: like } },
        { description: { contains: like } },
        { reference: { contains: like } },
      ];
    }
    if (status) where.status = status;
    if (category) where.categoryId = category;

    const [total, listingsRaw] = await Promise.all([
      db.listing.count({ where }),
      db.listing.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { ...listingInclude, user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } } },
      }),
    ]);

    const fee = await getPublicationFee();
    return jsonOk({
      listings: listingsRaw.map((l) => ({
        ...serializeListing(l, false, fee),
        owner: {
          id: l.user.id,
          firstName: l.user.firstName,
          lastName: l.user.lastName,
          email: l.user.email,
          avatarUrl: l.user.avatarUrl,
        },
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  });
}
