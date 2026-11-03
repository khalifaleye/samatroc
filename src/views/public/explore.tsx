"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  SlidersHorizontal,
  LayoutGrid,
  List,
  SearchX,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Eye,
  Heart,
  RotateCcw,
  AlertCircle,
  Search,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListingCard, ListingCardSkeleton } from "@/components/listing-card";
import { useRouter } from "@/stores/router-store";
import { useAuth } from "@/stores/auth-store";
import { api, ApiClientError } from "@/lib/api";
import { CONDITIONS, conditionLabel, timeAgo } from "@/lib/constants";
import type { CategoryData, ListingSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ExploreViewProps {
  query: Record<string, string>;
}

interface Filters {
  q: string;
  category: string;
  city: string;
  condition: string;
  wanted: string;
}

interface ListingsResponse {
  listings: ListingSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface CityItem {
  id: string;
  name: string;
  region: string | null;
}

const SORT_OPTIONS = [
  { value: "recent", label: "Plus récentes" },
  { value: "relevance", label: "Pertinence" },
  { value: "popular", label: "Plus vues" },
];

const EMPTY_FILTERS: Filters = { q: "", category: "", city: "", condition: "", wanted: "" };

function pageWindow(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(current - 3, total - 6));
  return Array.from({ length: 7 }, (_, i) => start + i);
}

export default function ExploreView({ query }: ExploreViewProps) {
  const navigate = useRouter((s) => s.navigate);
  const user = useAuth((s) => s.user);

  // ----- Référentiels -----
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [cities, setCities] = useState<CityItem[]>([]);

  // ----- Filtres et résultats -----
  function filtersFromQuery(q: Record<string, string>): Filters {
    return {
      q: q.q ?? "",
      category: q.category ?? "",
      city: q.city ?? "",
      condition: q.condition ?? "",
      wanted: q.wanted ?? "",
    };
  }

  const [filters, setFilters] = useState<Filters>(() => filtersFromQuery(query));
  const [searchInput, setSearchInput] = useState(() => query.q ?? "");
  const [sort, setSort] = useState<string>(() =>
    query.sort && SORT_OPTIONS.some((s) => s.value === query.sort) ? query.sort : "recent"
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const seqRef = useRef(0);

  // Synchronisation avec les paramètres de navigation (q, category, city, condition, wanted, sort)
  // Réglage pendant le rendu : applique immédiatement les nouveaux paramètres de la vue
  const queryKey = JSON.stringify(query);
  const [lastQueryKey, setLastQueryKey] = useState(queryKey);
  if (queryKey !== lastQueryKey) {
    setLastQueryKey(queryKey);
    setFilters(filtersFromQuery(query));
    setSearchInput(query.q ?? "");
    setSort(
      query.sort && SORT_OPTIONS.some((s) => s.value === query.sort) ? query.sort : "recent"
    );
    setPage(1);
    setStale(true);
  }

  // Référentiels catégories et villes
  useEffect(() => {
    let cancelled = false;
    api
      .get<{ categories: CategoryData[] }>("/api/categories")
      .then((res) => !cancelled && setCategories(res.categories))
      .catch(() => undefined);
    api
      .get<{ cities: CityItem[] }>("/api/cities")
      .then((res) => !cancelled && setCities(res.cities))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Recherche mots-clés avec debounce 400 ms
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = searchInput.trim();
      setFilters((f) => (f.q === value ? f : { ...f, q: value }));
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Chargement des annonces
  useEffect(() => {
    const seq = ++seqRef.current;
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.category) params.set("category", filters.category);
    if (filters.city) params.set("city", filters.city);
    if (filters.condition) params.set("condition", filters.condition);
    if (filters.wanted) params.set("wanted", filters.wanted);
    params.set("sort", sort);
    params.set("page", String(page));
    params.set("pageSize", "12");

    api
      .get<ListingsResponse>(`/api/listings?${params.toString()}`)
      .then((res) => {
        if (seq !== seqRef.current) return;
        setData(res);
        setError(null);
      })
      .catch((err: unknown) => {
        if (seq !== seqRef.current) return;
        setError(err instanceof Error ? err.message : "Erreur de chargement");
      })
      .finally(() => {
        if (seq !== seqRef.current) return;
        setLoading(false);
        setStale(false);
      });
  }, [filters, sort, page, reloadTick]);

  function applyFilters(patch: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
    setStale(true);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setSearchInput("");
    setSort("recent");
    setPage(1);
    setStale(true);
  }

  function changeSort(value: string) {
    setSort(value);
    setPage(1);
    setStale(true);
  }

  function goToPage(target: number) {
    setPage(target);
    setStale(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function retryFetch() {
    setError(null);
    setLoading(true);
    setStale(false);
    setReloadTick((t) => t + 1);
  }

  async function toggleFavorite(listing: ListingSummary) {
    if (!user) {
      toast.info("Connectez-vous pour ajouter des favoris");
      navigate("login");
      return;
    }
    try {
      const res = await api.post<{ isFavorite: boolean }>(
        `/api/listings/${listing.id}/favorite`
      );
      setData((d) =>
        d
          ? { ...d, listings: d.listings.map((l) => (l.id === listing.id ? { ...l, ...res } : l)) }
          : d
      );
      toast.success(res.isFavorite ? "Ajouté à vos favoris" : "Retiré de vos favoris");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const listings = data?.listings ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  const conditionOptions = CONDITIONS;

  // ----- Contenu des filtres (partagé entre le panneau desktop et la feuille mobile) -----
  const filtersFields = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="filter-q" className="text-xs font-semibold text-forest-900">
          Recherche
        </Label>
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="filter-q"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Mot-clé, titre..."
            className="pl-9 h-11"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-forest-900">Catégorie</Label>
        <Select
          value={filters.category || "all"}
          onValueChange={(v) => applyFilters({ category: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-full h-11" aria-label="Filtrer par catégorie">
            <SelectValue placeholder="Toutes les catégories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.slug}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-forest-900">Ville</Label>
        <Select
          value={filters.city || "all"}
          onValueChange={(v) => applyFilters({ city: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-full h-11" aria-label="Filtrer par ville">
            <SelectValue placeholder="Toutes les villes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les villes</SelectItem>
            {cities.map((city) => (
              <SelectItem key={city.id} value={city.name}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-forest-900">État de l&apos;article</Label>
        <Select
          value={filters.condition || "all"}
          onValueChange={(v) => applyFilters({ condition: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-full h-11" aria-label="Filtrer par état">
            <SelectValue placeholder="Tous les états" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les états</SelectItem>
            {conditionOptions.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-wanted" className="text-xs font-semibold text-forest-900">
          Type d&apos;article recherché
        </Label>
        <Input
          id="filter-wanted"
          value={filters.wanted}
          onChange={(e) => applyFilters({ wanted: e.target.value })}
          placeholder="Ce que je recherche..."
          className="h-11"
        />
      </div>

      <Button
        variant="outline"
        onClick={() => {
          resetFilters();
          setFiltersOpen(false);
        }}
        className="w-full h-11 rounded-full gap-2"
      >
        <RotateCcw size={15} aria-hidden="true" /> Réinitialiser
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 md:py-8">
      {/* En-tête */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-forest-900">
          Explorer les annonces
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trouvez l&apos;objet qu&apos;il vous faut parmi les annonces de la communauté.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Panneau de filtres desktop */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-20 bg-card border border-border/70 rounded-2xl p-5">
            <h2 className="font-semibold text-forest-900 mb-4 flex items-center gap-2">
              <SlidersHorizontal size={16} aria-hidden="true" /> Filtres
            </h2>
            {filtersFields}
          </div>
        </aside>

        {/* Résultats */}
        <div className="flex-1 min-w-0">
          {/* Barre d'actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              {/* Filtres mobile */}
              <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                <Button
                  variant="outline"
                  onClick={() => setFiltersOpen(true)}
                  className="lg:hidden h-11 rounded-full gap-2"
                >
                  <SlidersHorizontal size={16} aria-hidden="true" /> Filtres
                  {activeFilterCount > 0 && (
                    <span className="bg-forest-700 text-white text-[10px] font-bold rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
                <SheetContent side="left" className="w-80 overflow-y-auto">
                  <SheetHeader className="border-b">
                    <SheetTitle className="text-forest-900">Filtres</SheetTitle>
                  </SheetHeader>
                  <div className="p-4">
                    {filtersFields}
                    <SheetClose asChild>
                      <Button className="w-full h-11 mt-4 rounded-full bg-emerald-brand-500 hover:bg-emerald-brand-600 text-white">
                        Voir les résultats
                      </Button>
                    </SheetClose>
                  </div>
                </SheetContent>
              </Sheet>

              <p className="text-sm text-muted-foreground" aria-live="polite">
                <span className="font-semibold text-forest-900">
                  {total.toLocaleString("fr-FR")}
                </span>{" "}
                annonce{total > 1 ? "s" : ""} trouvée{total > 1 ? "s" : ""}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Select value={sort} onValueChange={changeSort}>
                <SelectTrigger className="h-11 rounded-full" aria-label="Trier les annonces">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex rounded-full border border-border overflow-hidden" role="group" aria-label="Mode d'affichage">
                <button
                  type="button"
                  aria-label="Affichage en grille"
                  aria-pressed={viewMode === "grid"}
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "h-11 w-11 flex items-center justify-center transition-colors",
                    viewMode === "grid"
                      ? "bg-forest-700 text-white"
                      : "bg-card text-muted-foreground hover:bg-accent"
                  )}
                >
                  <LayoutGrid size={17} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Affichage en liste"
                  aria-pressed={viewMode === "list"}
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "h-11 w-11 flex items-center justify-center transition-colors border-l border-border",
                    viewMode === "list"
                      ? "bg-forest-700 text-white"
                      : "bg-card text-muted-foreground hover:bg-accent"
                  )}
                >
                  <List size={17} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* Contenu */}
          {loading ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ListingCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-36 rounded-2xl" />
                ))}
              </div>
            )
          ) : error ? (
            <div className="bg-card border rounded-2xl text-center py-12 px-4">
              <AlertCircle className="mx-auto text-mango-500 mb-3" size={32} aria-hidden="true" />
              <p className="text-sm text-muted-foreground mb-4">
                Impossible de charger les annonces : {error}
              </p>
              <Button
                variant="outline"
                onClick={retryFetch}
                className="rounded-full"
              >
                Réessayer
              </Button>
            </div>
          ) : listings.length === 0 ? (
            <div className="bg-card border rounded-2xl text-center py-14 px-4">
              <div className="h-20 w-20 rounded-full bg-mint-50 flex items-center justify-center mx-auto mb-5">
                <SearchX className="text-forest-600" size={36} aria-hidden="true" />
              </div>
              <h2 className="font-bold text-lg text-forest-900 mb-1.5">
                Aucune annonce ne correspond à votre recherche
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                Essayez d&apos;élargir vos critères : changez de catégorie, de ville ou supprimez
                les filtres actifs.
              </p>
              <Button
                onClick={resetFilters}
                className="bg-forest-700 hover:bg-forest-800 rounded-full h-11 px-6 gap-2"
              >
                <RotateCcw size={15} aria-hidden="true" /> Réinitialiser les filtres
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            <div
              className={cn(
                "grid grid-cols-2 md:grid-cols-3 gap-4 transition-opacity",
                stale && "opacity-60 pointer-events-none"
              )}
            >
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div
              className={cn(
                "space-y-3 transition-opacity",
                stale && "opacity-60 pointer-events-none"
              )}
            >
              {listings.map((listing) => {
                const primaryImage =
                  listing.images?.find((img) => img.isPrimary)?.url ?? listing.images?.[0]?.url;
                return (
                  <article
                    key={listing.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Annonce : ${listing.title}`}
                    onClick={() => navigate("listing", { id: listing.id })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate("listing", { id: listing.id });
                      }
                    }}
                    className="bg-card rounded-2xl border border-border/70 shadow-card hover:shadow-card-hover transition-all p-3 flex gap-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <div className="relative w-32 h-28 sm:w-40 sm:h-28 rounded-xl overflow-hidden bg-mint-50 shrink-0">
                      {primaryImage ? (
                        <Image
                          src={primaryImage}
                          alt={listing.title}
                          fill
                          sizes="160px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ImageIcon className="text-forest-300" size={26} aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-semibold text-[15px] text-forest-900 line-clamp-1">
                          {listing.title}
                        </h2>
                        <button
                          type="button"
                          aria-label={
                            listing.isFavorite
                              ? "Retirer des favoris"
                              : "Ajouter aux favoris"
                          }
                          aria-pressed={!!listing.isFavorite}
                          onClick={(e) => {
                            e.stopPropagation();
                            void toggleFavorite(listing);
                          }}
                          className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center hover:bg-accent transition-colors"
                        >
                          <Heart
                            size={17}
                            className={
                              listing.isFavorite ? "fill-red-500 text-red-500" : "text-gray-400"
                            }
                            aria-hidden="true"
                          />
                        </button>
                      </div>

                      <p className="text-[13px] text-muted-foreground line-clamp-2">
                        {listing.description}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <Badge variant="secondary">{conditionLabel(listing.condition)}</Badge>
                        {listing.category && (
                          <Badge className="bg-mint-100 text-forest-700 hover:bg-mint-100">
                            {listing.category.name}
                          </Badge>
                        )}
                        <Badge className="bg-forest-700 text-white hover:bg-forest-700">
                          Échange
                        </Badge>
                      </div>

                      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin size={13} className="text-forest-600" aria-hidden="true" />
                          {listing.city}
                          {listing.quartier ? ` • ${listing.quartier}` : ""}
                        </span>
                        <span>{timeAgo(listing.publishedAt || listing.createdAt)}</span>
                        <span className="flex items-center gap-1">
                          <Eye size={13} aria-hidden="true" /> {listing.viewsCount} vues
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && totalPages > 1 && (
            <nav className="flex flex-wrap items-center justify-center gap-1.5 mt-8" aria-label="Pagination">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
                className="h-10 rounded-full gap-1"
              >
                <ChevronLeft size={15} aria-hidden="true" /> Précédent
              </Button>
              {pageWindow(page, totalPages).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => goToPage(p)}
                  aria-label={`Aller à la page ${p}`}
                  aria-current={p === page ? "page" : undefined}
                  className={cn(
                    "h-10 min-w-10 px-3 rounded-full text-sm font-medium transition-colors",
                    p === page
                      ? "bg-forest-700 text-white"
                      : "bg-card border border-border text-foreground hover:bg-accent"
                  )}
                >
                  {p}
                </button>
              ))}
              <Button
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
                className="h-10 rounded-full gap-1"
              >
                Suivant <ChevronRight size={15} aria-hidden="true" />
              </Button>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
