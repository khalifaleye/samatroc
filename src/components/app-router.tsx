"use client";

import { useEffect, useRef } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useRouter } from "@/stores/router-store";
import { useAuth } from "@/stores/auth-store";
import { RequireAuth } from "@/components/guards";
import { ViewNotFound } from "@/views/public/not-found";

import HomeView from "@/views/public/home";
import ExploreView from "@/views/public/explore";
import ListingDetailView from "@/views/public/listing-detail";
import CategoriesView from "@/views/public/categories";
import AboutView from "@/views/public/about";
import HowItWorksView from "@/views/public/how-it-works";
import FaqView from "@/views/public/faq";
import ContactView from "@/views/public/contact";
import SafetyView from "@/views/public/safety";
import LegalView from "@/views/public/legal";
import LoginView from "@/views/auth/login";
import RegisterView from "@/views/auth/register";
import ForgotPasswordView from "@/views/auth/forgot-password";
import ResetPasswordView from "@/views/auth/reset-password";
import DashboardView from "@/views/account/dashboard";
import ProfileView from "@/views/account/profile";
import MyListingsView from "@/views/account/my-listings";
import PublishView from "@/views/account/publish";
import ProposalsView from "@/views/account/proposals";
import ExchangesView from "@/views/account/exchanges";
import FavoritesView from "@/views/account/favorites";
import MessagesView from "@/views/account/messages";
import PaymentsView from "@/views/account/payments";
import NotificationsView from "@/views/account/notifications";
import SettingsView from "@/views/account/settings";
import AdminShell from "@/views/admin/admin-shell";

const VIEW_TITLES: Record<string, string> = {
  home: "SamaTroc - Échangez vos articles en toute simplicité",
  explore: "Explorer les annonces",
  listing: "Détail de l'annonce",
  categories: "Toutes les catégories",
  about: "À propos",
  "how-it-works": "Comment ça marche ?",
  faq: "FAQ",
  contact: "Contact & assistance",
  safety: "Conseils de sécurité",
  cgu: "Conditions générales d'utilisation",
  privacy: "Politique de confidentialité",
  moderation: "Politique de modération",
  login: "Connexion",
  register: "Inscription",
  "forgot-password": "Mot de passe oublié",
  "reset-password": "Nouveau mot de passe",
  dashboard: "Tableau de bord",
  profile: "Mon profil",
  "my-listings": "Mes annonces",
  publish: "Publier un article",
  proposals: "Mes propositions d'échange",
  exchanges: "Mes échanges",
  favorites: "Mes favoris",
  messages: "Ma messagerie",
  payments: "Mes paiements",
  notifications: "Notifications",
  settings: "Paramètres",
};

/**
 * Routeur de vues SamaTroc : aiguille chaque vue enregistrée,
 * met à jour le titre du document et recharge la session au démarrage.
 */
export function AppRouter() {
  const { view, params, query, navigate } = useRouter();
  const refresh = useAuth((s) => s.refresh);
  const bootedRef = useRef(false);

  useEffect(() => {
    if (!bootedRef.current) {
      bootedRef.current = true;
      void refresh();
    }
  }, [refresh]);

  useEffect(() => {
    document.title = VIEW_TITLES[view] ?? "SamaTroc";
  }, [view]);

  const renderView = () => {
    switch (view) {
      // ---------- Public ----------
      case "home":
        return <HomeView />;
      case "explore":
        return <ExploreView query={query} />;
      case "listing":
        return params.id ? <ListingDetailView id={params.id} /> : <ViewNotFound />;
      case "categories":
        return <CategoriesView query={query} />;
      case "about":
        return <AboutView />;
      case "how-it-works":
        return <HowItWorksView />;
      case "faq":
        return <FaqView />;
      case "contact":
        return <ContactView />;
      case "safety":
        return <SafetyView />;
      case "cgu":
        return <LegalView page="CGU" />;
      case "privacy":
        return <LegalView page="PRIVACY" />;
      case "moderation":
        return <LegalView page="MODERATION" />;

      // ---------- Authentification ----------
      case "login":
        return <LoginView />;
      case "register":
        return <RegisterView />;
      case "forgot-password":
        return <ForgotPasswordView />;
      case "reset-password":
        return <ResetPasswordView token={params.token} />;

      // ---------- Espace personnel ----------
      case "dashboard":
        return (
          <RequireAuth>
            <DashboardView />
          </RequireAuth>
        );
      case "profile":
        return (
          <RequireAuth>
            <ProfileView />
          </RequireAuth>
        );
      case "my-listings":
        return (
          <RequireAuth>
            <MyListingsView />
          </RequireAuth>
        );
      case "publish":
        return (
          <RequireAuth>
            <PublishView editId={params.editId ?? null} />
          </RequireAuth>
        );
      case "proposals":
        return (
          <RequireAuth>
            <ProposalsView />
          </RequireAuth>
        );
      case "exchanges":
        return (
          <RequireAuth>
            <ExchangesView />
          </RequireAuth>
        );
      case "favorites":
        return (
          <RequireAuth>
            <FavoritesView />
          </RequireAuth>
        );
      case "messages":
        return (
          <RequireAuth>
            <MessagesView conversationId={params.id ?? null} />
          </RequireAuth>
        );
      case "payments":
        return (
          <RequireAuth>
            <PaymentsView />
          </RequireAuth>
        );
      case "notifications":
        return (
          <RequireAuth>
            <NotificationsView />
          </RequireAuth>
        );
      case "settings":
        return (
          <RequireAuth>
            <SettingsView />
          </RequireAuth>
        );

      // ---------- Administration ----------
      case "admin-dashboard":
      case "admin-users":
      case "admin-listings":
      case "admin-payments":
      case "admin-categories":
      case "admin-reports":
      case "admin-content":
      case "admin-settings":
      case "admin-logs":
        return (
          <RequireAuth adminOnly>
            <AdminShell view={view} />
          </RequireAuth>
        );

      default:
        return <ViewNotFound />;
    }
  };

  // Vues plein écran (auth) : sans footer lourd
  const isAuthView = ["login", "register", "forgot-password", "reset-password"].includes(view);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main id="contenu-principal" className="flex-1">
        {renderView()}
      </main>
      {!isAuthView && <Footer />}
      {isAuthView && (
        <footer className="mt-auto py-4 text-center text-xs text-muted-foreground bg-white border-t">
          © {new Date().getFullYear()} SamaTroc — Échangez • Économisez • Donnez une seconde vie
        </footer>
      )}
      {/* navigation accessible via la touche Retour arrière du navigateur n'est pas applicable en SPA */}
      <span className="hidden" data-view={view} onClick={() => navigate("home")} />
    </div>
  );
}
