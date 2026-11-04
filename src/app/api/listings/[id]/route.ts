import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";
import { listingUpdateSchema } from "@/lib/validators";
import {
  listingInclude,
  serializeListing,
  getPublicationFee,
  loadDesiredCategoryNames,
  detectSuspiciousContent,
} from "@/lib/serializers";

/** Les ids d'annonce sont des uuid en base (PostgreSQL Supabase). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Clés MODIFIABLES telles qu'envoyées par les vues (contrat inchangé) → colonnes Supabase */
const EDITABLE_ALWAYS = ["city", "quartier"] as const;
const EDITABLE_UNPAID = [
  "title",
  "description",
  "categoryId",
  "subcategoryId",
  "condition",
  "wantedText",
  "wantedCategory",
  "wantedMultiple",
] as const;
/** Statuts « payée/publiée » : enum base (INACTIVE remplace DEACTIVATED) */
const PAID_STATUSES = ["PUBLISHED", "EXCHANGED", "INACTIVE"];

/** Détail public d'une annonce + annonces similaires */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { id } = await params;
    const session = await getSessionUser();
    if (!UUID_RE.test(id)) throw new ApiError(404, "Annonce introuvable");

    const listing = await db.listing.findUnique({
      where: { id },
      include: {
        ...listingInclude,
        subcategory: true,
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            city: true,
            phone: true,
            createdAt: true,
            showPhone: true,
            _count: { select: { listings: { where: { status: "PUBLISHED" } } } },
          },
        },
      },
    });

    if (!listing) throw new ApiError(404, "Annonce introuvable");

    const isOwner = session?.id === listing.userId;
    const isStaff = session?.role === "ADMIN" || session?.role === "SUPER_ADMIN";
    if (listing.status !== "PUBLISHED" && !isOwner && !isStaff) {
      throw new ApiError(404, "Cette annonce n'est plus disponible");
    }

    // +1 vue (hors propriétaire)
    if (!isOwner) {
      await db.listing.update({ where: { id }, data: { viewsCount: { increment: 1 } } });
    }

    const isFavorite = session
      ? !!(await db.favorite.findUnique({
          where: { userId_listingId: { userId: session.id, listingId: id } },
        }))
      : false;

    // Annonces similaires : même catégorie, publiées
    const similarRaw = await db.listing.findMany({
      where: { status: "PUBLISHED", categoryId: listing.categoryId, id: { not: listing.id } },
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
      take: 4,
      include: listingInclude,
    });

    const fee = await getPublicationFee();
    const desiredCategoryNames = await loadDesiredCategoryNames([listing, ...similarRaw]);
    const base = serializeListing(listing, isFavorite, fee, desiredCategoryNames);

    const owner = listing.user;
    const ownerName = { firstName: base.owner.firstName, lastName: base.owner.lastName };

    return jsonOk({
      listing: {
        ...base,
        subcategory: listing.subcategory
          ? {
              id: listing.subcategory.id,
              name: listing.subcategory.name,
              slug: listing.subcategory.slug,
            }
          : null,
        owner: {
          id: owner.id,
          firstName: ownerName.firstName,
          lastName: ownerName.lastName,
          avatarUrl: owner.avatarUrl,
          city: owner.city,
          memberSince: owner.createdAt.toISOString(),
          listingsCount: owner._count.listings,
          // Numéro jamais exposé sans le choix du propriétaire
          showPhone: owner.showPhone,
          phone: owner.showPhone ? owner.phone : null,
          // La colonne whatsapp_enabled n'existe plus : le bouton WhatsApp suit
          // le même consentement que l'affichage du téléphone.
          whatsappEnabled: owner.showPhone,
        },
        isOwner,
      },
      similar: similarRaw.map((l) => serializeListing(l, false, fee, desiredCategoryNames)),
    });
  });
}

