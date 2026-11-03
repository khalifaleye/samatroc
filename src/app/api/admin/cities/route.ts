import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, requireAdmin, ApiError, jsonOk } from "@/lib/api-utils";

/** Gestion des villes (référentiel extensible) */
export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    const cities = await db.city.findMany({ orderBy: { name: "asc" } });
    return jsonOk({ cities });
  });
}

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (name.length < 2) throw new ApiError(400, "Nom de ville requis");

    const exists = await db.city.findUnique({ where: { name } });
    if (exists) throw new ApiError(409, "Cette ville existe déjà");

    const city = await db.city.create({
      data: { name, region: body.region ? String(body.region) : null },
    });
    return jsonOk({ city }, 201);
  });
}

export async function DELETE(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) throw new ApiError(400, "Identifiant requis");
    await db.city.delete({ where: { id } });
    return jsonOk({ ok: true, message: "Ville supprimée" });
  });
}
