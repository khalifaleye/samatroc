import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, requireAdmin } from "@/lib/api-utils";

/** Export CSV simple des indicateurs (annonces, paiements, inscriptions) */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin();
    const type = req.nextUrl.searchParams.get("type") || "listings";

    let csv = "";
    let filename = "export";

    if (type === "users") {
      filename = "samatroc-utilisateurs.csv";
      const users = await db.user.findMany({ orderBy: { createdAt: "desc" } });
      csv =
        "Prenom;Nom;Email;Telephone;Ville;Role;Statut;Date inscription\n" +
        users
          .map((u) =>
            [u.firstName, u.lastName, u.email, u.phone ?? "", u.city ?? "", u.role, u.status, u.createdAt.toISOString()]
              .map((v) => String(v).replace(/;/g, ","))
              .join(";")
          )
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
              p.reference,
              p.user?.email ?? "",
              p.amount,
              p.provider,
              p.status,
              p.isTest ? "OUI" : "NON",
              p.createdAt.toISOString(),
              p.paidAt?.toISOString() ?? "",
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
              l.status,
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
