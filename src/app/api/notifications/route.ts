import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { z } from "zod";

/** Centre de notifications de l'utilisateur */
export async function GET() {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: session.id },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
      db.notification.count({ where: { userId: session.id, readAt: null } }),
    ]);

    return jsonOk({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        linkView: n.linkView,
        linkParams: n.linkParams,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    });
  });
}

/** Marque des notifications comme lues (ids ou toutes) */
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
        where: { userId: session.id, readAt: null },
        data: { readAt: new Date() },
      });
    } else if (ids && ids.length > 0) {
      await db.notification.updateMany({
        where: { userId: session.id, id: { in: ids }, readAt: null },
        data: { readAt: new Date() },
      });
    }

    return jsonOk({ ok: true });
  });
}
