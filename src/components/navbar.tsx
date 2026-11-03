"use client";

import { useEffect, useState } from "react";
import { Search, User, Menu, Bell, LogOut, LayoutDashboard, Heart, MessageSquare, PackagePlus, Settings, ShieldCheck, FileText, Info, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/logo";
import { useRouter } from "@/stores/router-store";
import { useAuth } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

export function Navbar() {
  const navigate = useRouter((s) => s.navigate);
  const view = useRouter((s) => s.view);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate("explore", {}, searchQuery.trim() ? { q: searchQuery.trim() } : {});
  }

  async function handleLogout() {
    await logout();
    navigate("home");
  }

  const isActive = (v: string) => view === v;

  const navLinks = (
    <>
      <button
        onClick={() => { navigate("explore"); setMobileOpen(false); }}
        className={cn("text-sm font-medium transition-colors hover:text-forest-600", isActive("explore") ? "text-forest-700 font-semibold" : "text-forest-900/80")}
      >
        Annonces
      </button>
      <button
        onClick={() => { navigate("categories"); setMobileOpen(false); }}
        className={cn("text-sm font-medium transition-colors hover:text-forest-600", isActive("categories") ? "text-forest-700 font-semibold" : "text-forest-900/80")}
      >
        Catégories
      </button>
      <button
        onClick={() => { navigate("how-it-works"); setMobileOpen(false); }}
        className={cn("text-sm font-medium transition-colors hover:text-forest-600", isActive("how-it-works") ? "text-forest-700 font-semibold" : "text-forest-900/80")}
      >
        Comment ça marche ?
      </button>
      <button
        onClick={() => { navigate("safety"); setMobileOpen(false); }}
        className={cn("text-sm font-medium transition-colors hover:text-forest-600", isActive("safety") ? "text-forest-700 font-semibold" : "text-forest-900/80")}
      >
        Sécurité
      </button>
    </>
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 border-b border-border transition-shadow",
        scrolled && "shadow-card"
      )}
    >
      <a
        href="#contenu-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2 focus:rounded-md focus:shadow"
      >
        Aller au contenu principal
      </a>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center gap-3 sm:gap-5">
          {/* Mobile : menu burger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden text-forest-800" aria-label="Ouvrir le menu">
                <Menu size={22} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="p-4 border-b">
                <SheetTitle className="sr-only">Menu de navigation mobile</SheetTitle>
                <Logo size="sm" />
              </div>
              <nav className="flex flex-col p-4 gap-1" aria-label="Menu mobile">
                {navLinks}
                <div className="h-px bg-border my-2" />
                {user ? (
                  <>
                    <button onClick={() => { navigate("dashboard"); setMobileOpen(false); }} className="flex items-center gap-2 text-sm font-medium px-2 py-2 rounded-md hover:bg-accent">
                      <LayoutDashboard size={16} /> Tableau de bord
                    </button>
                    <button onClick={() => { navigate("publish"); setMobileOpen(false); }} className="flex items-center gap-2 text-sm font-medium px-2 py-2 rounded-md hover:bg-accent">
                      <PackagePlus size={16} /> Publier un article
                    </button>
                    <button onClick={() => { navigate("messages"); setMobileOpen(false); }} className="flex items-center gap-2 text-sm font-medium px-2 py-2 rounded-md hover:bg-accent">
                      <MessageSquare size={16} /> Messagerie
                    </button>
                    <button onClick={() => { navigate("favorites"); setMobileOpen(false); }} className="flex items-center gap-2 text-sm font-medium px-2 py-2 rounded-md hover:bg-accent">
                      <Heart size={16} /> Favoris
                    </button>
                    <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium px-2 py-2 rounded-md hover:bg-red-50 text-red-600">
                      <LogOut size={16} /> Déconnexion
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 mt-2">
                    <Button onClick={() => { navigate("login"); setMobileOpen(false); }} variant="outline" className="w-full">
                      Se connecter
                    </Button>
                    <Button onClick={() => { navigate("register"); setMobileOpen(false); }} className="w-full bg-forest-700 hover:bg-forest-800">
                      S&apos;inscrire
                    </Button>
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <button
            onClick={() => navigate("home")}
            aria-label="SamaTroc - Accueil"
            className="shrink-0"
          >
            <Logo size="md" showSlogan={false} className="hidden sm:flex" />
            <Logo size="sm" showSlogan={false} className="sm:hidden" />
          </button>

          {/* Recherche (desktop) */}
          <form onSubmit={submitSearch} role="search" className="hidden md:flex flex-1 max-w-xl mx-auto">
            <div className="relative w-full">
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un article, une catégorie..."
                aria-label="Rechercher un article ou une catégorie"
                className="pr-12 h-11 rounded-full bg-gray-50 border-border pl-4"
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Lancer la recherche"
                className="absolute right-1 top-1 h-9 w-9 rounded-full bg-forest-600 hover:bg-forest-700"
              >
                <Search size={17} />
              </Button>
            </div>
          </form>

          {/* Liens desktop */}
          <nav className="hidden lg:flex items-center gap-5" aria-label="Navigation principale">
            {navLinks}
          </nav>

          {/* Actions droite */}
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <Button
                  onClick={() => navigate("publish")}
                  className="hidden sm:inline-flex bg-forest-700 hover:bg-forest-800 rounded-full h-10"
                >
                  <PackagePlus size={17} className="mr-1" /> Publier
                </Button>

                {/* Notifications */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative text-forest-800"
                  aria-label={`Notifications${user.unreadNotifications > 0 ? ` (${user.unreadNotifications} non lues)` : ""}`}
                  onClick={() => navigate("notifications")}
                >
                  <Bell size={20} />
                  {user.unreadNotifications > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4.5 min-w-4.5 px-1 h-[18px] rounded-full bg-mango-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {user.unreadNotifications > 9 ? "9+" : user.unreadNotifications}
                    </span>
                  )}
                </Button>

                {/* Profil */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-ring" aria-label="Menu du compte">
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarImage src={user.avatarUrl ?? undefined} alt={`${user.firstName} ${user.lastName}`} />
                        <AvatarFallback className="bg-forest-100 text-forest-700 font-semibold text-sm">
                          {user.firstName[0]}
                          {user.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuLabel>
                      <div className="font-semibold">{user.firstName} {user.lastName}</div>
                      <div className="text-xs font-normal text-muted-foreground truncate">{user.email}</div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("dashboard")}>
                      <LayoutDashboard size={15} className="mr-2" /> Tableau de bord
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("profile")}>
                      <User size={15} className="mr-2" /> Mon profil
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("my-listings")}>
                      <FileText size={15} className="mr-2" /> Mes annonces
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("messages")}>
                      <MessageSquare size={15} className="mr-2" /> Ma messagerie
                      {user.unreadMessages > 0 && (
                        <span className="ml-auto bg-forest-600 text-white text-[10px] rounded-full px-1.5 py-0.5">{user.unreadMessages}</span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("favorites")}>
                      <Heart size={15} className="mr-2" /> Mes favoris
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("settings")}>
                      <Settings size={15} className="mr-2" /> Paramètres
                    </DropdownMenuItem>
                    {(user.role === "ADMIN" || user.role === "SUPER_ADMIN") && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate("admin-dashboard")} className="text-forest-700 font-medium">
                          <ShieldCheck size={15} className="mr-2" /> Administration
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                      <LogOut size={15} className="mr-2" /> Déconnexion
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => navigate("login")}
                  className="text-forest-900 hover:text-forest-700 hidden sm:inline-flex"
                >
                  <User size={17} className="mr-1.5" /> Se connecter
                </Button>
                <Button
                  onClick={() => navigate("register")}
                  className="bg-forest-700 hover:bg-forest-800 rounded-full h-10 px-5"
                >
                  S&apos;inscrire
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Recherche mobile */}
        <form onSubmit={submitSearch} role="search" className="md:hidden pb-3">
          <div className="relative">
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un article..."
              aria-label="Rechercher un article"
              className="pr-12 h-10 rounded-full bg-gray-50"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Lancer la recherche"
              className="absolute right-1 top-1 h-8 w-8 rounded-full bg-forest-600 hover:bg-forest-700"
            >
              <Search size={15} />
            </Button>
          </div>
        </form>
      </div>
    </header>
  );
}
