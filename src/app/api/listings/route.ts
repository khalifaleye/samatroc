import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk, escapeLike } from "@/lib/api-utils";
import { listingSchema } from "@/lib/validators";
import {
  listingInclude,
  serializeListing,
  getPublicationFee,
  generateListingReference,
  detectSuspiciousContent,
} from "@/lib/serializers";
import { PAGE_SIZE_DEFAULT } from "@/lib/constants";

/**
 * Moteur de recherche d'annonces (public).
 * Filtres : q, category (slug), city, condition, wanted, sort (recent|relevance|popular),
 * page, pageSize, ownerId, status, featured.
 */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim() || "";
    const categorySlug = sp.get("category") || "";
    const city = sp.get("city") || "";
    const condition = sp.get("condition") || "";
    const wanted = sp.get("wanted")?.trim() || "";
    const sort = sp.get("sort") || "recent";
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      48,
      Math.max(1, parseInt(sp.get("pageSize") ?? String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT)
    );
    const ownerId = sp.get("ownerId") || "";
    const statusParam = sp.get("status") || "PUBLISHED";
    const featured = sp.get("featured") === "1";
    const session = await getSessionUser();

    const where: Record<string, unknown> = {};
    const andConditions: object[] = [];

    // Statuts : par défaut PUBLISHED ; csv accepté pour l'espace personnel
    const statuses = statusParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ownerId) {
      where.userId = ownerId;
      if (statuses.length > 0 && statuses[0] !== "ALL") {
        where.status = { in: statuses };
      }
    } else {
      where.status = statuses.length > 0 && statuses[0] !== "ALL" ? { in: statuses } : "PUBLISHED";
    }

    if (q) {
      const like = `%${escapeLike(q)}%`;
      andConditions.push({
        OR: [
          { title: { contains: like } },
          { description: { contains: like } },
          { wantedText: { contains: like } },
        ],
      });
    }
    if (categorySlug) {
      const cat = await db.category.findUnique({ where: { slug: categorySlug } });
      if (cat) {
        andConditions.push({ OR: [{ categoryId: cat.id }, { subcategoryId: cat.id }] });
      } else {
        where.categoryId = "aucune-correspondance";
      }
    }
    if (city) where.city = city;
    if (condition) where.condition = condition;
    if (wanted) where.wantedText = { contains: `%${escapeLike(wanted)}%` };
    if (featured) where.featured = true;
    if (andConditions.length > 0) where.AND = andConditions;

    // Tri
    const baseOrder =
      sort === "popular"
        ? [{ viewsCount: "desc" as const }, { createdAt: "desc" as const }]
        : [{ publishedAt: "desc" as const }, { createdAt: "desc" as const }];
    const orderBy = [{ featured: "desc" as const }, ...baseOrder];

    const [total, listingsRaw] = await Promise.all([
      db.listing.count({ where }),
      db.listing.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: listingInclude,
      }),
    ]);

    const fee = await getPublicationFee();
    let favoriteIds = new Set<string>();
    if (session && listingsRaw.length > 0) {
      favoriteIds = new Set(
        (
          await db.favorite.findMany({
            where: { userId: session.id, listingId: { in: listingsRaw.map((l) => l.id) } },
            select: { listingId: true },
          })
        ).map((f) => f.listingId)
      );
    }

    return jsonOk({
      listings: listingsRaw.map((l) => serializeListing(l, favoriteIds.has(l.id), fee)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  });
}

/** Création d'une annonce (brouillon ou en attente de paiement) */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Vous devez être connecté pour publier une annonce");

    const input = await listingSchema.parseAsync(await req.json());

    // Vérifie la catégorie
    const category = await db.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new ApiError(400, "Catégorie invalide", { categoryId: "Catégorie inconnue" });

    if (input.subcategoryId) {
      const sub = await db.category.findUnique({ where: { id: input.subcategoryId } });
      if (!sub || sub.parentId !== input.categoryId) {
        throw new ApiError(400, "Sous-catégorie invalide", { subcategoryId: "Sous-catégorie inconnue" });
      }
    }

    const suspectNote = detectSuspiciousContent(input.title, input.description, input.wantedText);

    const listing = await db.listing.create({
      data: {
        reference: generateListingReference(),
        userId: session.id,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId || null,
        condition: input.condition,
        city: input.city,
        quartier: input.quartier || null,
        wantedText: input.wantedText,
        wantedCategory: input.wantedCategory || null,
        wantedMultiple: input.wantedMultiple,
        status: input.saveAsDraft ? "DRAFT" : "PENDING_PAYMENT",
        moderationNote: suspectNote,
      },
    });

    if (input.images.length > 0) {
      await db.listingImage.createMany({
        data: input.images.map((img, i) => ({
          listingId: listing.id,
          url: img.url,
          isPrimary: img.isPrimary || i === 0,
          sortOrder: i,
        })),
      });
    }

    const created = await db.listing.findUnique({
      where: { id: listing.id },
      include: listingInclude,
    });

    return jsonOk({ listing: created ? serializeListing(created) : null }, 201);
  });
}
