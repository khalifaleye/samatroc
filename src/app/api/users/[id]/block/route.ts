import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleRoute, ApiError, jsonOk } from "@/lib/api-utils";

/** Bloquer / débloquer un utilisateur */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await requireAuth();
    const { id } = await params;
    if (id === session.id) throw new ApiError(400, "Vous ne pouvez pas vous bloquer vous-même");

    const existing = await db.block.findUnique({
      where: { blockerId_blockedId: { blockerId: session.id, blockedId: id } },
    });

    if (existing) {
      await db.block.delete({ where: { id: existing.id } });
      return jsonOk({ blocked: false, message: "Utilisateur débloqué" });
    }

    await db.block.create({ data: { blockerId: session.id, blockedId: id } });
    return jsonOk({ blocked: true, message: "Utilisateur bloqué" });
  });
}
