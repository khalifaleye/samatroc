"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart, Compass } from "lucide-react";
import { toast } from "sonner";
import AccountShell from "@/views/account/account-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ListingCard } from "@/components/listing-card";
import { useRouter } from "@/stores/router-store";
import { api } from "@/lib/api";
import type { ListingSummary } from "@/lib/types";

export default function FavoritesView() {
  const navigate = useRouter((s) => s.navigate);
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await api.get<{ listings: ListingSummary[] }>("/api/favorites");
      setListings(res.listings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFavorites();
  }, [fetchFavorites]);

  function handleFavoriteChange(id: string) {
    // Un favori retiré depuis la carte disparaît de la liste
    setListings((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <AccountShell active="favorites" title="Mes favoris">
      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <Heart className="text-red-400" size={26} aria-hidden="true" />
          </span>
          <p className="text-sm text-muted-foreground">
            Aucun favori pour le moment. Ajoutez les annonces qui vous plaisent pour les retrouver ici.
          </p>
          <Button
            type="button"
            onClick={() => navigate("explore")}
            className="h-11 bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
          >
            <Compass size={18} aria-hidden="true" />
            Explorer les annonces
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onFavoriteChange={handleFavoriteChange}
            />
          ))}
        </div>
      )}
    </AccountShell>
  );
}
