"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Ban,
  CheckCircle2,
  Eye,
  FileText,
  MoreVertical,
  PackagePlus,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import AccountShell from "@/views/account/account-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from "@/stores/router-store";
import { api } from "@/lib/api";
import {
  formatFCFA,
  listingStatusLabel,
  listingStatusColor,
  timeAgo,
} from "@/lib/constants";
import type { ListingSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Annonce de l'espace personnel : le motif de refus peut être renvoyé par l'API */
interface MyListing extends ListingSummary {
  refusalReason?: string | null;
}

interface StatusTab {
  key: string;
  label: string;
}

const TABS: StatusTab[] = [
  { key: "ALL", label: "Toutes" },
  { key: "DRAFT", label: "Brouillons" },
  { key: "PENDING_PAYMENT", label: "En attente de paiement" },
  { key: "PENDING_MODERATION", label: "En modération" },
  { key: "PUBLISHED", label: "Publiées" },
  { key: "REFUSED", label: "Refusées" },
  { key: "DEACTIVATED", label: "Désactivées" },
  { key: "EXCHANGED", label: "Échangées" },
];

const EMPTY_MESSAGES: Record<string, string> = {
  ALL: "Vous n'avez publié aucune annonce pour le moment.",
  DRAFT: "Aucun brouillon. Les annonces enregistrées en brouillon apparaissent ici.",
  PENDING_PAYMENT: "Aucune annonce en attente de paiement.",
  PENDING_MODERATION: "Aucune annonce en cours de modération.",
  PUBLISHED: "Aucune annonce publiée. Publiez un article pour lancer des échanges.",
  REFUSED: "Bonne nouvelle : aucune annonce refusée.",
  DEACTIVATED: "Aucune annonce désactivée.",
  EXCHANGED: "Aucune annonce échangée pour l'instant. Vos réussites apparaîtront ici.",
};

export default function MyListingsView() {
  const navigate = useRouter((s) => s.navigate);
  const [listings, setListings] = useState<MyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Confirmations
  const [deleteTarget, setDeleteTarget] = useState<MyListing | null>(null);
  const [exchangeTarget, setExchangeTarget] = useState<MyListing | null>(null);

  const fetchListings = useCallback(async () => {
    try {
      const res = await api.get<{ listings: MyListing[] }>("/api/listings/my");
      setListings(res.listings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchListings();
  }, [fetchListings]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: listings.length };
    for (const l of listings) map[l.status] = (map[l.status] ?? 0) + 1;
    return map;
  }, [listings]);

  const filtered = useMemo(
    () => (tab === "ALL" ? listings : listings.filter((l) => l.status === tab)),
    [listings, tab]
  );

  async function changeStatus(listing: MyListing, status: "PUBLISHED" | "DEACTIVATED" | "EXCHANGED", successMessage: string) {
    setBusyId(listing.id);
    try {
      await api.post(`/api/listings/${listing.id}/status`, { status });
      toast.success(successMessage);
      await fetchListings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(listing: MyListing) {
    setBusyId(listing.id);
    try {
      await api.del(`/api/listings/${listing.id}`);
      toast.success("Annonce supprimée");
      await fetchListings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible");
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  const canEdit = (l: MyListing) => ["DRAFT", "PENDING_PAYMENT", "REFUSED"].includes(l.status);
  const canToggleActive = (l: MyListing) => l.status === "PUBLISHED" || l.status === "DEACTIVATED";
  const canMarkExchanged = (l: MyListing) => l.status === "PUBLISHED" || l.status === "DEACTIVATED";
  const canDelete = (l: MyListing) => ["DRAFT", "PENDING_PAYMENT", "REFUSED", "DEACTIVATED"].includes(l.status);

  return (
    <AccountShell
      active="my-listings"
      title="Mes annonces"
      actions={
        <Button
          type="button"
          onClick={() => navigate("publish")}
          className="h-11 bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
        >
          <PackagePlus size={18} aria-hidden="true" />
          Publier un article
        </Button>
      }
    >
      {/* Onglets de statut */}
      <div
        role="tablist"
        aria-label="Filtrer mes annonces par statut"
        className="mb-5 -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 custom-scrollbar"
      >
        {TABS.map((t) => {
          const count = counts[t.key] ?? 0;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                isActive
                  ? "border-forest-200 bg-mint-100 font-semibold text-forest-800"
                  : "border-border bg-white text-foreground/70 hover:bg-accent"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold",
                  isActive ? "bg-forest-700 text-white" : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <FileText className="text-forest-200" size={40} aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{EMPTY_MESSAGES[tab] ?? "Aucune annonce."}</p>
          <Button
            type="button"
            onClick={() => navigate("publish")}
            className="h-11 bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
          >
            <PackagePlus size={18} aria-hidden="true" />
            Publier un article
          </Button>
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((listing) => {
            const primary = listing.images?.find((i) => i.isPrimary)?.url ?? listing.images?.[0]?.url;
            const busy = busyId === listing.id;
            return (
              <li key={listing.id}>
                <Card className="p-3 sm:p-4">
                  <div className="flex gap-3 sm:gap-4">
                    {/* Miniature */}
                    <button
                      type="button"
                      onClick={() => navigate("listing", { id: listing.id })}
                      aria-label={`Voir l'annonce ${listing.title}`}
                      className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-mint-50 sm:h-20 sm:w-20"
                    >
                      {primary ? (
                        <Image
                          src={primary}
                          alt={listing.title}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-forest-300">
                          <FileText size={22} aria-hidden="true" />
                        </span>
                      )}
                    </button>

                    {/* Informations */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className={cn("border-transparent font-semibold", listingStatusColor(listing.status))}>
                          {listingStatusLabel(listing.status)}
                        </Badge>
                        {listing.featured && listing.status === "PUBLISHED" && (
                          <Badge className="border-transparent bg-mango-100 font-semibold text-mango-700">
                            À la une
                          </Badge>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate("listing", { id: listing.id })}
                        className="mt-1 block max-w-full truncate text-left text-sm font-semibold text-foreground hover:text-forest-700"
                      >
                        {listing.title}
                      </button>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Réf. <span className="font-mono">{listing.reference}</span>
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye size={13} aria-hidden="true" />
                          {listing.viewsCount} vue{listing.viewsCount > 1 ? "s" : ""}
                        </span>
                        <span className="hidden sm:inline">{listing.city}</span>
                        <span className="font-medium text-forest-700">{formatFCFA(listing.fees)} de frais</span>
                        <span className="hidden md:inline">{timeAgo(listing.createdAt)}</span>
                      </div>

                      {listing.status === "REFUSED" && listing.refusalReason ? (
                        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700" role="alert">
                          Motif du refus : {listing.refusalReason}
                        </p>
                      ) : null}
                    </div>

                    {/* Actions */}
                    <div className="shrink-0 self-start">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={busy}
                            aria-label={`Actions pour l'annonce ${listing.title}`}
                            className="h-11 w-11"
                          >
                            {busy ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-forest-300 border-t-transparent" aria-hidden="true" />
                            ) : (
                              <MoreVertical size={18} aria-hidden="true" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => navigate("listing", { id: listing.id })}>
                            <Eye size={15} aria-hidden="true" />
                            Voir l&apos;annonce
                          </DropdownMenuItem>
                          {canEdit(listing) && (
                            <DropdownMenuItem onClick={() => navigate("publish", { editId: listing.id })}>
                              <Pencil size={15} aria-hidden="true" />
                              Modifier
                            </DropdownMenuItem>
                          )}
                          {canToggleActive(listing) && (
                            listing.status === "PUBLISHED" ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  changeStatus(listing, "DEACTIVATED", "Annonce désactivée")
                                }
                              >
                                <Ban size={15} aria-hidden="true" />
                                Désactiver
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() =>
                                  changeStatus(listing, "PUBLISHED", "Annonce réactivée")
                                }
                              >
                                <RotateCcw size={15} aria-hidden="true" />
                                Réactiver
                              </DropdownMenuItem>
                            )
                          )}
                          {canMarkExchanged(listing) && (
                            <DropdownMenuItem onClick={() => setExchangeTarget(listing)}>
                              <CheckCircle2 size={15} aria-hidden="true" />
                              Marquer comme échangée
                            </DropdownMenuItem>
                          )}
                          {canDelete(listing) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(listing)}
                                className="text-red-600 focus:text-red-700"
                              >
                                <Trash2 size={15} aria-hidden="true" />
                                Supprimer
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* Confirmation : marquer comme échangée */}
      <AlertDialog open={Boolean(exchangeTarget)} onOpenChange={(o) => !o && setExchangeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marquer cette annonce comme échangée ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {exchangeTarget?.title} » ne sera plus visible dans les recherches. Cette action
              met fin au cycle de vie de l&apos;annonce.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => exchangeTarget && changeStatus(exchangeTarget, "EXCHANGED", "Annonce marquée comme échangée. Félicitations !")}
              className="bg-forest-700 text-white hover:bg-forest-800"
            >
              Confirmer l&apos;échange
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation : suppression */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette annonce ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleteTarget?.title} » sera définitivement supprimée. Cette action est
              irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AccountShell>
  );
}
