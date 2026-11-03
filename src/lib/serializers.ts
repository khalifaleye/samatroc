import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PUBLICATION_FEE_DEFAULT, SUSPICIOUS_KEYWORDS } from "@/lib/constants";
import type { ListingSummary } from "@/lib/types";

/** Include Prisma standard pour les annonces */
export const listingInclude = {
  category: true,
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
  user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} satisfies Prisma.ListingInclude;

type ListingWithRelations = Prisma.ListingGetPayload<{ include: typeof listingInclude }>;

/** Récupère les frais de publication configurés (site_settings) */
export async function getPublicationFee(): Promise<number> {
  const setting = await db.siteSetting.findUnique({ where: { key: "publication_fee" } });
  const fee = setting ? parseInt(setting.value, 10) : PUBLICATION_FEE_DEFAULT;
  return Number.isFinite(fee) && fee > 0 ? fee : PUBLICATION_FEE_DEFAULT;
}

/** Transforme une annonce Prisma en ListingSummary sérialisable */
export function serializeListing(
  listing: ListingWithRelations,
  isFavorite = false,
  fee = PUBLICATION_FEE_DEFAULT
): ListingSummary {
  return {
    id: listing.id,
    reference: listing.reference,
    title: listing.title,
    description: listing.description,
    condition: listing.condition,
    city: listing.city,
    quartier: listing.quartier,
    wantedText: listing.wantedText,
    wantedCategory: listing.wantedCategory,
    wantedMultiple: listing.wantedMultiple,
    status: listing.status,
    featured: listing.featured,
    viewsCount: listing.viewsCount,
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    createdAt: listing.createdAt.toISOString(),
    expiresAt: listing.expiresAt?.toISOString() ?? null,
    fees: fee,
    category: listing.category
      ? {
          id: listing.category.id,
          name: listing.category.name,
          slug: listing.category.slug,
          icon: listing.category.icon,
          color: listing.category.color,
        }
      : null,
    images: listing.images.map((img) => ({ url: img.url, isPrimary: img.isPrimary })),
    owner: {
      id: listing.user.id,
      firstName: listing.user.firstName,
      lastName: listing.user.lastName,
      avatarUrl: listing.user.avatarUrl,
    },
    isFavorite,
  };
}

/** Génère une référence unique d'annonce */
export function generateListingReference(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ST-ANN-${rand}`;
}

/** Génère une référence unique de paiement */
export function generatePaymentReference(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ST-PAY-${rand}`;
}

/** Détection d'annonces suspectes (spam / arnaque) — retourne une note ou null */
export function detectSuspiciousContent(...texts: (string | null | undefined)[]): string | null {
  const haystack = texts.filter(Boolean).join(" ").toLowerCase();
  for (const kw of SUSPICIOUS_KEYWORDS) {
    if (haystack.includes(kw)) {
      return `Contenu suspect détecté (mot-clé : « ${kw} »)`;
    }
  }
  return null;
}

/**
 * Active une annonce après paiement confirmé (côté serveur uniquement).
 * Respecte auto_moderate et la détection de contenu suspect.
 */
export async function activateListingAfterPayment(
  listingId: string
): Promise<{ status: string }> {
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing) return { status: "UNKNOWN" };
  if (listing.status === "PUBLISHED") return { status: "ALREADY_PUBLISHED" };

  const settings = await db.siteSetting.findMany({
    where: { key: { in: ["auto_moderate", "listing_validity_days"] } },
  });
  const autoModerate = settings.find((s) => s.key === "auto_moderate")?.value === "true";
  const validityDays =
    parseInt(settings.find((s) => s.key === "listing_validity_days")?.value ?? "60", 10) || 60;

  const suspectNote = detectSuspiciousContent(
    listing.title,
    listing.description,
    listing.wantedText
  );
  const now = new Date();
  const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

  const goModeration = autoModerate || suspectNote !== null;
  const newStatus = goModeration ? "PENDING_MODERATION" : "PUBLISHED";

  await db.listing.update({
    where: { id: listingId },
    data: {
      status: newStatus,
      moderationNote: suspectNote,
      publishedAt: goModeration ? listing.publishedAt : now,
      expiresAt,
    },
  });

  return { status: newStatus };
}
