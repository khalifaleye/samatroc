import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, requireAdmin, ApiError, jsonOk } from "@/lib/api-utils";

/** Toutes les catégories (avec inactives) */
export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    const categories = await db.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { listings: true } }, children: true },
    });
    return jsonOk({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        color: c.color,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        parentId: c.parentId,
        listingsCount: c._count.listings,
        childrenCount: c.children.length,
      })),
    });
  });
}

/** Création d'une catégorie */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (name.length < 2) throw new ApiError(400, "Nom requis (2 caractères minimum)");

    const slug =
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || `cat-${Date.now()}`;

    const exists = await db.category.findUnique({ where: { slug } });
    const finalSlug = exists ? `${slug}-${Date.now().toString(36).slice(-4)}` : slug;

    const maxOrder = await db.category.aggregate({ _max: { sortOrder: true } });
    const category = await db.category.create({
      data: {
        name,
        slug: finalSlug,
        icon: String(body.icon ?? "package"),
        color: String(body.color ?? "#0e5c3d"),
        sortOrder: Number.isFinite(body.sortOrder) ? body.sortOrder : (maxOrder._max.sortOrder ?? 0) + 1,
        parentId: body.parentId || null,
      },
    });

    return jsonOk({ category }, 201);
  });
}
