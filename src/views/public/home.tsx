"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  Layers,
  ArrowLeftRight,
  Users,
  FileText,
  Heart,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ListingCard, ListingCardSkeleton } from "@/components/listing-card";
import { CategoryIcon } from "@/components/category-icon";
import { useRouter } from "@/stores/router-store";
import { api } from "@/lib/api";
import type { CategoryData, ListingSummary } from "@/lib/types";

interface StatsData {
  stats: { users: number; listings: number; exchanges: number; isDemo: boolean };
}

const HERO_STEPS = [
  {
    icon: Layers,
    title: "Publiez votre annonce",
    text: "À partir de 500 FCFA par article",
  },
  {
    icon: ArrowLeftRight,
    title: "Indiquez ce que vous cherchez",
    text: "En échange",
  },
  {
    icon: Users,
    title: "Échangez avec d'autres utilisateurs",
    text: "Via notre messagerie ou WhatsApp",
  },
];

const HOW_STEPS = [
  {
    number: "01",
    title: "Créez votre compte",
    text: "Inscrivez-vous gratuitement en moins de deux minutes et complétez votre profil.",
  },
  {
    number: "02",
    title: "Publiez votre annonce",
    text: "Décrivez votre article, ajoutez des photos et indiquez ce que vous recherchez en échange.",
  },
  {
    number: "03",
    title: "Échangez en toute confiance",
    text: "Recevez des propositions, discutez via la messagerie et donnez une seconde vie à vos objets.",
  },
];

/** Illustration décorative : téléphone avec flèches d'échange */
function PromoIllustration() {
  return (
    <svg viewBox="0 0 140 96" className="h-28 w-full" aria-hidden="true">
      <rect
        x="52"
        y="6"
        width="36"
        height="72"
        rx="8"
        fill="#ffffff"
        stroke="#0e5c3d"
        strokeWidth="2.5"
      />
      <line x1="63" y1="13" x2="77" y2="13" stroke="#c9ecda" strokeWidth="3" strokeLinecap="round" />
      <rect x="62" y="24" width="16" height="4" rx="2" fill="#e2f6eb" />
      <rect x="62" y="32" width="16" height="4" rx="2" fill="#e2f6eb" />
      <rect x="62" y="40" width="10" height="4" rx="2" fill="#e2f6eb" />
      <circle cx="70" cy="65" r="4.5" fill="#12a05f" />
      <g stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M14 24 H 38" />
        <path d="M126 60 H 102" />
      </g>
      <polygon points="38,17 52,24 38,31" fill="#f59e0b" />
      <polygon points="102,53 88,60 102,67" fill="#f59e0b" />
      <circle cx="16" cy="72" r="5" fill="#c9ecda" />
      <circle cx="126" cy="14" r="6" fill="#feefc7" />
      <circle cx="132" cy="82" r="3" fill="#c9ecda" />
    </svg>
  );
}

