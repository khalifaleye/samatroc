import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, requireAdmin, jsonOk, escapeLike } from "@/lib/api-utils";
import { splitFullName } from "@/lib/auth";
import { lookupConfirmedEmails } from "@/lib/admin-helpers";

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
      // Bascule Supabase : le nom complet est une colonne unique (full_name)
      where.OR = [
        { fullName: { contains: like, mode: "insensitive" } },
        { email: { contains: like, mode: "insensitive" } },
        { phone: { contains: like, mode: "insensitive" } },
      ];
    }
    if (status) where.accountStatus = status;
    if (role) where.role = role;

    const [total, usersRaw] = await Promise.all([
      db.profile.count({ where }),
      db.profile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { listings: true } },
        },
      }),
    ]);

    // emailVerified vit dans auth.users (email_confirmed_at) — une requête pour la page
    const verified = await lookupConfirmedEmails(usersRaw.map((u) => u.id));

    return jsonOk({
      users: usersRaw.map((u) => {
        const { firstName, lastName } = splitFullName(u.fullName);
        return {
          id: u.id,
          firstName,
          lastName,
          email: u.email,
          phone: u.phone,
          city: u.city,
          role: u.role,
          status: u.accountStatus,
          emailVerified: verified.has(u.id),
          // Flag démo disparu avec la bascule (aucun compte factice en production)
          isDemo: false,
          createdAt: u.createdAt.toISOString(),
          listingsCount: u._count.listings,
        };
      }),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  });
}
