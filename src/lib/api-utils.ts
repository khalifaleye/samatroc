/**
 * Utilitaires API SamaTroc (serveur)
 * - Réponses JSON normalisées
 * - Gestion centralisée des erreurs
 * - Garde d'accès : requireAuth / requireAdmin
 */
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { getSessionUser, type SessionUser } from "@/lib/auth";

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** Wrapper principal : intercepte ApiError / ZodError et renvoie une réponse propre */
export async function handleRoute<T>(
  fn: () => Promise<Response>
): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, fields: error.fields },
        { status: error.status }
      );
    }
    if (error instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of error.issues) {
        const key = issue.path.join(".") || "form";
        if (!fields[key]) fields[key] = issue.message;
      }
      return NextResponse.json(
        { error: "Données invalides", fields },
        { status: 400 }
      );
    }
    console.error("[API ERROR]", error);
    return NextResponse.json(
      { error: "Une erreur interne est survenue. Veuillez réessayer." },
      { status: 500 }
    );
  }
}

/** Parse et valide le corps JSON avec un schéma Zod */
export async function readBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Corps de requête invalide (JSON attendu)");
  }
  return schema.parse(raw);
}

/** Exige un utilisateur connecté (compte actif) */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new ApiError(401, "Vous devez être connecté pour effectuer cette action");
  }
  return user;
}

/** Exige un rôle administrateur (ADMIN ou SUPER_ADMIN) */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    throw new ApiError(403, "Accès réservé aux administrateurs");
  }
  return user;
}

/** Exige le rôle super administrateur */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== "SUPER_ADMIN") {
    throw new ApiError(403, "Accès réservé au super administrateur");
  }
  return user;
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "inconnue"
  );
}

/** Échappe les caractères spéciaux pour une requête LIKE SQL (anti-injection par wildcard) */
export function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

/** Journalise une action administrative sensible */
export async function logAdminAction(
  adminId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: string
) {
  const { db } = await import("@/lib/db");
  await db.adminLog.create({
    data: { adminId, action, targetType, targetId, details },
  });
}
