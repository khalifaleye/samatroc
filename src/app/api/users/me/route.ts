import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { buildFullName, splitFullName } from "@/lib/auth";
import { requireAuth, handleRoute, readBody, ApiError, jsonOk } from "@/lib/api-utils";
import { updateProfileSchema } from "@/lib/validators";

/**
 * Mise à jour du profil — bascule Supabase (tâche 5-c) :
 * • `db.user` + relation `profile` → une seule table `profiles` ;
 * • firstName/lastName (champs de l'UI) → colonne unique `full_name`
 *   via buildFullName (mise à jour partielle : chaque partie est
 *   préservée si l'autre n'est pas envoyée) ;
 * • `quartier` → `neighborhood` ;
 * • `bio` et `whatsappEnabled` : colonnes supprimées du schéma — les
 *   champs sont acceptés (l'UI les envoie) mais ignorés ; le bloc
 *   `profile` de la réponse conserve le format historique (bio: null,
 *   whatsappEnabled: true) pour que les vues ne changent pas.
 */
export async function PATCH(req: NextRequest) {
  return handleRoute(async () => {
    const session = await requireAuth();
    const input = await readBody(req, updateProfileSchema);

    const current = await db.profile.findUnique({ where: { id: session.id } });
    if (!current) throw new ApiError(401, "Session invalide");

    const currentNames = splitFullName(current.fullName);
    const firstName = input.firstName !== undefined ? input.firstName : currentNames.firstName;
    const lastName = input.lastName !== undefined ? input.lastName : currentNames.lastName;

    const data: {
      fullName?: string;
      phone?: string | null;
      city?: string | null;
      avatarUrl?: string | null;
      neighborhood?: string | null;
      showPhone?: boolean;
    } = {};

    if (input.firstName !== undefined || input.lastName !== undefined) {
      data.fullName = buildFullName(firstName, lastName);
    }
    if (input.phone !== undefined) data.phone = input.phone || null;
    if (input.city !== undefined) data.city = input.city || null;
    if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl || null;
    if (input.quartier !== undefined) data.neighborhood = input.quartier || null;
    if (input.showPhone !== undefined) data.showPhone = input.showPhone;
    // bio / whatsappEnabled : acceptés mais non stockables (colonnes supprimées)

    const updated = await db.profile.update({ where: { id: session.id }, data });
    const names = splitFullName(updated.fullName);

    return jsonOk({
      user: {
        id: updated.id,
        email: updated.email,
        firstName: names.firstName,
        lastName: names.lastName,
        phone: updated.phone,
        avatarUrl: updated.avatarUrl,
        city: updated.city,
        role: updated.role,
        status: updated.accountStatus,
        emailVerified: session.emailVerified,
        phoneVerified: updated.phoneVerified,
        createdAt: updated.createdAt.toISOString(),
        profile: {
          bio: null,
          quartier: updated.neighborhood,
          showPhone: updated.showPhone,
          whatsappEnabled: true,
        },
      },
    });
  });
}
