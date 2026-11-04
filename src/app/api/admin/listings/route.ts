import { NextRequest } from "next/server";
import { ListingStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handleRoute, requireAdmin, jsonOk, escapeLike } from "@/lib/api-utils";
import { listingInclude, serializeListing, getPublicationFee } from "@/lib/serializers";
import { listingStatusToDb } from "@/lib/constants";
import { splitFullName } from "@/lib/auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Liste complète des annonces avec filtres (administration) */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim() || "";
    const status = sp.get("status") || "";
    const category = sp.get("category") || "";
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const pageSize = 20;

    const where: Prisma.ListingWhereInput = {};
    if (q) {
      const like = `%${escapeLike(q)}%`;
      where.OR = [
        { title: { contains: like } },
        { description: { contains: like } },
        { reference: { contains: like } },
      ];
    }
    // Les vues filtrent avec le vocabulaire historique (PENDING_MODERATION,
    // REFUSED, DEACTIVATED…) : traduction vers l'enum base Supabase.
    if (status) where.status = listingStatusToDb(status) as ListingStatus;
    // Le filtre catégorie porte l'uuid de la table categories ; un id non uuid
    // ne doit pas lever d'erreur SQL → aucun résultat.
    if (category) {
      where.categoryId = UUID_RE.test(category) ? category : { in: [] };
    }

    const [total, listingsRaw] = await Promise.all([
      db.listing.count({ where }),
      db.listing.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          ...listingInclude,
          user: { select: { id: true, fullName: true, avatarUrl: true, email: true } },
        },
      }),
    ]);

    const fee = await getPublicationFee();
    return jsonOk({
      listings: listingsRaw.map((l) => {
        const { firstName, lastName } = splitFullName(l.user.fullName);
        return {
          ...serializeListing(l, false, fee),
          owner: {
            id: l.user.id,
            firstName,
            lastName,
            email: l.user.email,
            avatarUrl: l.user.avatarUrl,
          },
        };
      }),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  });
}
