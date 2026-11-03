"use client";

import { useEffect, useState } from "react";
import { ChevronRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/components/category-icon";
import { useRouter } from "@/stores/router-store";
import { api } from "@/lib/api";
import type { CategoryData } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CategoriesViewProps {
  query: Record<string, string>;
}

export default function CategoriesView({ query }: CategoriesViewProps) {
  const navigate = useRouter((s) => s.navigate);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ categories: CategoryData[] }>("/api/categories")
      .then((res) => {
        if (!cancelled) setCategories(res.categories);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Erreur de chargement");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  function retry() {
    setError(null);
    setLoading(true);
    setReloadTick((t) => t + 1);
  }

  const activeSlug = query?.category ?? "";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 md:py-12">
      <div className="mb-8 text-center md:text-left">
        <h1 className="text-2xl md:text-3xl font-bold text-forest-900">Toutes les catégories</h1>
        <p className="mt-1.5 text-muted-foreground">
          Explorez les annonces par univers et trouvez l&apos;objet qu&apos;il vous faut.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-card border rounded-2xl text-center py-12 px-4">
          <AlertCircle className="mx-auto text-mango-500 mb-3" size={32} aria-hidden="true" />
          <p className="text-sm text-muted-foreground mb-4">
            Impossible de charger les catégories : {error}
          </p>
          <Button variant="outline" onClick={retry} className="rounded-full">
            Réessayer
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categories.map((cat) => {
            const count = cat.count ?? 0;
            const isActive = activeSlug === cat.slug;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => navigate("explore", {}, { category: cat.slug })}
                aria-label={`Voir les ${count} annonce(s) de la catégorie ${cat.name}`}
                className={cn(
                  "w-full flex items-center gap-4 bg-card border border-border/70 rounded-2xl p-5 text-left shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ring",
                  isActive && "ring-2 ring-forest-600"
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-14 w-14 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${cat.color}1A` }}
                >
                  <CategoryIcon icon={cat.icon} color={cat.color} size={26} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-forest-900 truncate">{cat.name}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {count.toLocaleString("fr-FR")} annonce{count > 1 ? "s" : ""}
                  </span>
                </span>
                <ChevronRight size={18} className="text-forest-300 shrink-0" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
