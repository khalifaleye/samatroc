import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, jsonOk } from "@/lib/api-utils";
import { listingInclude, serializeListing, getPublicationFee } from "@/lib/serializers";

/** Mes propositions d'échange (boîtes envoyées / reçues) */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) return jsonOk({ error: "Connexion requise" }, 401);

    const box = req.nextUrl.searchParams.get("box") === "sent" ? "sent" : "received";
    const statusFilter = req.nextUrl.searchParams.get("status") || "";

    const where =
      box === "sent"
        ? { proposerId: session.id }
        : { listing: { userId: session.id } };
    const whereFinal: Record<string, unknown> = { ...where };
    if (statusFilter) whereFinal.status = statusFilter;

    const proposalsRaw = await db.exchangeProposal.findMany({
      where: whereFinal,
      orderBy: { createdAt: "desc" },
      include: {
        listing: { include: listingInclude },
        offeredListing: { include: listingInclude },
        proposer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    const fee = await getPublicationFee();
    return jsonOk({
      proposals: proposalsRaw.map((p) => ({
        id: p.id,
        status: p.status,
        message: p.message,
        counterText: p.counterText,
        offeredText: p.offeredText,
        offeredImages: JSON.parse(p.offeredImages ?? "[]") as string[],
        createdAt: p.createdAt.toISOString(),
        respondedAt: p.respondedAt?.toISOString() ?? null,
        completedAt: p.completedAt?.toISOString() ?? null,
        listing: serializeListing(p.listing, false, fee),
        offeredListing: p.offeredListing ? serializeListing(p.offeredListing, false, fee) : null,
        proposer: p.proposer,
        owner: {
          id: p.listing.user.id,
          firstName: p.listing.user.firstName,
          lastName: p.listing.user.lastName,
          avatarUrl: p.listing.user.avatarUrl,
        },
        direction: box,
      })),
    });
  });
}
