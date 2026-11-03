"use client";

import type { ReactNode } from "react";
import {
  ArrowLeftRight,
  Bell,
  CreditCard,
  FileText,
  Handshake,
  Heart,
  LayoutDashboard,
  Loader2,
  LogOut,
  MessageSquare,
  PackagePlus,
  Settings,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouter } from "@/stores/router-store";
import { useAuth } from "@/stores/auth-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Entrées du menu de l'espace personnel */
const MENU_ITEMS: { key: string; label: string; icon: typeof User; badge?: "messages" | "notifications" }[] = [
  { key: "dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { key: "profile", label: "Mon profil", icon: User },
  { key: "my-listings", label: "Mes annonces", icon: FileText },
  { key: "publish", label: "Publier un article", icon: PackagePlus },
  { key: "proposals", label: "Mes propositions", icon: Handshake },
  { key: "exchanges", label: "Mes échanges", icon: ArrowLeftRight },
  { key: "favorites", label: "Mes favoris", icon: Heart },
  { key: "messages", label: "Ma messagerie", icon: MessageSquare, badge: "messages" },
  { key: "payments", label: "Mes paiements", icon: CreditCard },
  { key: "notifications", label: "Notifications", icon: Bell, badge: "notifications" },
  { key: "settings", label: "Paramètres", icon: Settings },
];

/**
 * Coquille partagée de l'espace personnel : menu latéral (bureau) avec compteurs,
 * menu horizontal à puces défilantes (mobile), zone de contenu titrée.
 */
export default function AccountShell({
  active,
  title,
  children,
  actions,
}: {
  active: string;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const navigate = useRouter((s) => s.navigate);
  const user = useAuth((s) => s.user);

  // Les vues de l'espace personnel sont enveloppées par RequireAuth :
  // ce repli ne sert que pendant un rafraîchissement de session.
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3" role="status">
        <Loader2 className="animate-spin text-forest-600" size={32} aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Chargement de votre espace…</p>
      </div>
    );
  }

  const badges: Record<string, number> = {
    messages: user.unreadMessages ?? 0,
    notifications: user.unreadNotifications ?? 0,
  };

  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  async function handleLogout() {
    try {
      await useAuth.getState().logout();
      toast.success("Vous êtes déconnecté. À bientôt !");
      navigate("home");
    } catch {
      toast.error("Déconnexion impossible. Réessayez.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="lg:flex lg:gap-6">
        {/* ---------- Menu latéral (bureau) ---------- */}
        <Card className="mb-4 hidden p-3 lg:sticky lg:top-20 lg:mb-0 lg:block lg:h-fit lg:w-64 lg:shrink-0">
          <div className="max-h-[calc(100vh-6rem)] overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-3 rounded-xl bg-mint-50 p-3">
              <Avatar className="h-10 w-10 border border-mint-200">
                {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={`Avatar de ${user.firstName}`} /> : null}
                <AvatarFallback className="bg-forest-700 text-sm font-semibold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-forest-800">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <nav aria-label="Menu de l'espace personnel" className="mt-3 space-y-0.5">
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                const count = item.badge ? (badges[item.badge] ?? 0) : 0;
                const isActive = active === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => navigate(item.key)}
                    className={cn(
                      "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                      isActive
                        ? "bg-mint-100 font-semibold text-forest-800"
                        : "text-foreground/80 hover:bg-accent hover:text-forest-800"
                    )}
                  >
                    <Icon size={18} className={isActive ? "text-forest-700" : "text-muted-foreground"} aria-hidden="true" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {count > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-brand-500 px-1.5 text-[11px] font-bold text-white">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="mt-3 border-t border-border/70 pt-3">
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <LogOut size={18} aria-hidden="true" />
                Déconnexion
              </button>
            </div>
          </div>
        </Card>

        {/* ---------- Contenu ---------- */}
        <div className="min-w-0 flex-1">
          {/* Menu horizontal (mobile) */}
          <nav
            aria-label="Menu de l'espace personnel"
            className="mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:hidden custom-scrollbar"
          >
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const count = item.badge ? (badges[item.badge] ?? 0) : 0;
              const isActive = active === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => navigate(item.key)}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                    isActive
                      ? "border-forest-200 bg-mint-100 font-semibold text-forest-800"
                      : "border-border bg-white text-foreground/70 hover:bg-accent"
                  )}
                >
                  <Icon size={15} aria-hidden="true" />
                  {item.label}
                  {count > 0 && (
                    <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-emerald-brand-500 px-1 text-[10px] font-bold text-white">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-red-200 bg-white px-3.5 text-[13px] font-medium text-red-600 hover:bg-red-50"
            >
              <LogOut size={15} aria-hidden="true" />
              Déconnexion
            </button>
          </nav>

          {(title || actions) && (
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {title ? (
                <h1 className="text-xl font-bold text-forest-800 sm:text-2xl">{title}</h1>
              ) : (
                <span />
              )}
              {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}

/** Bouton d'action standard de l'en-tête de l'espace personnel */
export function ShellActionButton({
  onClick,
  children,
  variant = "outline",
}: {
  onClick: () => void;
  children: ReactNode;
  variant?: "outline" | "default";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={onClick}
      className={cn(
        "h-11",
        variant === "default" && "bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
      )}
    >
      {children}
    </Button>
  );
}
