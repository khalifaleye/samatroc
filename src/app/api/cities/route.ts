import { db } from "@/lib/db";
import { handleRoute, jsonOk } from "@/lib/api-utils";

/** Villes actives (référentiel extensible via l'administration) */
export async function GET() {
  return handleRoute(async () => {
    const cities = await db.city.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return jsonOk({ cities: cities.map((c) => ({ id: c.id, name: c.name, region: c.region })) });
  });
}
