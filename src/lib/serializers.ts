import "server-only";
import type { Prisma, ListingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  PUBLICATION_FEE_DEFAULT,
  SUSPICIOUS_KEYWORDS,
  DEFAULT_CATEGORIES,
  listingStatusToApi,
} from "@/lib/constants";
import { splitFullName } from "@/lib/auth";
import type { ListingSummary } from "@/lib/types";

/**
 * Serializeurs du domaine ANNONCES (SamaTroc).
 * Depuis la bascule Supabase, les colonnes ont été renommées
 * (wantedText → desiredItem, wantedCategory → desiredCategoryId, quartier →
 * neighborhood, url → image_url, user.firstName/lastName → profile.full_name…).
 * `serializeListing` conserve INTÉGRALEMENT le contrat JSON historique
 * (ListingSummary) : les vues React n'ont pas à changer.
 */

/** Include Prisma standard pour les annonces */
export const listingInclude = {
  category: true,
  images: { orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }] },
  user: { select: { id: true, fullName: true, avatarUrl: true } },
} satisfies Prisma.ListingInclude;

type ListingWithRelations = Prisma.ListingGetPayload<{ include: typeof listingInclude }>;

/** Récupère les frais de publication configurés (site_settings) */
export async function getPublicationFee(): Promise<number> {
  const setting = await db.siteSetting.findUnique({ where: { settingKey: "publication_fee" } });
  const fee = setting ? parseInt(setting.settingValue, 10) : PUBLICATION_FEE_DEFAULT;
  return Number.isFinite(fee) && fee > 0 ? fee : PUBLICATION_FEE_DEFAULT;
}

/**
 * Couleur d'affichage d'une catégorie : la table `categories` Supabase ne
 * stocke plus de couleur — on retombe sur la palette par défaut (par slug)
 * pour préserver le contrat JSON (`category.color`).
 */
export function categoryColor(slug: string): string {
  return DEFAULT_CATEGORIES.find((c) => c.slug === slug)?.color ?? "#0e5c3d";
}

/**
 * Charge les noms des catégories « recherchées » : en base, l'ancienne colonne
 * texte `wanted_category` est devenue la clé étrangère uuid
 * `desired_category_id` (sans relation Prisma déclarée) — ce mapping id → nom
 * permet de renvoyer `wantedCategory` (string) comme avant.
 */
export async function loadDesiredCategoryNames(
  listings: { desiredCategoryId: string | null }[]
): Promise<Map<string, string>> {
  const ids = [
    ...new Set(
      listings
        .map((l) => l.desiredCategoryId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  if (ids.length === 0) return new Map();
  const rows = await db.category.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((row) => [row.id, row.name]));
}

/** Transforme une annonce Prisma en ListingSummary sérialisable (contrat inchangé) */
export function serializeListing(
  listing: ListingWithRelations,
  isFavorite = false,
  fee = PUBLICATION_FEE_DEFAULT,
  desiredCategoryNames?: Map<string, string>
): ListingSummary {
  const { firstName, lastName } = splitFullName(listing.user.fullName);
  return {
    id: listing.id,
    reference: listing.reference,
    title: listing.title,
    description: listing.description,
    condition: listing.condition,
    city: listing.city,
    quartier: listing.neighborhood,
    wantedText: listing.desiredItem,
    wantedCategory: listing.desiredCategoryId
      ? (desiredCategoryNames?.get(listing.desiredCategoryId) ?? null)
      : null,
    wantedMultiple: listing.desiredMultiple,
    // Statut traduit vers le vocabulaire historique des vues (INACTIVE → DEACTIVATED…)
    status: listingStatusToApi(listing.status),
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
          icon: listing.category.icon ?? "package",
          color: categoryColor(listing.category.slug),
        }
      : null,
    images: listing.images.map((img) => ({ url: img.imageUrl, isPrimary: img.isPrimary })),
    owner: {
      id: listing.user.id,
      firstName,
      lastName,
      avatarUrl: listing.user.avatarUrl,
    },
    isFavorite,
  };
}

/** Slugify un titre (accents retirés) pour la colonne `listings.slug` */
function slugifyTitle(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "annonce";
}

/** Génère un slug unique pour une annonce (dérivé du titre, désambiguïté -2, -3…) */
export async function generateUniqueListingSlug(title: string): Promise<string> {
  const base = slugifyTitle(title);
  let candidate = base;
  for (let i = 2; ; i++) {
    const clash = await db.listing.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}-${i}`;
  }
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
 * Contrat historique conservé : le statut retourné est exprimé dans le
 * vocabulaire des vues (« PENDING_MODERATION » / « PUBLISHED »), tandis que la
 * base stocke l'enum Supabase (« PENDING_REVIEW » / « PUBLISHED »).
 */
export async function activateListingAfterPayment(
  listingId: string
): Promise<{ status: string }> {
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing) return { status: "UNKNOWN" };
  if (listing.status === "PUBLISHED") return { status: "ALREADY_PUBLISHED" };

  const settings = await db.siteSetting.findMany({
    where: { settingKey: { in: ["auto_moderate", "listing_validity_days"] } },
  });
  const autoModerate =
    settings.find((s) => s.settingKey === "auto_moderate")?.settingValue === "true";
  const validityDays =
    parseInt(
      settings.find((s) => s.settingKey === "listing_validity_days")?.settingValue ?? "60",
      10
    ) || 60;

  const suspectNote = detectSuspiciousContent(
    listing.title,
    listing.description,
    listing.desiredItem
  );
  const now = new Date();
  const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

  const goModeration = autoModerate || suspectNote !== null;
  const dbStatus: ListingStatus = goModeration ? "PENDING_REVIEW" : "PUBLISHED";

  await db.listing.update({
    where: { id: listingId },
    data: {
      status: dbStatus,
      moderationNote: suspectNote,
      publishedAt: goModeration ? listing.publishedAt : now,
      expiresAt,
    },
  });

  return { status: listingStatusToApi(dbStatus) };
}
