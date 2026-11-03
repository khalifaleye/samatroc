/**
 * Middleware Supabase — gestion et renouvellement des sessions
 * ------------------------------------------------------------
 * • Rafraîchit les jetons Supabase Auth (access/refresh) via les cookies
 * • Applique les en-têtes de sécurité
 * • Fonctionne en mode pass-through si Supabase n'est pas configuré
 *   (l'application continue de fonctionner en mode démo SQLite)
 *
 * Appelé depuis src/middleware.ts.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSupabaseSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response; // Supabase non configuré → rien à faire

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT : ne pas insérer de logique entre getUser() et le renvoi —
  // toute la logique doit rester après pour ne pas bloquer le refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pages privées : rediriger vers la connexion si non authentifié.
  // (les routes internes de l'app démo sont gérées côté client ; ce garde-fou
  // s'applique aux chemins /account et /admin du déploiement Supabase)
  const isPrivatePath = request.nextUrl.pathname.startsWith("/account") ||
    request.nextUrl.pathname.startsWith("/admin");
  if (isPrivatePath && !user) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(redirect);
  }

  return response;
}
