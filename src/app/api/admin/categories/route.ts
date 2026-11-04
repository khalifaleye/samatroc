import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handleRoute, requireAdmin, ApiError, jsonOk } from "@/lib/api-utils";
import { categoryColor } from "@/lib/serializers";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminCategoryRow = Prisma.CategoryGetPayload<{
  include: { _count: { select: { listings: true } }; children: true };
}>;

/**
 * Sérialisation admin des catégories — contrat des vues inchangé :
 * la table Supabase n'a plus de colonne `color` (palette dérivée du slug via
 * categoryColor) ni `sortOrder` (→ displayOrder).
 */
function serializeAdminCategory(c: AdminCategoryRow) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon ?? "package",
    color: categoryColor(c.slug),
    sortOrder: c.displayOrder,
    isActive: c.isActive,
    parentId: c.parentId,
    listingsCount: c._count.listings,
    childrenCount: c.children.length,
  };
}

const categoryInclude = {
  _count: { select: { listings: true } },
  children: true,
} satisfies Prisma.CategoryInclude;

/** Toutes les catégories (avec inactives) */
export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    const categories = await db.category.findMany({
      orderBy: { displayOrder: "asc" },
      include: categoryInclude,
    });
    return jsonOk({
      categories: categories.map(serializeAdminCategory),
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

    // La couleur choisie dans l'UI n'est pas stockée (colonne supprimée) :
    // elle sera restituée par la palette par défaut côté sérialisation.
    const maxOrder = await db.category.aggregate({ _max: { displayOrder: true } });
    const category = await db.category.create({
      data: {
        name,
        slug: finalSlug,
        icon: String(body.icon ?? "package"),
        displayOrder: Number.isFinite(body.sortOrder)
          ? Number(body.sortOrder)
          : (maxOrder._max?.displayOrder ?? 0) + 1,
        parentId:
          typeof body.parentId === "string" && UUID_RE.test(body.parentId)
            ? body.parentId
            : null,
      },
    });

    const created = await db.category.findUnique({
      where: { id: category.id },
      include: categoryInclude,
    });
    return jsonOk({ category: created ? serializeAdminCategory(created) : null }, 201);
  });
}
