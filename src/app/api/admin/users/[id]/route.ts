import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, readBody, requireAdmin, requireSuperAdmin, ApiError, jsonOk, logAdminAction } from "@/lib/api-utils";
import { buildFullName, splitFullName } from "@/lib/auth";
import { legacyListingStatus, legacyPaymentStatus, isTestPayment } from "@/lib/payments";
import { lookupConfirmedEmails } from "@/lib/admin-helpers";
import { adminUserUpdateSchema } from "@/lib/validators";

/** Actions administrateur sur un compte utilisateur */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const input = await readBody(req, adminUserUpdateSchema);

    const user = await db.profile.findUnique({ where: { id } });
    if (!user) throw new ApiError(404, "Utilisateur introuvable");
    const { firstName: currentFirst, lastName: currentLast } = splitFullName(user.fullName);

    // Changement de rôle : super administrateur uniquement
    if (input.action === "setRole") {
      await requireSuperAdmin();
      if (!input.role) throw new ApiError(400, "Rôle requis");
      if (user.role === "SUPER_ADMIN") {
        throw new ApiError(409, "Le rôle d'un super administrateur ne peut être modifié");
      }
      await db.profile.update({ where: { id }, data: { role: input.role } });
      await logAdminAction(admin.id, "USER_SET_ROLE", "USER", id, `Nouveau rôle : ${input.role}`);
      return jsonOk({ ok: true, message: `Rôle mis à jour : ${input.role}` });
    }

    if (input.action === "suspend") {
      if (user.role === "SUPER_ADMIN") throw new ApiError(409, "Un super administrateur ne peut être suspendu");
      // Bascule Supabase : user.status → profile.accountStatus
      await db.profile.update({ where: { id }, data: { accountStatus: "SUSPENDED" } });
      await logAdminAction(admin.id, "USER_SUSPEND", "USER", id, user.fullName);
      return jsonOk({ ok: true, message: "Compte suspendu" });
    }

    if (input.action === "reactivate") {
      await db.profile.update({ where: { id }, data: { accountStatus: "ACTIVE" } });
      await logAdminAction(admin.id, "USER_REACTIVATE", "USER", id, user.fullName);
      return jsonOk({ ok: true, message: "Compte réactivé" });
    }

    if (input.action === "edit") {
      const data: Record<string, unknown> = {};
      // fullName unique : on recombine les parties modifiées avec l'existant
      if (input.firstName !== undefined || input.lastName !== undefined) {
        data.fullName = buildFullName(
          input.firstName ?? currentFirst,
          input.lastName ?? currentLast
        );
      }
      if (input.phone !== undefined) data.phone = input.phone || null;
      if (input.city !== undefined) data.city = input.city || null;
      await db.profile.update({ where: { id }, data });
      await logAdminAction(admin.id, "USER_EDIT", "USER", id, JSON.stringify(data));
      return jsonOk({ ok: true, message: "Informations mises à jour" });
    }

    throw new ApiError(400, "Action inconnue");
  });
}

/** Historique détaillé d'un utilisateur */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await params;

    const user = await db.profile.findUnique({ where: { id } });
    if (!user) throw new ApiError(404, "Utilisateur introuvable");

    const [listings, payments, proposalsCount, reportsAgainst, verified] = await Promise.all([
      db.listing.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, title: true, status: true, createdAt: true },
      }),
      db.payment.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          transactionReference: true,
          amount: true,
          status: true,
          paymentProvider: true,
          createdAt: true,
        },
      }),
      db.exchangeProposal.count({ where: { proposerId: id } }),
      // Spec Supabase : un signalement vise listing_id et/ou reported_user_id
      db.report.count({ where: { reportedUserId: id } }),
      lookupConfirmedEmails([id]),
    ]);

    const { firstName, lastName } = splitFullName(user.fullName);

    return jsonOk({
      user: {
        id: user.id,
        firstName,
        lastName,
        email: user.email,
        phone: user.phone,
        city: user.city,
        role: user.role,
        status: user.accountStatus,
        emailVerified: verified.has(user.id),
        isDemo: false,
        createdAt: user.createdAt.toISOString(),
        // Colonne bio disparue avec la bascule (contrat des vues conservé)
        bio: null,
      },
      listings: listings.map((l) => ({
        id: l.id,
        title: l.title,
        status: legacyListingStatus(l.status),
        createdAt: l.createdAt.toISOString(),
      })),
      payments: payments.map((p) => ({
        reference: p.transactionReference,
        amount: p.amount,
        status: legacyPaymentStatus(p.status),
        provider: p.paymentProvider,
        isTest: isTestPayment(p.paymentProvider),
        createdAt: p.createdAt.toISOString(),
      })),
      proposalsCount,
      reportsAgainst,
    });
  });
}
