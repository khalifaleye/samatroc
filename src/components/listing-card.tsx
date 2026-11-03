"use client";

import { useState } from "react";
import Image from "next/image";
import { Heart, MapPin, BadgeCheck, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouter } from "@/stores/router-store";
import { useAuth } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { formatFCFA, timeAgo, conditionLabel } from "@/lib/constants";

export interface ListingCardData {
  id: string;
  reference?: string;
  title: string;
  description?: string;
  condition: string;
  city: string;
  quartier?: string | null;
  wantedText: string;
  status: string;
  featured?: boolean;
  publishedAt?: string | null;
  createdAt?: string;
  fees?: number;
  isFavorite?: boolean;
  category?: { name: string; slug: string } | null;
  images?: { url: string; isPrimary: boolean }[];
  owner?: { id: string; firstName: string; lastName: string } | null;
}

interface ListingCardProps {
  listing: ListingCardData;
  onFavoriteChange?: (id: string, isFavorite: boolean) => void;
  showStatus?: boolean;
  className?: string;
}

/**
 * Carte d'annonce (identique à la maquette) :
 * photo principale, bouton favoris, badge « Échange », titre, objet recherché,
 * frais de publication, ville et date.
 */
export function ListingCard({
  listing,
  onFavoriteChange,
  showStatus = false,
  className,
}: ListingCardProps) {
  const navigate = useRouter((s) => s.navigate);
  const user = useAuth((s) => s.user);
  const [isFavorite, setIsFavorite] = useState(listing.isFavorite ?? false);
  const [favLoading, setFavLoading] = useState(false);

  const primaryImage =
    listing.images?.find((i) => i.isPrimary)?.url ?? listing.images?.[0]?.url;

  async function toggleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) {
      toast.info("Connectez-vous pour ajouter des favoris", {
        description: "La consultation reste gratuite.",
      });
      navigate("login");
      return;
    }
    setFavLoading(true);
    try {
      const res = await api.post<{ isFavorite: boolean }>(
        `/api/listings/${listing.id}/favorite`
      );
      setIsFavorite(res.isFavorite);
      onFavoriteChange?.(listing.id, res.isFavorite);
      toast.success(res.isFavorite ? "Ajouté à vos favoris" : "Retiré de vos favoris");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur");
    } finally {
      setFavLoading(false);
    }
  }

  return (
    <article
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
      className={cn(
        "group bg-card rounded-2xl border border-border/70 shadow-card hover:shadow-card-hover transition-all duration-300 cursor-pointer overflow-hidden hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ring",
        className
      )}
    >
      {/* Photo principale */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {primaryImage ? (
          <Image
            src={primaryImage}
            alt={listing.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-mint-50">
            <ImageIcon className="text-forest-300" size={40} aria-hidden="true" />
          </div>
        )}

        {/* Badge Échange */}
        <span className="absolute left-2.5 bottom-2.5 bg-forest-700 text-white text-xs font-semibold px-2.5 py-1 rounded-md shadow-sm">
          Échange
        </span>
        {showStatus && listing.status !== "PUBLISHED" && (
          <span className="absolute left-2.5 top-2.5 bg-black/70 text-white text-[10px] font-medium px-2 py-0.5 rounded">
            {listing.status === "EXCHANGED"
              ? "Échangée"
              : listing.status === "DEACTIVATED"
                ? "Désactivée"
                : listing.status === "DRAFT"
                  ? "Brouillon"
                  : listing.status === "REFUSED"
                    ? "Refusée"
                    : "En traitement"}
          </span>
        )}

        {/* Bouton favoris */}
        <button
          type="button"
          aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          aria-pressed={isFavorite}
          onClick={toggleFavorite}
          disabled={favLoading}
          className="absolute right-2.5 top-2.5 h-9 w-9 rounded-full bg-white/95 shadow-sm flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
        >
          <Heart
            size={17}
            className={cn(
              "transition-colors",
              isFavorite ? "fill-red-500 text-red-500" : "text-gray-500"
            )}
          />
        </button>

        {listing.featured && (
          <span className="absolute right-2.5 bottom-2.5 bg-mango-500 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
            <BadgeCheck size={12} /> À la une
          </span>
        )}
      </div>

      {/* Contenu */}
      <div className="p-3.5 space-y-1.5">
        <h3 className="font-semibold text-[15px] leading-snug text-foreground line-clamp-1 group-hover:text-forest-700 transition-colors">
          {listing.title}
        </h3>
        <p className="text-[13px] text-muted-foreground line-clamp-1">
          <span className="text-forest-600 font-medium">Je cherche :</span>{" "}
          {listing.wantedText}
        </p>

        <div className="flex items-baseline justify-between pt-0.5">
          <div>
            <span className="font-bold text-[15px] text-forest-700">
              {formatFCFA(listing.fees ?? 500)}
            </span>
            <span className="block text-[10px] text-muted-foreground leading-tight">
              frais de publication
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {conditionLabel(listing.condition)}
          </span>
        </div>

        <div className="flex items-center justify-between pt-1 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1 min-w-0">
            <MapPin size={13} className="shrink-0 text-forest-600" aria-hidden="true" />
            <span className="truncate">
              {listing.city}
              {listing.quartier ? ` • ${listing.quartier}` : ""}
            </span>
          </span>
          <span className="shrink-0">{timeAgo(listing.publishedAt || listing.createdAt)}</span>
        </div>
      </div>
    </article>
  );
}

/** Squelette de chargement pour la carte d'annonce */
export function ListingCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/70 overflow-hidden bg-card">
      <div className="aspect-[4/3] bg-muted animate-pulse" />
      <div className="p-3.5 space-y-2">
        <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
        <div className="h-3 bg-muted rounded animate-pulse w-full" />
        <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
        <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
      </div>
    </div>
  );
}
