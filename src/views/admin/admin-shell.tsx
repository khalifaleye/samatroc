"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CreditCard,
  FileEdit,
  FileText,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/stores/auth-store";
import { useNavigate } from "@/stores/router-store";
import { cn } from "@/lib/utils";

import AdminDashboard from "./dashboard";
import AdminUsers from "./users";
import AdminListings from "./listings";
import AdminPayments from "./payments";
import AdminCategories from "./categories";
import AdminReports from "./reports";
import AdminContent from "./content";
import AdminSettings from "./settings";
import AdminLogs from "./logs";

interface AdminMenuItem {
  key: string;
  label: string;
  icon: LucideIcon;
}

const ADMIN_MENU: AdminMenuItem[] = [
  { key: "admin-dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { key: "admin-users", label: "Utilisateurs", icon: Users },
  { key: "admin-listings", label: "Annonces", icon: FileText },
  { key: "admin-payments", label: "Paiements", icon: CreditCard },
  { key: "admin-categories", label: "Catégories", icon: Tags },
  { key: "admin-reports", label: "Signalements", icon: AlertTriangle },
  { key: "admin-content", label: "Contenu", icon: FileEdit },
  { key: "admin-settings", label: "Paramètres", icon: Settings },
  { key: "admin-logs", label: "Journal", icon: ScrollText },
];

const SECTION_META: Record<string, { title: string; subtitle: string }> = {
  "admin-dashboard": {
    title: "Tableau de bord",
    subtitle: "Vue d'ensemble de l'activité de la plateforme SamaTroc",
  },
  "admin-users": {
    title: "Gestion des utilisateurs",
    subtitle: "Recherchez, consultez et gérez les comptes membres",
  },
  "admin-listings": {
    title: "Gestion des annonces",
    subtitle: "Modérez, corrigez et supervisez les annonces déposées",
  },
  "admin-payments": {
    title: "Gestion des paiements",
    subtitle: "Suivi des frais de publication encaissés par la plateforme",
  },
  "admin-categories": {
    title: "Gestion des catégories",
    subtitle: "Organisez le référentiel des catégories d'articles",
  },
  "admin-reports": {
    title: "Signalements",
    subtitle: "Traitez les signalements envoyés par la communauté",
  },
  "admin-content": {
    title: "Contenu éditorial",
    subtitle: "Rédigez et mettez à jour les pages statiques du site",
  },
  "admin-settings": {
    title: "Paramètres généraux",
    subtitle: "Configuration de la plateforme et des statistiques de démonstration",
  },
  "admin-logs": {
    title: "Journal administratif",
    subtitle: "Traçabilité de toutes les actions sensibles effectuées par l'équipe",
  },
};

/** Corps de la vue courante selon la clé admin-* */
function AdminSectionBody({ view }: { view: string }) {
  switch (view) {
    case "admin-dashboard":
      return <AdminDashboard />;
    case "admin-users":
      return <AdminUsers />;
    case "admin-listings":
      return <AdminListings />;
    case "admin-payments":
      return <AdminPayments />;
    case "admin-categories":
      return <AdminCategories />;
    case "admin-reports":
      return <AdminReports />;
    case "admin-content":
      return <AdminContent />;
    case "admin-settings":
      return <AdminSettings />;
    case "admin-logs":
      return <AdminLogs />;
    default:
      return <AdminDashboard />;
  }
}

/**
 * Conteneur du back-office SamaTroc : navigation latérale + titre de section,
 * puis rendu de la section demandée via la prop `view`.
 */
export default function AdminShell({ view }: { view: string }) {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const meta = SECTION_META[view] ?? SECTION_META["admin-dashboard"];
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 grid lg:grid-cols-[240px_1fr] gap-6">
      {/* Barre latérale (bureau) */}
      <aside className="hidden lg:block" aria-label="Navigation administration">
        <Card className="sticky top-20 h-fit overflow-hidden border-mint-200 shadow-card">
          <div className="p-4 border-b bg-mint-50/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-700">
                <ShieldCheck className="text-white" size={20} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-forest-800 leading-tight">Administration</p>
                <p className="text-xs text-muted-foreground">SamaTroc</p>
              </div>
            </div>
            <div className="mt-3">
              <Badge
                className={cn(
                  "font-semibold",
                  isSuperAdmin ? "bg-forest-800 text-white" : "bg-mint-100 text-forest-700"
                )}
              >
                {isSuperAdmin ? "Super admin" : "Admin"}
              </Badge>
            </div>
          </div>
          <CardContent className="p-2">
            <nav aria-label="Menu d'administration">
              <ul className="space-y-1">
                {ADMIN_MENU.map((item) => {
                  const Icon = item.icon;
                  const active = view === item.key;
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => navigate(item.key)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors text-left",
                          active
                            ? "bg-mint-100 font-semibold text-forest-800"
                            : "text-forest-700/80 hover:bg-mint-50 hover:text-forest-800"
                        )}
                      >
                        <Icon size={17} className="shrink-0" aria-hidden="true" />
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </CardContent>
          <div className="p-3 border-t">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => navigate("home")}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Retour au site
            </Button>
          </div>
        </Card>
      </aside>

      {/* Corps principal */}
      <div className="min-w-0">
        {/* Menu chips (mobile) */}
        <div
          className="lg:hidden flex gap-2 overflow-x-auto custom-scrollbar pb-2 mb-4"
          role="navigation"
          aria-label="Menu d'administration (mobile)"
        >
          {ADMIN_MENU.map((item) => {
            const active = view === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-forest-700 text-white border-forest-700"
                    : "bg-white text-forest-700 border-mint-200 hover:bg-mint-50"
                )}
              >
                <item.icon size={14} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>

        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold text-forest-800">{meta.title}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">{meta.subtitle}</p>
        </header>

        <AdminSectionBody view={view} />
      </div>
    </div>
  );
}