export default function HomePage() {
  const navigate = useRouter((s) => s.navigate);

  // ----- Catégories -----
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoriesTick, setCategoriesTick] = useState(0);

  // ----- Dernières annonces -----
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [listingsTick, setListingsTick] = useState(0);

  // ----- Statistiques -----
  const [stats, setStats] = useState<StatsData["stats"] | null>(null);

  const loadCategories = useCallback(() => {
    let cancelled = false;
    api
      .get<{ categories: CategoryData[] }>("/api/categories")
      .then((data) => {
        if (!cancelled) setCategories(data.categories);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setCategoriesError(err instanceof Error ? err.message : "Erreur de chargement");
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadListings = useCallback(() => {
    let cancelled = false;
    api
      .get<{ listings: ListingSummary[] }>("/api/listings?pageSize=8&sort=recent")
      .then((data) => {
        if (!cancelled) setListings(data.listings);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setListingsError(err instanceof Error ? err.message : "Erreur de chargement");
      })
      .finally(() => {
        if (!cancelled) setListingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => loadCategories(), [loadCategories, categoriesTick]);
  useEffect(() => loadListings(), [loadListings, listingsTick]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<StatsData>("/api/stats")
      .then((data) => {
        if (!cancelled) setStats(data.stats);
      })
      .catch(() => {
        // Les statistiques sont décoratives : on masque la carte en cas d'échec
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const formatNumber = (n: number) => n.toLocaleString("fr-FR");

  function retryCategories() {
    setCategoriesError(null);
    setCategoriesLoading(true);
    setCategoriesTick((t) => t + 1);
  }

  function retryListings() {
    setListingsError(null);
    setListingsLoading(true);
    setListingsTick((t) => t + 1);
  }

  return (
    <div>
      {/* ================= Bannière principale ================= */}
      <section className="relative h-[520px] md:h-[600px] bg-forest-950 overflow-hidden">
        <Image
          src="/images/hero.png"
          alt="Personnes échangeant des objets sur SamaTroc"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-forest-950/85 via-forest-900/60 to-transparent" />

        <div className="relative z-10 mx-auto max-w-7xl h-full px-4 sm:px-6 flex flex-col justify-center gap-8 lg:flex-row lg:items-center lg:justify-between py-10">
          {/* Texte */}
          <div className="max-w-2xl animate-fade-up">
            <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight text-balance">
              Échangez vos articles
              <br className="hidden sm:block" /> en toute simplicité
            </h1>
            <p className="mt-4 text-base md:text-lg text-white/85 max-w-xl leading-relaxed">
              SamaTroc est la plateforme qui vous permet d&apos;échanger des objets entre
              particuliers au Sénégal. Donnez une seconde vie à ce que vous n&apos;utilisez plus et
              trouvez ce dont vous avez besoin !
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => navigate("explore")}
                className="h-12 px-7 rounded-full bg-emerald-brand-500 hover:bg-emerald-brand-600 text-white text-base"
              >
                Voir les annonces
              </Button>
              <Button
                onClick={() => navigate("how-it-works")}
                className="h-12 px-7 rounded-full border-2 border-white bg-transparent text-white text-base hover:bg-white/10"
                variant="outline"
              >
                Comment ça marche ?
              </Button>
            </div>
          </div>

          {/* Carte 3 étapes */}
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl animate-fade-up">
            <ul className="space-y-4">
              {HERO_STEPS.map((step) => (
                <li key={step.title} className="flex items-start gap-3">
                  <span className="h-10 w-10 rounded-full bg-forest-700 text-white flex items-center justify-center shrink-0">
                    <step.icon size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-forest-900">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ================= Catégories ================= */}
      <section className="py-12 md:py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4 mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-forest-900">Catégories</h2>
            <button
              onClick={() => navigate("categories")}
              className="flex items-center gap-1 text-sm font-medium text-emerald-brand-600 hover:text-emerald-brand-700 transition-colors shrink-0"
            >
              Voir toutes les catégories
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>

          {categoriesLoading ? (
            <div className="grid grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : categoriesError ? (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto text-mango-500 mb-2" size={28} aria-hidden="true" />
              <p className="text-sm text-muted-foreground mb-4">
                Impossible de charger les catégories : {categoriesError}
              </p>
              <Button variant="outline" onClick={retryCategories} className="rounded-full">
                Réessayer
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => navigate("explore", {}, { category: cat.slug })}
                  aria-label={`Voir les annonces de la catégorie ${cat.name}`}
                  className="bg-gray-50 rounded-xl p-4 text-center transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <div className="flex justify-center mb-2">
                    <CategoryIcon icon={cat.icon} color={cat.color} size={28} />
                  </div>
                  <span className="block text-xs font-medium text-forest-900 leading-snug line-clamp-2 min-h-[2rem]">
                    {cat.name}
                  </span>
                  <span className="block text-[10px] text-muted-foreground mt-1">
                    {formatNumber(cat.count ?? 0)} annonce{(cat.count ?? 0) > 1 ? "s" : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ================= Dernières annonces ================= */}
      <section className="py-12 md:py-16 bg-mint-50/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4 mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-forest-900">Dernières annonces</h2>
            <button
              onClick={() => navigate("explore")}
              className="flex items-center gap-1 text-sm font-medium text-emerald-brand-600 hover:text-emerald-brand-700 transition-colors shrink-0"
            >
              Voir toutes les annonces
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-col xl:flex-row gap-6">
            {/* Grille d'annonces */}
            <div className="flex-1 min-w-0">
              {listingsLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <ListingCardSkeleton key={i} />
                  ))}
                </div>
              ) : listingsError ? (
                <div className="bg-card border rounded-2xl text-center py-10 px-4">
                  <AlertCircle
                    className="mx-auto text-mango-500 mb-2"
                    size={28}
                    aria-hidden="true"
                  />
                  <p className="text-sm text-muted-foreground mb-4">
                    Impossible de charger les annonces : {listingsError}
                  </p>
                  <Button
                    variant="outline"
                    onClick={retryListings}
                    className="rounded-full"
                  >
                    Réessayer
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {listings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} />
                  ))}
                </div>
              )}
            </div>

            {/* Colonne droite : encart promo + statistiques */}
            <aside className="hidden xl:block w-72 shrink-0 space-y-6">
              {/* Encart promo */}
              <div className="bg-mint-100 rounded-2xl p-6 text-center">
                <PromoIllustration />
                <h3 className="mt-4 font-bold text-forest-800 leading-snug">
                  Plus qu&apos;une plateforme, un lien entre les Sénégalais !
                </h3>
                <p className="mt-2 text-sm text-forest-900/70 leading-relaxed">
                  Ensemble, faisons du troc une solution durable et solidaire.
                </p>
                <Button
                  onClick={() => navigate("publish")}
                  className="mt-5 w-full h-11 rounded-full bg-forest-700 hover:bg-forest-800 text-white"
                >
                  Publier une annonce
                </Button>
              </div>

              {/* Carte statistiques */}
              <div className="bg-card border border-border/70 rounded-2xl p-5">
                {stats ? (
                  <>
                    <ul className="space-y-4">
                      <li className="flex items-center gap-3">
                        <span className="h-10 w-10 rounded-full bg-mint-100 text-forest-700 flex items-center justify-center shrink-0">
                          <Users size={18} aria-hidden="true" />
                        </span>
                        <div>
                          <p className="font-bold text-lg text-forest-900 leading-tight">
                            {formatNumber(stats.users)}
                          </p>
                          <p className="text-xs text-muted-foreground">Utilisateurs inscrits</p>
                        </div>
                      </li>
                      <li className="flex items-center gap-3">
                        <span className="h-10 w-10 rounded-full bg-mint-100 text-forest-700 flex items-center justify-center shrink-0">
                          <FileText size={18} aria-hidden="true" />
                        </span>
                        <div>
                          <p className="font-bold text-lg text-forest-900 leading-tight">
                            {formatNumber(stats.listings)}
                          </p>
                          <p className="text-xs text-muted-foreground">Annonces publiées</p>
                        </div>
                      </li>
                      <li className="flex items-center gap-3">
                        <span className="h-10 w-10 rounded-full bg-mint-100 text-forest-700 flex items-center justify-center shrink-0">
                          <ArrowLeftRight size={18} aria-hidden="true" />
                        </span>
                        <div>
                          <p className="font-bold text-lg text-forest-900 leading-tight">
                            {formatNumber(stats.exchanges)}
                          </p>
                          <p className="text-xs text-muted-foreground">Échanges réalisés</p>
                        </div>
                      </li>
                    </ul>
                    {stats.isDemo && (
                      <div className="flex justify-center mt-4">
                        <span className="bg-mango-100 text-mango-700 text-[10px] font-medium px-2.5 py-1 rounded-full">
                          Données de démonstration
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-center gap-1.5 border-t border-border/70 mt-4 pt-3 text-xs text-muted-foreground">
                  <Heart size={13} className="text-mango-500 fill-mango-500" aria-hidden="true" />
                  Merci à toute la communauté SamaTroc !
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ================= Comment ça marche (court) ================= */}
      <section className="py-12 md:py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-forest-900">Comment ça marche ?</h2>
            <p className="mt-2 text-muted-foreground max-w-xl mx-auto">
              Trois étapes suffisent pour troquer vos objets en toute confiance.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {HOW_STEPS.map((step) => (
              <div
                key={step.number}
                className="bg-mint-50 rounded-2xl p-6 transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5"
              >
                <span className="text-4xl font-extrabold text-forest-200" aria-hidden="true">
                  {step.number}
                </span>
                <h3 className="mt-3 font-semibold text-forest-900">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
