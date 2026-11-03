import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleRoute, readBody, requireAdmin, requireSuperAdmin, ApiError, jsonOk, logAdminAction } from "@/lib/api-utils";
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

    const user = await db.user.findUnique({ where: { id } });
    if (!user) throw new ApiError(404, "Utilisateur introuvable");

    // Changement de rôle : super administrateur uniquement
    if (input.action === "setRole") {
      await requireSuperAdmin();
      if (!input.role) throw new ApiError(400, "Rôle requis");
      if (user.role === "SUPER_ADMIN") {
        throw new ApiError(409, "Le rôle d'un super administrateur ne peut être modifié");
      }
      await db.user.update({ where: { id }, data: { role: input.role } });
      await logAdminAction(admin.id, "USER_SET_ROLE", "USER", id, `Nouveau rôle : ${input.role}`);
      return jsonOk({ ok: true, message: `Rôle mis à jour : ${input.role}` });
    }

    if (input.action === "suspend") {
      if (user.role === "SUPER_ADMIN") throw new ApiError(409, "Un super administrateur ne peut être suspendu");
      await db.user.update({ where: { id }, data: { status: "SUSPENDED" } });
      await logAdminAction(admin.id, "USER_SUSPEND", "USER", id, `${user.firstName} ${user.lastName}`);
      return jsonOk({ ok: true, message: "Compte suspendu" });
    }

    if (input.action === "reactivate") {
      await db.user.update({ where: { id }, data: { status: "ACTIVE" } });
      await logAdminAction(admin.id, "USER_REACTIVATE", "USER", id, `${user.firstName} ${user.lastName}`);
      return jsonOk({ ok: true, message: "Compte réactivé" });
    }

    if (input.action === "edit") {
      const data: Record<string, unknown> = {};
      if (input.firstName) data.firstName = input.firstName;
      if (input.lastName) data.lastName = input.lastName;
      if (input.phone !== undefined) data.phone = input.phone || null;
      if (input.city !== undefined) data.city = input.city || null;
      await db.user.update({ where: { id }, data });
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

    const user = await db.user.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!user) throw new ApiError(404, "Utilisateur introuvable");

    const [listings, payments, proposalsCount, reportsAgainst] = await Promise.all([
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
        select: { reference: true, amount: true, status: true, provider: true, createdAt: true },
      }),
      db.exchangeProposal.count({ where: { proposerId: id } }),
      db.report.count({ where: { targetType: "USER", targetId: id } }),
    ]);

    return jsonOk({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        city: user.city,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        isDemo: user.isDemo,
        createdAt: user.createdAt.toISOString(),
        bio: user.profile?.bio ?? null,
      },
      listings: listings.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
      payments: payments.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
      proposalsCount,
      reportsAgainst,
    });
  });
}
