import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handleRoute, requireAdmin, ApiError, jsonOk } from "@/lib/api-utils";
import { categoryColor } from "@/lib/serializers";

type AdminCategoryRow = Prisma.CategoryGetPayload<{
  include: { _count: { select: { listings: true } }; children: true };
}>;

const categoryInclude = {
  _count: { select: { listings: true } },
  children: true,
} satisfies Prisma.CategoryInclude;

/** Sérialisation admin identique à celle de la liste (color dérivée, displayOrder) */
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

/** Modification d'une catégorie */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();

    const category = await db.category.findUnique({ where: { id } });
    if (!category) throw new ApiError(404, "Catégorie introuvable");

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 2) throw new ApiError(400, "Nom trop court");
      data.name = name;
    }
    if (body.icon !== undefined) data.icon = String(body.icon);
    // Colonne `color` supprimée par la spec : la valeur choisie dans l'UI est
    // ignorée (palette dérivée du slug côté sérialisation).
    if (body.sortOrder !== undefined) {
      data.displayOrder = parseInt(String(body.sortOrder), 10) || 0;
    }
    if (body.isActive !== undefined) data.isActive = !!body.isActive;

    await db.category.update({ where: { id }, data });

    const updated = await db.category.findUnique({ where: { id }, include: categoryInclude });
    return jsonOk({ category: updated ? serializeAdminCategory(updated) : null });
  });
}

/** Suppression (impossible si des annonces y sont rattachées) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await params;

    const count = await db.listing.count({
      where: { OR: [{ categoryId: id }, { subcategoryId: id }] },
    });
    if (count > 0) {
      throw new ApiError(
        409,
        `${count} annonce(s) utilisent cette catégorie. Désactivez-la plutôt que de la supprimer.`
      );
    }

    const children = await db.category.count({ where: { parentId: id } });
    if (children > 0) {
      throw new ApiError(409, "Cette catégorie contient des sous-catégories.");
    }

    await db.category.delete({ where: { id } });
    return jsonOk({ ok: true, message: "Catégorie supprimée" });
  });
}
