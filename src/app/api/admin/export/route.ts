import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, requireAdmin } from "@/lib/api-utils";
import { splitFullName } from "@/lib/auth";
import { isTestPayment, legacyListingStatus, legacyPaymentStatus } from "@/lib/payments";

/** Export CSV simple des indicateurs (annonces, paiements, inscriptions) */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const type = req.nextUrl.searchParams.get("type") || "listings";

    let csv = "";
    let filename = "export";

    if (type === "users") {
      filename = "samatroc-utilisateurs.csv";
      // Bascule Supabase : db.profile + fullName unique (découpé pour le CSV)
      const users = await db.profile.findMany({ orderBy: { createdAt: "desc" } });
      csv =
        "Prenom;Nom;Email;Telephone;Ville;Role;Statut;Date inscription\n" +
        users
          .map((u) => {
            const { firstName, lastName } = splitFullName(u.fullName);
            return [
              firstName,
              lastName,
              u.email,
              u.phone ?? "",
              u.city ?? "",
              u.role,
              u.accountStatus,
              u.createdAt.toISOString(),
            ]
              .map((v) => String(v).replace(/;/g, ","))
              .join(";");
          })
          .join("\n");
    } else if (type === "payments") {
      filename = "samatroc-paiements.csv";
      const payments = await db.payment.findMany({
        orderBy: { createdAt: "desc" },
        include: { user: { select: { email: true } } },
      });
      csv =
        "Reference;Utilisateur;Montant (FCFA);Prestataire;Statut;Mode test;Date creation;Date paiement\n" +
        payments
          .map((p) =>
            [
              p.transactionReference,
              p.user?.email ?? "",
              p.amount,
              p.paymentProvider,
              // Statut traduit dans le vocabulaire historique des vues (SUCCESS…)
              legacyPaymentStatus(p.status),
              isTestPayment(p.paymentProvider) ? "OUI" : "NON",
              p.createdAt.toISOString(),
              p.confirmedAt?.toISOString() ?? "",
            ]
              .map((v) => String(v).replace(/;/g, ","))
              .join(";")
          )
          .join("\n");
    } else {
      filename = "samatroc-annonces.csv";
      const listings = await db.listing.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { email: true } },
          category: { select: { name: true } },
        },
      });
      csv =
        "Reference;Titre;Categorie;Ville;Etat;Statut;Proprietaire;Vues;Date creation\n" +
        listings
          .map((l) =>
            [
              l.reference,
              l.title,
              l.category?.name ?? "",
              l.city,
              l.condition,
              legacyListingStatus(l.status),
              l.user?.email ?? "",
              l.viewsCount,
              l.createdAt.toISOString(),
            ]
              .map((v) => String(v).replace(/;/g, ","))
              .join(";")
          )
          .join("\n");
    }

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  });
}