/** MAJ d'une annonce (propriétaire ou admin) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    const { id } = await params;
    if (!UUID_RE.test(id)) throw new ApiError(404, "Annonce introuvable");
    const input = await listingUpdateSchema.parseAsync(await req.json());

    const listing = await db.listing.findUnique({ where: { id } });
    if (!listing) throw new ApiError(404, "Annonce introuvable");

    const isOwner = listing.userId === session.id;
    const isStaff = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    if (!isOwner && !isStaff) throw new ApiError(403, "Action non autorisée");

    const data: Record<string, unknown> = {};

    // wantedCategory : l'UI envoie un NOM de catégorie — résolution vers l'uuid
    const resolveWantedCategory = async (value: unknown): Promise<string | null> => {
      const name = typeof value === "string" ? value.trim() : "";
      if (!name) return null;
      const cat = await db.category.findFirst({
        where: {
          OR: [{ name: { equals: name, mode: "insensitive" } }, { slug: { equals: name.toLowerCase() } }],
        },
        select: { id: true },
      });
      return cat?.id ?? null;
    };

    for (const [key, value] of Object.entries(input)) {
      if (value === undefined || key === "images") continue;
      if ((EDITABLE_ALWAYS as readonly string[]).includes(key)) {
        // city : chaîne requise ; quartier → neighborhood (nullable)
        if (key === "city") {
          data.city = value;
        } else {
          data.neighborhood = value === "" ? null : value;
        }
      } else if ((EDITABLE_UNPAID as readonly string[]).includes(key)) {
        if (isStaff || !PAID_STATUSES.includes(listing.status)) {
          switch (key) {
            case "wantedText":
              data.desiredItem = value;
              break;
            case "wantedCategory":
              data.desiredCategoryId = await resolveWantedCategory(value);
              break;
            case "wantedMultiple":
              data.desiredMultiple = value;
              break;
            case "subcategoryId":
              data.subcategoryId = value === "" ? null : value;
              break;
            default:
              data[key] = value;
          }
        } else {
          throw new ApiError(
            409,
            "Cette annonce est déjà publiée : le contenu principal ne peut plus être modifié. Désactivez-la puis recréez une annonce si nécessaire."
          );
        }
      }
    }

    if (Object.keys(data).length > 0 && !isStaff) {
      const note = detectSuspiciousContent(
        (data.title as string) ?? listing.title,
        (data.description as string) ?? listing.description,
        (data.desiredItem as string) ?? listing.desiredItem
      );
      if (note) data.moderationNote = note;
    }

    await db.listing.update({ where: { id }, data });

    // Remplacement complet des images si fournies
    if (input.images) {
      await db.listingImage.deleteMany({ where: { listingId: id } });
      if (input.images.length > 0) {
        await db.listingImage.createMany({
          data: input.images.map((img, i) => ({
            listingId: id,
            imageUrl: img.url,
            isPrimary: img.isPrimary || i === 0,
            displayOrder: i,
          })),
        });
      }
    }

    const updated = await db.listing.findUnique({ where: { id }, include: listingInclude });
    const fee = await getPublicationFee();
    const desiredCategoryNames = updated ? await loadDesiredCategoryNames([updated]) : undefined;
    return jsonOk({
      listing: updated ? serializeListing(updated, false, fee, desiredCategoryNames) : null,
    });
  });
}

/** Suppression (propriétaire selon statut, ou admin) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    const { id } = await params;
    if (!UUID_RE.test(id)) throw new ApiError(404, "Annonce introuvable");

    const listing = await db.listing.findUnique({ where: { id } });
    if (!listing) throw new ApiError(404, "Annonce introuvable");

    const isOwner = listing.userId === session.id;
    const isStaff = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    // Statuts supprimables par le propriétaire (enum base : REJECTED / INACTIVE)
    const ownerDeletable = ["DRAFT", "PENDING_PAYMENT", "REJECTED", "INACTIVE"].includes(
      listing.status
    );
    if (!isStaff && !(isOwner && ownerDeletable)) {
      throw new ApiError(
        403,
        "Cette annonce publiée ne peut être supprimée que par l'administration. Désactivez-la plutôt."
      );
    }

    await db.listing.delete({ where: { id } });
    return jsonOk({ ok: true, message: "Annonce supprimée" });
  });
}
