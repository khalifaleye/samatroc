import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { z } from "zod";
import { isUuid } from "@/app/api/_shared/domain";

/**
 * Marquage « lu » des notifications — route appelée par
 * src/views/account/notifications.tsx (POST /api/notifications/read avec
 * { all: true } ou { ids: [...] }). Bascule Supabase : `readAt` → `isRead`.
 * Les ids non uuid sont ignorés (les cibles Supabase sont des uuid).
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    const { ids, all } = await readBody(
      req,
      z.object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() })
    );

    if (all) {
      await db.notification.updateMany({
        where: { userId: session.id, isRead: false },
        data: { isRead: true },
      });
    } else if (ids && ids.length > 0) {
      const validIds = ids.filter(isUuid);
      if (validIds.length > 0) {
        await db.notification.updateMany({
          where: { userId: session.id, id: { in: validIds }, isRead: false },
          data: { isRead: true },
        });
      }
    }

    return jsonOk({ ok: true });
  });
}
