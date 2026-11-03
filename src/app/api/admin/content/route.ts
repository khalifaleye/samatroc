import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, readBody, requireAdmin, jsonOk, logAdminAction } from "@/lib/api-utils";
import { adminContentSchema } from "@/lib/validators";

/** Tous les contenus éditoriaux */
export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    const contents = await db.siteContent.findMany({ orderBy: { page: "asc" } });
    return jsonOk({
      contents: contents.map((c) => ({
        page: c.page,
        title: c.title,
        body: c.body,
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  });
}

/** Mise à jour d'un contenu éditorial */
export async function PUT(req: NextRequest) {
  return handleRoute(async () => {
    const admin = await requireAdmin();
    const input = await readBody(req, adminContentSchema);

    const content = await db.siteContent.upsert({
      where: { page: input.page },
      create: { page: input.page, title: input.title, body: input.body },
      update: { title: input.title, body: input.body },
    });

    await logAdminAction(admin.id, "CONTENT_UPDATE", "SITE_CONTENT", input.page, input.title);

    return jsonOk({
      content: {
        page: content.page,
        title: content.title,
        body: content.body,
        updatedAt: content.updatedAt.toISOString(),
      },
      message: "Contenu mis à jour",
    });
  });
}
