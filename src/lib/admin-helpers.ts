import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Helpers du domaine ADMINISTRATION (back-office) — SamaTroc.
 * Le serializer partagé des annonces vit dans src/lib/serializers.ts (contrat
 * ListingSummary identique côté public et admin) ; ce fichier ne regroupe que
 * les besoins propres aux routes /api/admin/*.
 */

/**
 * Identifiants dont l'e-mail est confirmé dans Supabase Auth (auth.users).
 * Depuis la bascule, la colonne démo `profiles.email_verified` n'existe plus :
 * la confirmation vit dans `auth.users.email_confirmed_at`. Une seule requête
 * sur le lot de la page (backend de confiance, rôle postgres). En cas
 * d'indisponibilité du schéma `auth`, on retombe sur « tous confirmés »
 * (comportement optimiste : une session active suppose un e-mail confirmé).
 */
export async function lookupConfirmedEmails(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  try {
    const rows = await db.$queryRaw<{ id: string }[]>`
      select id
      from auth.users
      where id in (${Prisma.join(ids)})
        and email_confirmed_at is not null`;
    return new Set(rows.map((row) => row.id));
  } catch (error) {
    console.error("[admin] lecture auth.users indisponible :", error);
    return new Set(ids);
  }
}
