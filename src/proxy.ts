/**
 * Proxy racine Next.js 16 (ex-middleware)
 * ---------------------------------------
 * • Rafraîchit les sessions Supabase Auth si configuré (mode Supabase)
 * • Applique des en-têtes de sécurité de base
 * • Mode pass-through complet si Supabase n'est pas configuré → l'application
 *   démo (SQLite + auth maison) fonctionne à l'identique.
 *
 * ⚠️ Ce fichier s'exécute en runtime Edge — n'y importer QUE des modules
 *    compatibles (pas de Node API, pas de "server-only").
 */
import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const response = await updateSupabaseSession(request);

  // En-têtes de sécurité de base (complètent next.config.ts)
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf :
     * - _next/static, _next/image (assets optimisés)
     * - favicon, fichiers statiques (images, uploads publics)
     * - api/payments/webhook (le prestataire ne porte pas de cookie de session)
     */
    "/((?!_next/static|_next/image|favicon|icon|images|uploads|manifest|robots|sitemap|api/payments/webhook).*)",
  ],
};
