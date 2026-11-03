import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, requireAdmin, ApiError, jsonOk } from "@/lib/api-utils";

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
    if (body.color !== undefined) data.color = String(body.color);
    if (body.sortOrder !== undefined) data.sortOrder = parseInt(String(body.sortOrder), 10) || 0;
    if (body.isActive !== undefined) data.isActive = !!body.isActive;

    const updated = await db.category.update({ where: { id }, data });
    return jsonOk({ category: updated });
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
