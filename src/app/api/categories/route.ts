import { db } from "@/lib/db";
import { handleRoute, jsonOk } from "@/lib/api-utils";
import { categoryColor } from "@/lib/serializers";

/**
 * Catégories publiques (actives, triées, avec nombre d'annonces publiées).
 * Arborescence : la table Supabase `categories` est un arbre (parent_id).
 * Compatibilité réponse : la colonne `color` n'existe plus (palette par défaut
 * par slug) et `display_order` continue d'être exposé sous le nom `sortOrder`.
 */
export async function GET() {
  return handleRoute(async () => {
    const categories = await db.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { displayOrder: "asc" },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
        },
        _count: { select: { listings: { where: { status: "PUBLISHED" } } } },
      },
    });

    return jsonOk({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon ?? "package",
        color: categoryColor(c.slug),
        sortOrder: c.displayOrder,
        count: c._count.listings,
        children: c.children.map((ch) => ({
          id: ch.id,
          name: ch.name,
          slug: ch.slug,
          icon: ch.icon ?? "package",
          color: categoryColor(ch.slug),
        })),
      })),
    });
  });
}
