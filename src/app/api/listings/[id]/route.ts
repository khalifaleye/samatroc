import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";
import { listingUpdateSchema } from "@/lib/validators";
import {
  listingInclude,
  serializeListing,
  getPublicationFee,
  detectSuspiciousContent,
} from "@/lib/serializers";

const EDITABLE_ALWAYS = ["city", "quartier"];
const EDITABLE_UNPAID = [
  "title",
  "description",
  "categoryId",
  "subcategoryId",
  "condition",
  "wantedText",
  "wantedCategory",
  "wantedMultiple",
];

/** Détail public d'une annonce + annonces similaires */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { id } = await params;
    const session = await getSessionUser();

    const listing = await db.listing.findUnique({
      where: { id },
      include: {
        ...listingInclude,
        subcategory: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            city: true,
            phone: true,
            createdAt: true,
            profile: { select: { showPhone: true, whatsappEnabled: true } },
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
    const base = serializeListing(listing, isFavorite, fee);

    const owner = listing.user as unknown as {
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
      city: string | null;
      phone: string | null;
      createdAt: Date;
      profile: { showPhone: boolean; whatsappEnabled: boolean } | null;
      _count: { listings: number };
    };

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
          firstName: owner.firstName,
          lastName: owner.lastName,
          avatarUrl: owner.avatarUrl,
          city: owner.city,
          memberSince: owner.createdAt.toISOString(),
          listingsCount: owner._count.listings,
          // Numéro jamais exposé sans le choix du propriétaire
          showPhone: owner.profile?.showPhone ?? false,
          phone: owner.profile?.showPhone ? owner.phone : null,
          whatsappEnabled: owner.profile?.whatsappEnabled ?? true,
        },
        isOwner,
      },
      similar: similarRaw.map((l) => serializeListing(l, false, fee)),
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
    const input = await listingUpdateSchema.parseAsync(await req.json());

    const listing = await db.listing.findUnique({ where: { id } });
    if (!listing) throw new ApiError(404, "Annonce introuvable");

    const isOwner = listing.userId === session.id;
    const isStaff = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    if (!isOwner && !isStaff) throw new ApiError(403, "Action non autorisée");

    const paidStatuses = ["PUBLISHED", "EXCHANGED", "DEACTIVATED"];
    const data: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (value === undefined || key === "images") continue;
      if (EDITABLE_ALWAYS.includes(key)) {
        data[key] = value === "" ? null : value;
      } else if (EDITABLE_UNPAID.includes(key)) {
        if (isStaff || !paidStatuses.includes(listing.status)) {
          data[key] = value === "" ? null : value;
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
        (data.wantedText as string) ?? listing.wantedText
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
            url: img.url,
            isPrimary: img.isPrimary || i === 0,
            sortOrder: i,
          })),
        });
      }
    }

    const updated = await db.listing.findUnique({ where: { id }, include: listingInclude });
    const fee = await getPublicationFee();
    return jsonOk({ listing: updated ? serializeListing(updated, false, fee) : null });
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

    const listing = await db.listing.findUnique({ where: { id } });
    if (!listing) throw new ApiError(404, "Annonce introuvable");

    const isOwner = listing.userId === session.id;
    const isStaff = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    const ownerDeletable = ["DRAFT", "PENDING_PAYMENT", "REFUSED", "DEACTIVATED"].includes(
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
