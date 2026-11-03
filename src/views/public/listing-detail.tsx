"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  MapPin,
  Clock,
  Eye,
  Heart,
  Phone,
  MessageCircle,
  Flag,
  SearchX,
  ImageIcon,
  Check,
  Camera,
  X,
  Loader2,
  ChevronRight,
  AlertCircle,
  PackagePlus,
  ArrowLeftRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ListingCard } from "@/components/listing-card";
import { useRouter } from "@/stores/router-store";
import { useAuth } from "@/stores/auth-store";
import { api, ApiClientError, compressImage } from "@/lib/api";
import {
  conditionLabel,
  formatDate,
  formatPhoneSN,
  REPORT_REASONS,
  timeAgo,
} from "@/lib/constants";
import type { ListingDetail, ListingSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ListingDetailViewProps {
  id: string;
}

interface DetailResponse {
  listing: Omit<ListingDetail, "similar">;
  similar: ListingSummary[];
}

const MAX_PROPOSAL_PHOTOS = 4;

export default function ListingDetailView({ id }: ListingDetailViewProps) {
  const navigate = useRouter((s) => s.navigate);
  const user = useAuth((s) => s.user);

  // ----- Annonce -----
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [activeImage, setActiveImage] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  // ----- Proposition d'échange -----
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalMode, setProposalMode] = useState<"listing" | "text">("listing");
  const [myListings, setMyListings] = useState<ListingSummary[]>([]);
  const [myListingsLoading, setMyListingsLoading] = useState(false);
  const [myListingsLoaded, setMyListingsLoaded] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<string>("");
  const [offeredText, setOfferedText] = useState("");
  const [proposalMessage, setProposalMessage] = useState("");
  const [proposalImages, setProposalImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ----- Messagerie -----
  const [contactLoading, setContactLoading] = useState(false);

  // ----- Signalement -----
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const loadListing = useCallback(() => {
    let cancelled = false;
    api
      .get<DetailResponse>(`/api/listings/${id}`)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setIsFavorite(res.listing.isFavorite ?? false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof Error ? err.message : "Erreur de chargement");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Réinitialisation lors d'un changement d'annonce (réglage pendant le rendu)
  const [lastId, setLastId] = useState(id);
  if (lastId !== id) {
    setLastId(id);
    setData(null);
    setActiveImage(0);
    setNotFound(false);
    setError(null);
    setLoading(true);
  }

  function retryFetch() {
    setError(null);
    setNotFound(false);
    setActiveImage(0);
    setLoading(true);
    setReloadTick((t) => t + 1);
  }

  useEffect(() => loadListing(), [loadListing, reloadTick]);

  function resetProposalForm() {
    setProposalMode("listing");
    setSelectedListingId("");
    setOfferedText("");
    setProposalMessage("");
    setProposalImages([]);
  }

  function openProposal() {
    if (!user) {
      toast.info("Connectez-vous pour proposer un échange");
      navigate("login");
      return;
    }
    resetProposalForm();
    setProposalOpen(true);
    if (!myListingsLoaded) {
      void loadMyListings();
    }
  }

  async function loadMyListings() {
    if (!user) return;
    setMyListingsLoading(true);
    try {
      const res = await api.get<{ listings: ListingSummary[] }>(
        `/api/listings?ownerId=${encodeURIComponent(user.id)}&status=ALL&pageSize=48`
      );
      setMyListings(res.listings.filter((l) => l.status === "PUBLISHED"));
      setMyListingsLoaded(true);
    } catch {
      setMyListings([]);
    } finally {
      setMyListingsLoading(false);
    }
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    const remaining = MAX_PROPOSAL_PHOTOS - proposalImages.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_PROPOSAL_PHOTOS} photos`);
      return;
    }
    if (files.length === 0) return;
    setUploading(true);
    try {
      const form = new FormData();
      for (const file of files.slice(0, remaining)) {
        form.append("files", await compressImage(file));
      }
      const res = await api.upload<{ urls: string[] }>("/api/upload", form);
      setProposalImages((prev) => [...prev, ...res.urls].slice(0, MAX_PROPOSAL_PHOTOS));
      toast.success("Photo ajoutée à votre proposition");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec du téléversement");
    } finally {
      setUploading(false);
    }
  }

  async function submitProposal() {
    if (proposalMode === "listing" && !selectedListingId) {
      toast.error("Sélectionnez une de vos annonces");
      return;
    }
    if (proposalMode === "text" && offeredText.trim().length < 5) {
      toast.error("Décrivez l'objet proposé (5 caractères minimum)");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ conversationId: string }>(
        `/api/listings/${id}/proposals`,
        {
          offeredListingId: proposalMode === "listing" ? selectedListingId : undefined,
          offeredText: proposalMode === "text" ? offeredText.trim() : undefined,
          images: proposalImages,
          message: proposalMessage.trim() || undefined,
        }
      );
      toast.success("Proposition envoyée ! Le propriétaire a été notifié.");
      setProposalOpen(false);
      resetProposalForm();
      navigate("messages", { id: res.conversationId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'envoi");
    } finally {
      setSubmitting(false);
    }
  }

  async function contactOwner() {
    if (!data) return;
    if (!user) {
      toast.info("Connectez-vous pour contacter le propriétaire");
      navigate("login");
      return;
    }
    setContactLoading(true);
    try {
      const res = await api.post<{ conversationId: string }>("/api/conversations", {
        userId: data.listing.owner.id,
        listingId: data.listing.id,
        message: `Bonjour, je suis intéressé(e) par votre annonce « ${data.listing.title} ».`,
      });
      toast.success("Message envoyé au propriétaire");
      navigate("messages", { id: res.conversationId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'envoi");
    } finally {
      setContactLoading(false);
    }
  }

  async function toggleFavorite() {
    if (!user) {
      toast.info("Connectez-vous pour ajouter des favoris");
      navigate("login");
      return;
    }
    setFavLoading(true);
    try {
      const res = await api.post<{ isFavorite: boolean }>(`/api/listings/${id}/favorite`);
      setIsFavorite(res.isFavorite);
      toast.success(res.isFavorite ? "Ajouté à vos favoris" : "Retiré de vos favoris");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setFavLoading(false);
    }
  }

  async function submitReport() {
    if (!reportReason) {
      toast.error("Sélectionnez un motif de signalement");
      return;
    }
    setReportSubmitting(true);
    try {
      await api.post("/api/reports", {
        targetType: "LISTING",
        targetId: id,
        reason: reportReason,
        details: reportDetails.trim() || undefined,
      });
      toast.success("Signalement envoyé. Merci de contribuer à la sécurité de la communauté.");
      setReportOpen(false);
      setReportReason("");
      setReportDetails("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'envoi");
    } finally {
      setReportSubmitting(false);
    }
  }

  // ----- États intermédiaires -----
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="aspect-[4/3] rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-12 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="h-24 w-24 rounded-full bg-mint-50 flex items-center justify-center mb-6">
          <SearchX className="text-forest-600" size={44} aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-extrabold text-forest-900 mb-2">Annonce introuvable</h1>
        <p className="text-muted-foreground max-w-md mb-8">
          Cette annonce n&apos;existe plus ou a été retirée par son propriétaire.
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Button
            onClick={() => navigate("home")}
            className="bg-forest-700 hover:bg-forest-800 rounded-full px-6"
          >
            Retour à l&apos;accueil
          </Button>
          <Button onClick={() => navigate("explore")} variant="outline" className="rounded-full px-6">
            Voir les annonces
          </Button>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <AlertCircle className="text-mango-500 mb-3" size={36} aria-hidden="true" />
        <p className="text-muted-foreground mb-6">
          Impossible de charger l&apos;annonce{error ? ` : ${error}` : ""}.
        </p>
        <Button
          onClick={retryFetch}
          variant="outline"
          className="rounded-full"
        >
          Réessayer
        </Button>
      </div>
    );
  }

  const listing = data.listing;
  const images = listing.images ?? [];
  const currentImage = images[activeImage]?.url;
  const owner = listing.owner;
  const canWhatsApp = owner.whatsappEnabled && !!owner.phone;
  const canCall = owner.showPhone && !!owner.phone;
  const waNumber = owner.phone
    ? (() => {
        const digits = owner.phone!.replace(/\D/g, "");
        return digits.startsWith("221") ? digits : `221${digits}`;
      })()
    : "";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 md:py-8">
      {/* Fil d'Ariane */}
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
        <button onClick={() => navigate("home")} className="hover:text-forest-700 transition-colors">
          Accueil
        </button>
        <ChevronRight size={12} aria-hidden="true" />
        <button onClick={() => navigate("explore")} className="hover:text-forest-700 transition-colors">
          Annonces
        </button>
        <ChevronRight size={12} aria-hidden="true" />
        <span className="text-forest-800 font-medium truncate max-w-[240px]">{listing.title}</span>
      </nav>

      {/* Bannière propriétaire */}
      {listing.isOwner && (
        <div className="mb-6 bg-mint-100 border border-mint-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-forest-800 font-medium flex-1">
            Ceci est votre annonce. Elle est visible par toute la communauté.
          </p>
          <Button
            onClick={() => navigate("my-listings")}
            className="bg-forest-700 hover:bg-forest-800 rounded-full h-10 gap-2 shrink-0"
          >
            <PackagePlus size={16} aria-hidden="true" /> Gérer mes annonces
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* ======== Colonne principale ======== */}
        <div className="lg:col-span-2 min-w-0">
          {/* Galerie */}
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-mint-50">
            {currentImage ? (
              <Image
                src={currentImage}
                alt={listing.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 66vw"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-forest-400">
                <ImageIcon size={48} aria-hidden="true" />
                <span className="text-sm">Aucune photo</span>
              </div>
            )}
            {listing.featured && (
              <span className="absolute top-3 left-3 bg-mango-500 text-white text-xs font-bold px-2.5 py-1 rounded-md">
                À la une
              </span>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 custom-scrollbar">
              {images.map((img, index) => (
                <button
                  key={`${img.url}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  aria-label={`Voir la photo ${index + 1}`}
                  aria-current={index === activeImage}
                  className={cn(
                    "relative h-20 w-24 shrink-0 rounded-lg overflow-hidden border-2 transition-colors",
                    index === activeImage ? "border-forest-600" : "border-transparent"
                  )}
                >
                  <Image
                    src={img.url}
                    alt={`Photo ${index + 1} de ${listing.title}`}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Infos */}
          <div className="mt-6">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-forest-900 text-balance">
                {listing.title}
              </h1>
              <Button
                variant="outline"
                size="icon"
                onClick={() => void toggleFavorite()}
                disabled={favLoading}
                aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                aria-pressed={isFavorite}
                className="h-11 w-11 shrink-0 rounded-full"
              >
                <Heart
                  className={cn("h-5 w-5", isFavorite ? "fill-red-500 text-red-500" : "text-forest-700")}
                  aria-hidden="true"
                />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Badge variant="secondary">{conditionLabel(listing.condition)}</Badge>
              {listing.category && (
                <Badge className="bg-mint-100 text-forest-700 hover:bg-mint-100">
                  {listing.category.name}
                </Badge>
              )}
              <Badge className="bg-forest-700 text-white hover:bg-forest-700">Échange</Badge>
              {listing.featured && (
                <Badge className="bg-mango-500 text-white hover:bg-mango-500">À la une</Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin size={15} className="text-forest-600" aria-hidden="true" />
                {listing.city}
                {listing.quartier ? ` • ${listing.quartier}` : ""}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={15} aria-hidden="true" />
                Publiée {timeAgo(listing.publishedAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <Eye size={15} aria-hidden="true" /> {listing.viewsCount} vues
              </span>
              <span className="text-xs">Réf. {listing.reference}</span>
            </div>

            {/* Objet recherché */}
            <div className="mt-5 bg-mint-50 border border-mint-200 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-forest-600 mb-1.5">
                Je recherche en échange
              </p>
              <p className="text-forest-900 font-semibold">{listing.wantedText}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {listing.wantedCategory && (
                  <Badge variant="outline" className="bg-white text-forest-700 border-mint-200">
                    {listing.wantedCategory}
                  </Badge>
                )}
                {listing.wantedMultiple && (
                  <span className="text-xs text-muted-foreground">
                    Plusieurs types d&apos;objets acceptés
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <h2 className="text-lg font-bold text-forest-900 mt-7 mb-2">Description</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {listing.description}
            </p>
          </div>
        </div>

        {/* ======== Colonne latérale ======== */}
        <div className="space-y-5">
          {/* Carte propriétaire */}
          <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="h-12 w-12 rounded-full bg-forest-100 text-forest-700 font-bold flex items-center justify-center shrink-0"
              >
                {owner.firstName[0]}
                {owner.lastName[0]}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-forest-900 truncate">
                  {owner.firstName} {owner.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Membre depuis {formatDate(owner.memberSince)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {owner.listingsCount} annonce{owner.listingsCount > 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {(canCall || canWhatsApp) && (
              <div className="grid gap-2 mt-4">
                {canCall && owner.phone && (
                  <a
                    href={`tel:${owner.phone}`}
                    className="inline-flex items-center justify-center gap-2 h-11 rounded-full border border-border bg-background text-sm font-medium hover:bg-accent transition-colors focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <Phone size={16} className="text-forest-700" aria-hidden="true" />
                    Appeler {formatPhoneSN(owner.phone)}
                  </a>
                )}
                {canWhatsApp && owner.phone && (
                  <a
                    href={`https://wa.me/${waNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 h-11 rounded-full text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
                    style={{ backgroundColor: "#25D366" }}
                  >
                    <MessageCircle size={16} aria-hidden="true" /> WhatsApp
                  </a>
                )}
              </div>
            )}

            {!canCall && !canWhatsApp && (
              <p className="text-xs text-muted-foreground mt-4 bg-muted rounded-lg p-3">
                Coordonnées protégées — utilisez la messagerie pour contacter {owner.firstName}.
              </p>
            )}
          </div>

          {/* CTA */}
          {!listing.isOwner && (
            <>
              <Button
                onClick={() => void openProposal()}
                className="w-full h-12 rounded-full bg-emerald-brand-500 hover:bg-emerald-brand-600 text-white text-base gap-2"
              >
                <ArrowLeftRight size={18} aria-hidden="true" /> Proposer un échange
              </Button>
              <Button
                variant="outline"
                onClick={() => void contactOwner()}
                disabled={contactLoading}
                className="w-full h-12 rounded-full gap-2"
              >
                {contactLoading ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : (
                  <MessageCircle size={16} aria-hidden="true" />
                )}
                Contacter via la messagerie
              </Button>
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-600 transition-colors"
              >
                <Flag size={13} aria-hidden="true" /> Signaler cette annonce
              </button>
            </>
          )}
        </div>
      </div>

      {/* Annonces similaires */}
      {data.similar.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl md:text-2xl font-bold text-forest-900 mb-5">Annonces similaires</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.similar.map((similar) => (
              <ListingCard key={similar.id} listing={similar} />
            ))}
          </div>
        </section>
      )}

      {/* ======== Dialog : proposition d'échange ======== */}
      <Dialog open={proposalOpen} onOpenChange={setProposalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="text-forest-900">Proposer un échange</DialogTitle>
            <DialogDescription>
              Pour l&apos;annonce « {listing.title} » de {owner.firstName}.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={proposalMode}
            onValueChange={(v) => setProposalMode(v as "listing" | "text")}
            className="gap-3"
          >
            <div className="flex items-start gap-2.5">
              <RadioGroupItem value="listing" id="mode-listing" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="mode-listing" className="font-medium cursor-pointer">
                  Sélectionner une de mes annonces
                </Label>
                <p className="text-xs text-muted-foreground">
                  Choisissez un article déjà publié sur votre compte.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <RadioGroupItem value="text" id="mode-text" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="mode-text" className="font-medium cursor-pointer">
                  Décrire un autre objet
                </Label>
                <p className="text-xs text-muted-foreground">
                  Proposez un article qui n&apos;est pas encore annoncé.
                </p>
              </div>
            </div>
          </RadioGroup>

          <Separator />

          {proposalMode === "listing" ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Mes annonces publiées</Label>
              {myListingsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))}
                </div>
              ) : myListings.length === 0 ? (
                <div className="text-center py-6 bg-muted/50 rounded-xl">
                  <p className="text-sm text-muted-foreground mb-3">
                    Vous n&apos;avez aucune annonce publiée pour le moment.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setProposalOpen(false);
                      navigate("publish");
                    }}
                    className="rounded-full h-10"
                  >
                    Publier une annonce
                  </Button>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                  {myListings.map((mine) => {
                    const mineImage =
                      mine.images?.find((img) => img.isPrimary)?.url ?? mine.images?.[0]?.url;
                    const selected = selectedListingId === mine.id;
                    return (
                      <button
                        key={mine.id}
                        type="button"
                        onClick={() => setSelectedListingId(mine.id)}
                        aria-pressed={selected}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors",
                          selected
                            ? "border-forest-600 bg-mint-50 ring-1 ring-forest-600"
                            : "border-border hover:bg-accent"
                        )}
                      >
                        <div className="relative h-12 w-16 rounded-lg overflow-hidden bg-mint-50 shrink-0">
                          {mineImage ? (
                            <Image
                              src={mineImage}
                              alt=""
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <ImageIcon className="text-forest-300" size={16} aria-hidden="true" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-1">{mine.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {mine.city} • {timeAgo(mine.publishedAt || mine.createdAt)}
                          </p>
                        </div>
                        {selected && (
                          <Check size={16} className="text-forest-600 shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="offered-text" className="text-sm font-medium">
                Objet proposé (5 caractères minimum)
              </Label>
              <Textarea
                id="offered-text"
                value={offeredText}
                onChange={(e) => setOfferedText(e.target.value)}
                placeholder="Exemple : vélo VTT 26 pouces, freins neufs..."
                rows={3}
              />
            </div>
          )}

          {/* Photos facultatives */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Photos de l&apos;objet (facultatif)</Label>
            <div className="flex flex-wrap items-center gap-2">
              {proposalImages.map((url) => (
                <div key={url} className="relative h-16 w-16 rounded-lg overflow-hidden border">
                  <Image src={url} alt="Photo proposée" fill sizes="64px" className="object-cover" />
                  <button
                    type="button"
                    aria-label="Retirer cette photo"
                    onClick={() => setProposalImages((prev) => prev.filter((u) => u !== url))}
                    className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center"
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                </div>
              ))}
              {proposalImages.length < MAX_PROPOSAL_PHOTOS && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) => void handlePhotoChange(e)}
                    className="hidden"
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="h-16 w-16 rounded-lg border-dashed flex-col gap-1 text-xs text-muted-foreground"
                  >
                    {uploading ? (
                      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Camera size={18} aria-hidden="true" />
                    )}
                    Ajouter
                  </Button>
                </>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Jusqu&apos;à {MAX_PROPOSAL_PHOTOS} photos (JPEG, PNG ou WebP, 5 Mo maximum).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proposal-message" className="text-sm font-medium">
              Message (facultatif)
            </Label>
            <Textarea
              id="proposal-message"
              value={proposalMessage}
              onChange={(e) => setProposalMessage(e.target.value)}
              placeholder="Ajoutez un mot pour le propriétaire..."
              rows={2}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setProposalOpen(false)} className="rounded-full">
              Annuler
            </Button>
            <Button
              onClick={() => void submitProposal()}
              disabled={submitting}
              className="rounded-full bg-emerald-brand-500 hover:bg-emerald-brand-600 text-white h-11 px-6"
            >
              {submitting && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              Envoyer la proposition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======== Dialog : signalement ======== */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-forest-900">Signaler cette annonce</DialogTitle>
            <DialogDescription>
              Votre signalement est transmis à l&apos;équipe de modération de SamaTroc.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Motif du signalement</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger className="w-full h-11" aria-label="Motif du signalement">
                  <SelectValue placeholder="Sélectionnez un motif" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-details" className="text-sm font-medium">
                Détails (facultatif)
              </Label>
              <Textarea
                id="report-details"
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Expliquez brièvement le problème constaté..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReportOpen(false)} className="rounded-full">
              Annuler
            </Button>
            <Button
              onClick={() => void submitReport()}
              disabled={reportSubmitting}
              className="rounded-full h-11 px-6"
            >
              {reportSubmitting && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              Envoyer le signalement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
