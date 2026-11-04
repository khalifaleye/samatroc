/**
 * Authentification SamaTroc — Supabase Auth (serveur uniquement)
 * ---------------------------------------------------------------------------
 * • Les sessions sont gérées par Supabase Auth (@supabase/ssr) : les jetons
 *   access/refresh vivent dans des cookies posés par src/proxy.ts (refresh) et
 *   par les clients serveur lors de signUp / signInWithPassword / signOut.
 * • Le profil applicatif (table `profiles`) est lu via Prisma (connexion
 *   directe PostgreSQL — backend de confiance, la RLS ne s'applique pas).
 * • Plus de JWT maison, plus de bcrypt, plus de tokens de vérification :
 *   Supabase Auth gère l'inscription, la confirmation d'e-mail et les
 *   réinitialisations de mot de passe.
 *
 * CONTRAT DE getSessionUser() (point d'entrée unique, ~33 consommateurs) :
 *   → `SessionUser | null`
 *   null si : non connecté, profil inexistant, ou `accountStatus !== "ACTIVE"`
 *   (SUSPENDED / BANNED / DELETED = traité comme non connecté).
 *
 *   SessionUser (construit depuis Profile + l'utilisateur Supabase Auth) :
 *     id            : string  — = auth.users.id = profiles.id
 *     email         : string
 *     username      : string
 *     fullName      : string  — colonne unique `full_name`
 *     firstName     : string  — dérivé (split du premier espace)
 *     lastName      : string  — dérivé (reste après le premier espace, "" si absent)
 *     phone         : string | null
 *     avatarUrl     : string | null
 *     city          : string | null
 *     region        : string | null
 *     neighborhood  : string | null
 *     role          : UserRole — USER | ADMIN | SUPER_ADMIN
 *     status        : AccountStatus — ALIAS rétro-compatible de accountStatus
 *     accountStatus : AccountStatus — ACTIVE | SUSPENDED | BANNED | DELETED
 *     showPhone     : boolean
 *     phoneVerified : boolean
 *     emailVerified : boolean — dérivé de auth.users.email_confirmed_at
 *     createdAt     : Date
 */
import "server-only";
import type { User } from "@supabase/supabase-js";
import type { AccountStatus, Profile, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { getSupabaseUser } from "@/lib/supabase/server";

/** Utilisateur de session applicatif — voir le contrat détaillé en tête de fichier. */
export type SessionUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  city: string | null;
  region: string | null;
  neighborhood: string | null;
  role: UserRole;
  /** Alias rétro-compatible de `accountStatus` (ancien `user.status`). */
  status: AccountStatus;
  accountStatus: AccountStatus;
  showPhone: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  createdAt: Date;
};

/**
 * Dissocie un nom complet « Prénom Nom » (premier espace = séparateur).
 * Les vues envoient firstName/lastName ; la base ne stocke que full_name.
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const separatorIndex = trimmed.indexOf(" ");
  if (separatorIndex === -1) {
    return { firstName: trimmed, lastName: "" };
  }
  return {
    firstName: trimmed.slice(0, separatorIndex),
    lastName: trimmed.slice(separatorIndex + 1),
  };
}

/** Construit le nom complet à partir des champs du formulaire d'inscription. */
export function buildFullName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, " ").trim();
}

/** Construit le SessionUser depuis le profil Prisma (+ l'utilisateur Supabase Auth). */
export function toSessionUser(profile: Profile, authUser: User): SessionUser {
  const { firstName, lastName } = splitFullName(profile.fullName);
  return {
    id: profile.id,
    email: profile.email,
    username: profile.username,
    fullName: profile.fullName,
    firstName,
    lastName,
    phone: profile.phone,
    avatarUrl: profile.avatarUrl,
    city: profile.city,
    region: profile.region,
    neighborhood: profile.neighborhood,
    role: profile.role,
    status: profile.accountStatus,
    accountStatus: profile.accountStatus,
    showPhone: profile.showPhone,
    phoneVerified: profile.phoneVerified,
    emailVerified: Boolean(authUser.email_confirmed_at),
    createdAt: profile.createdAt,
  };
}

