import { db } from "@/lib/db";
import { handleRoute, jsonOk } from "@/lib/api-utils";

/** Catégories publiques (actives, triées, avec nombre d'annonces publiées) */
export async function GET() {
  return handleRoute(async () => {
    const categories = await db.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { sortOrder: "asc" },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { listings: { where: { status: "PUBLISHED" } } } },
      },
    });

    return jsonOk({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        color: c.color,
        sortOrder: c.sortOrder,
        count: c._count.listings,
        children: c.children.map((ch) => ({
          id: ch.id,
          name: ch.name,
          slug: ch.slug,
          icon: ch.icon,
          color: ch.color,
        })),
      })),
    });
  });
}
