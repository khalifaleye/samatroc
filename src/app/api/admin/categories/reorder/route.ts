import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, readBody, requireAdmin, jsonOk } from "@/lib/api-utils";
import { adminReorderSchema } from "@/lib/validators";

/** Réordonner les catégories */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const { ids } = await readBody(req, adminReorderSchema);

    await db.$transaction(
      ids.map((id: string, index: number) =>
        db.category.update({ where: { id }, data: { sortOrder: index } })
      )
    );

    return jsonOk({ ok: true });
  });
}