/**
 * Retourne l'utilisateur connecté (profil chargé via Prisma), ou null :
 * non connecté, profil introuvable, ou compte non actif.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const authUser = await getSupabaseUser();
    if (!authUser) return null;

    const profile = await db.profile.findUnique({ where: { id: authUser.id } });
    if (!profile) return null;

    // Un compte suspendu / banni / supprimé ne bénéficie plus de session active
    if (profile.accountStatus !== "ACTIVE") return null;

    return toSessionUser(profile, authUser);
  } catch {
    return null;
  }
}

const PROFILE_RETRY_DELAY_MS = 150;
const PROFILE_MAX_ATTEMPTS = 10;

/**
 * Charge le profil créé par le trigger SQL `handle_new_user` après un signUp.
 * Le trigger est synchrone en base : le profil existe déjà au retour de
 * signUp ; la boucle n'est qu'une précaution (latence réseau/positionnement
 * de la lecture). Retourne null si le profil n'apparaît pas à temps.
 */
export async function loadProfileAfterSignUp(id: string): Promise<Profile | null> {
  for (let attempt = 0; attempt < PROFILE_MAX_ATTEMPTS; attempt++) {
    const profile = await db.profile.findUnique({ where: { id } });
    if (profile) return profile;
    await new Promise((resolve) => setTimeout(resolve, PROFILE_RETRY_DELAY_MS));
  }
  return null;
}

/**
 * Extrait le code d'échange PKCE (`?code=…`) d'un lien e-mail Supabase, ou
 * retourne le jeton brut si l'utilisateur a collé le code seul. Utilisé par
 * /api/auth/reset-password et /api/auth/verify-email (UI inchangée : l'utilisateur
 * colle le code — ou le lien complet — reçu par e-mail).
 */
export function extractSupabaseCode(rawToken: string): string {
  const raw = rawToken.trim();
  if (!raw) return "";
  const match = raw.match(/[?&]code=([A-Za-z0-9\-_.]+)/);
  return match ? match[1] : raw;
}

/** Erreur d'authentification mappée vers le format de réponse de l'API. */
export interface MappedAuthError {
  status: number;
  message: string;
  fields?: Record<string, string>;
}

interface SupabaseErrorShape {
  status?: unknown;
  code?: unknown;
  message?: unknown;
}

function readSupabaseError(error: unknown): SupabaseErrorShape {
  if (typeof error === "object" && error !== null) {
    return error as SupabaseErrorShape;
  }
  return {};
}

/**
 * Traduit une erreur du SDK Supabase Auth vers le contrat d'erreur de l'API
 * ({ status, message, fields? }). `fallbackStatus` / `fallbackMessage` servent
 * pour les erreurs non reconnues (message passe-partout, pas de fuite interne).
 */
export function mapSupabaseAuthError(
  error: unknown,
  fallbackStatus: number,
  fallbackMessage: string
): MappedAuthError {
  const shape = readSupabaseError(error);
  const code = typeof shape.code === "string" ? shape.code : "";
  const message = typeof shape.message === "string" ? shape.message : "";
  const httpStatus = typeof shape.status === "number" ? shape.status : undefined;

  if (
    code === "user_already_exists" ||
    /already (registered|exists)/i.test(message)
  ) {
    return {
      status: 409,
      message: "Un compte existe déjà avec cette adresse e-mail",
      fields: { email: "Cette adresse e-mail est déjà utilisée" },
    };
  }

  if (code === "email_not_confirmed" || /email.*not (confirmed|verified)/i.test(message)) {
    return {
      status: 403,
      message:
        "Votre adresse e-mail n'est pas encore vérifiée. Consultez votre boîte de réception.",
      fields: { email: "Adresse e-mail non vérifiée" },
    };
  }

  if (
    code === "weak_password" ||
    /password should be|password.*at least|weak password/i.test(message)
  ) {
    return {
      status: 400,
      message: "Le mot de passe est trop faible",
      fields: { password: message || "Choisissez un mot de passe plus robuste" },
    };
  }

  if (code === "validation_failed" || /invalid.*(email|credentials format)/i.test(message)) {
    return {
      status: 400,
      message: "Données invalides",
      fields: { email: "Adresse e-mail invalide" },
    };
  }

  if (code === "over_email_send_rate_limit" || httpStatus === 429 || /rate limit/i.test(message)) {
    return {
      status: 429,
      message: "Trop de tentatives. Réessayez dans quelques minutes.",
    };
  }

  return { status: fallbackStatus, message: fallbackMessage };
}
