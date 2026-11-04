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
  generateUniqueListingSlug,
  loadDesiredCategoryNames,
  detectSuspiciousContent,
} from "@/lib/serializers";
import { PAGE_SIZE_DEFAULT, CONDITIONS, LISTING_DB_STATUSES, listingStatusToDb } from "@/lib/constants";

/** Les ids ville/catégorie/annonce sont des uuid en base (PostgreSQL Supabase). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valeurs d'enum `item_condition` acceptées par le filtre `condition` */
const CONDITION_VALUES: readonly string[] = CONDITIONS.map((c) => c.value);

/**
 * Moteur de recherche d'annonces (public).
 * Filtres : q, category (slug), city, condition, wanted, sort (recent|relevance|popular),
 * page, pageSize, ownerId, status, featured.
 * Compatibilité : la query `status` accepte le vocabulaire historique des vues
 * (PENDING_MODERATION/REFUSED/DEACTIVATED), traduit vers l'enum Supabase.
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

    const emptyPage = () => ({ listings: [], total: 0, page, pageSize, totalPages: 1 });

    const where: Record<string, unknown> = {};
    const andConditions: object[] = [];

    // Statuts : par défaut PUBLISHED ; csv accepté pour l'espace personnel
    const statusesRaw = statusParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const statuses = statusesRaw
      .map(listingStatusToDb)
      .filter((s) => (LISTING_DB_STATUSES as readonly string[]).includes(s));
    const filterStatuses = statusesRaw.length > 0 && statusesRaw[0] !== "ALL";
    if (filterStatuses && statuses.length === 0) {
      // Aucun statut valide demandé → page vide (même forme de réponse)
      return jsonOk(emptyPage());
    }
    if (ownerId) {
      if (!UUID_RE.test(ownerId)) return jsonOk(emptyPage());
      where.userId = ownerId;
      if (filterStatuses) where.status = { in: statuses };
    } else {
      where.status = filterStatuses ? { in: statuses } : "PUBLISHED";
    }

    if (q) {
      const like = `%${escapeLike(q)}%`;
      andConditions.push({
        OR: [
          { title: { contains: like } },
          { description: { contains: like } },
          { desiredItem: { contains: like } },
        ],
      });
    }
    if (categorySlug) {
      const cat = await db.category.findUnique({ where: { slug: categorySlug } });
      if (cat) {
        andConditions.push({ OR: [{ categoryId: cat.id }, { subcategoryId: cat.id }] });
      } else {
        return jsonOk(emptyPage());
      }
    }
    if (city) where.city = city;
    if (condition && CONDITION_VALUES.includes(condition)) {
      where.condition = condition;
    }
    if (wanted) where.desiredItem = { contains: `%${escapeLike(wanted)}%` };
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

    // wantedCategory (string) : résolution nom de catégorie depuis desired_category_id
    const desiredCategoryNames = await loadDesiredCategoryNames(listingsRaw);

    return jsonOk({
      listings: listingsRaw.map((l) => serializeListing(l, favoriteIds.has(l.id), fee, desiredCategoryNames)),
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

    // wantedCategory : l'UI envoie un NOM de catégorie (string) — résolution vers l'uuid
    let desiredCategoryId: string | null = null;
    if (input.wantedCategory) {
      const wantedCat = await db.category.findFirst({
        where: {
          OR: [
            { name: { equals: input.wantedCategory, mode: "insensitive" } },
            { slug: { equals: input.wantedCategory.toLowerCase() } },
          ],
        },
        select: { id: true },
      });
      desiredCategoryId = wantedCat?.id ?? null;
    }

    const suspectNote = detectSuspiciousContent(input.title, input.description, input.wantedText);
    const fee = await getPublicationFee();
    const slug = await generateUniqueListingSlug(input.title);

    const listing = await db.listing.create({
      data: {
        reference: generateListingReference(),
        slug,
        userId: session.id,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId || null,
        condition: input.condition,
        city: input.city,
        neighborhood: input.quartier || null,
        desiredItem: input.wantedText,
        desiredCategoryId,
        desiredMultiple: input.wantedMultiple,
        status: input.saveAsDraft ? "DRAFT" : "PENDING_PAYMENT",
        publicationFee: fee,
        moderationNote: suspectNote,
      },
    });

    if (input.images.length > 0) {
      await db.listingImage.createMany({
        data: input.images.map((img, i) => ({
          listingId: listing.id,
          imageUrl: img.url,
          isPrimary: img.isPrimary || i === 0,
          displayOrder: i,
        })),
      });
    }

    const created = await db.listing.findUnique({
      where: { id: listing.id },
      include: listingInclude,
    });
    const desiredCategoryNames = created ? await loadDesiredCategoryNames([created]) : undefined;

    return jsonOk(
      { listing: created ? serializeListing(created, false, fee, desiredCategoryNames) : null },
      201
    );
  });
}
