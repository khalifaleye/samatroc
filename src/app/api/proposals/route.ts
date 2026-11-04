import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, jsonOk } from "@/lib/api-utils";
import { proposalStatusToDb } from "@/lib/constants";
import { getPublicationFee, loadDesiredCategoryNames } from "@/lib/serializers";
import {
  PROPOSAL_INCLUDE,
  proposalCardListings,
  serializeProposal,
} from "@/app/api/_shared/domain";

/**
 * Mes propositions d'échange (boîtes envoyées / reçues) — bascule Supabase :
 * • `offeredListing` → relation `proposedListing`, `offeredText` →
 *   `proposedDescription`, `offeredImages` → Json `proposedImages` ;
 * • destinataire d'une proposition = colonne `ownerId` (ex listing.userId) ;
 * • statuts enum Supabase (REJECTED/COUNTERED) exposés en vocabulaire legacy
 *   (REFUSED/DISCUSSING) via `proposalStatusToApi` — le filtre `?status=`
 *   accepte les deux vocabulaires (`proposalStatusToDb`) ;
 * • `firstName`/`lastName` → `fullName` via splitFullName ;
 * • sérialisation des annonces déléguée aux helpers de la vague listings
 *   (`serializeListing` + `loadDesiredCategoryNames` pour `wantedCategory`).
 */

/** Mes propositions d'échange (boîtes envoyées / reçues) */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) return jsonOk({ error: "Connexion requise" }, 401);

    const box = req.nextUrl.searchParams.get("box") === "sent" ? "sent" : "received";
    const statusFilter = req.nextUrl.searchParams.get("status") || "";

    const where: Prisma.ExchangeProposalWhereInput =
      box === "sent" ? { proposerId: session.id } : { ownerId: session.id };
    const canonicalStatus = statusFilter ? proposalStatusToDb(statusFilter) : null;
    if (canonicalStatus) where.status = canonicalStatus;

    const proposalsRaw = await db.exchangeProposal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: PROPOSAL_INCLUDE,
    });

    const [fee, desiredNames] = await Promise.all([
      getPublicationFee(),
      loadDesiredCategoryNames(proposalCardListings(proposalsRaw)),
    ]);
    return jsonOk({
      proposals: proposalsRaw.map((p) => serializeProposal(p, box, fee, desiredNames)),
    });
  });
}
