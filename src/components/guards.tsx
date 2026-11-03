"use client";

import { useEffect } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { useRouter } from "@/stores/router-store";
import { useAuth } from "@/stores/auth-store";
import { toast } from "sonner";
import type { ReactNode } from "react";

/**
 * Garde d'accès côté client (le contrôle réel est toujours refait côté serveur).
 * Redirige vers la connexion si l'utilisateur n'est pas authentifié.
 */
export function RequireAuth({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, status } = useAuth();
  const navigate = useRouter((s) => s.navigate);

  useEffect(() => {
    if (status === "guest") {
      toast.info("Connectez-vous pour accéder à cette page");
      navigate("login");
    } else if (status === "authenticated" && adminOnly && user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      toast.error("Accès réservé aux administrateurs");
      navigate("home");
    }
  }, [status, user, adminOnly, navigate]);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3" role="status" aria-live="polite">
        <Loader2 className="animate-spin text-forest-600" size={32} />
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if (status === "guest" || (adminOnly && user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN")) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <ShieldAlert className="text-muted-foreground" size={32} />
        <p className="text-sm text-muted-foreground">Redirection…</p>
      </div>
    );
  }

  return <>{children}</>;
}
