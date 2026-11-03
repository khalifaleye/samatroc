/**
 * Authentification SamaTroc (serveur uniquement)
 * - Mots de passe hachés avec bcrypt
 * - Sessions JWT signées (algorithme HS256), stockées dans un cookie httpOnly
 * - Contrôle des rôles côté serveur : VISITEUR / USER / ADMIN / SUPER_ADMIN
 */
import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const SESSION_COOKIE = "samatroc_session";
const SESSION_DURATION_S = 60 * 60 * 24 * 7; // 7 jours

function getSecret(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET || "samatroc-dev-secret-change-me-in-production-32chars";
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Crée la session (cookie httpOnly) pour un utilisateur */
export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("samatroc")
    .setExpirationTime(`${SESSION_DURATION_S}s`)
    .sign(getSecret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_S,
    path: "/",
  });
}

/** Supprime la session */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Retourne l'utilisateur connecté (vérification fraîche du statut et du rôle), ou null */
export async function getSessionUser() {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getSecret(), { issuer: "samatroc" });
    const userId = payload.sub;
    if (!userId) return null;

    const user = await db.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) return null;
    // Un compte suspendu ne bénéficie plus de session active
    if (user.status === "SUSPENDED") return null;
    return user;
  } catch {
    return null;
  }
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

/** Génère un jeton aléatoire (réinitialisation / vérification) */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash SHA-256 d'un jeton (stocké en base, jamais le jeton brut) */
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
