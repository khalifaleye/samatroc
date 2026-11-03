import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, jsonOk } from "@/lib/api-utils";

const PAGES = ["ABOUT", "HOW_IT_WORKS", "FAQ", "SAFETY", "CGU", "PRIVACY", "MODERATION", "CONTACT"] as const;
export type ContentPage = (typeof PAGES)[number];

/** Contenu éditorial d'une page (géré depuis l'administration) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ page: string }> }
) {
  return handleRoute(async () => {
    const { page } = await params;
    const upper = page.toUpperCase();

    let content = PAGES.includes(upper as ContentPage)
      ? await db.siteContent.findUnique({ where: { page: upper } })
      : null;

    // Contenu par défaut minimal si absent
    if (!content) {
      content = {
        page: upper,
        title: "Page en préparation",
        body:
          "Cette page sera bientôt disponible. Revenez bientôt pour découvrir son contenu complet.",
        updatedAt: new Date(),
      };
    }

    return jsonOk({
      content: {
        page: content.page,
        title: content.title,
        body: content.body,
        updatedAt: content.updatedAt.toISOString(),
      },
    });
  });
}
