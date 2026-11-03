"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Check,
  Handshake,
  ImageIcon,
  MessageCircleQuestion,
  MessagesSquare,
  MoreHorizontal,
  PackageSearch,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import AccountShell from "@/views/account/account-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/stores/router-store";
import { useAuth } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { proposalStatusLabel, proposalStatusColor, timeAgo } from "@/lib/constants";
import type { ProposalData } from "@/lib/types";
import { cn } from "@/lib/utils";

type Box = "received" | "sent";

const STATUS_FILTERS = [
  { value: "ALL", label: "Tous les statuts" },
  { value: "PENDING", label: "En attente" },
  { value: "DISCUSSING", label: "En discussion" },
  { value: "ACCEPTED", label: "Acceptées" },
  { value: "REFUSED", label: "Refusées" },
  { value: "CANCELLED", label: "Annulées" },
  { value: "COMPLETED", label: "Échanges réalisés" },
];

export default function ProposalsView() {
  const navigate = useRouter((s) => s.navigate);
  const refresh = useAuth((s) => s.refresh);

  const [box, setBox] = useState<Box>("received");
  const [received, setReceived] = useState<ProposalData[]>([]);
  const [sent, setSent] = useState<ProposalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Contre-proposition
  const [counterTarget, setCounterTarget] = useState<ProposalData | null>(null);
  const [counterText, setCounterText] = useState("");
  const [counterSending, setCounterSending] = useState(false);

  // Réalisation d'un échange
  const [completeTarget, setCompleteTarget] = useState<ProposalData | null>(null);

  const fetchProposals = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([
        api.get<{ proposals: ProposalData[] }>("/api/proposals?box=received"),
        api.get<{ proposals: ProposalData[] }>("/api/proposals?box=sent"),
      ]);
      setReceived(r.proposals);
      setSent(s.proposals);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProposals();
  }, [fetchProposals]);

  const current = box === "received" ? received : sent;
  const filtered = useMemo(
    () => (statusFilter === "ALL" ? current : current.filter((p) => p.status === statusFilter)),
    [current, statusFilter]
  );

  async function act(proposal: ProposalData, action: string, counter?: string, successMessage?: string) {
    setBusyId(proposal.id);
    try {
      const res = await api.patch<{ message?: string }>(`/api/proposals/${proposal.id}`, {
        action,
        counterText: counter,
      });
      toast.success(res.message || successMessage || "Action effectuée");
      await fetchProposals();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCounterSubmit() {
    if (!counterTarget) return;
    if (counterText.trim().length < 3) {
      toast.error("Décrivez votre contre-proposition (3 caractères minimum)");
      return;
    }
    setCounterSending(true);
    await act(counterTarget, "counter", counterText.trim(), "Contre-proposition envoyée");
    setCounterSending(false);
    setCounterTarget(null);
    setCounterText("");
  }

  const isPendingish = (p: ProposalData) => p.status === "PENDING" || p.status === "DISCUSSING";

  return (
    <AccountShell
      active="proposals"
      title="Mes propositions d'échange"
      actions={
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filtrer par statut" className="h-11 w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {/* Onglets reçues / envoyées */}
      <div role="tablist" aria-label="Boîtes de propositions" className="mb-5 flex gap-2">
        {(
          [
            { key: "received" as Box, label: "Reçues", count: received.length },
            { key: "sent" as Box, label: "Envoyées", count: sent.length },
          ]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={box === t.key}
            onClick={() => setBox(t.key)}
            className={cn(
              "flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
              box === t.key
                ? "border-forest-200 bg-mint-100 font-semibold text-forest-800"
                : "border-border bg-white text-foreground/70 hover:bg-accent"
            )}
          >
            {t.label}
            <span
              className={cn(
                "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                box === t.key ? "bg-forest-700 text-white" : "bg-muted text-muted-foreground"
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Handshake className="text-forest-200" size={40} aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {box === "received"
              ? "Aucune proposition reçue pour le moment. Vos annonces publiées attireront des échanges."
              : "Vous n'avez envoyé aucune proposition. Parcourez les annonces et proposez un échange."}
          </p>
          <Button
            type="button"
            onClick={() => navigate("explore")}
            className="h-11 bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
          >
            <PackageSearch size={18} aria-hidden="true" />
            Explorer les annonces
          </Button>
        </Card>
      ) : (
        <ul className="space-y-4">
          {filtered.map((p) => {
            const listingImage = p.listing.images?.find((i) => i.isPrimary)?.url ?? p.listing.images?.[0]?.url;
            const counterpart = p.direction === "received" ? p.proposer : p.owner;
            const busy = busyId === p.id;
            return (
              <li key={p.id}>
                <Card className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                    {/* Annonce ciblée */}
                    <div className="flex min-w-0 flex-1 gap-3">
                      <button
                        type="button"
                        onClick={() => navigate("listing", { id: p.listing.id })}
                        aria-label={`Voir l'annonce ${p.listing.title}`}
                        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-mint-50"
                      >
                        {listingImage ? (
                          <Image src={listingImage} alt={p.listing.title} fill sizes="80px" className="object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-forest-300">
                            <ImageIcon size={20} aria-hidden="true" />
                          </span>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge className={cn("border-transparent font-semibold", proposalStatusColor(p.status))}>
                            {proposalStatusLabel(p.status)}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {p.direction === "received"
                              ? `De ${p.proposer.firstName} ${p.proposer.lastName}`
                              : `Pour ${p.owner.firstName} ${p.owner.lastName}`}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate("listing", { id: p.listing.id })}
                          className="mt-1 block max-w-full truncate text-left text-sm font-semibold text-foreground hover:text-forest-700"
                        >
                          {p.listing.title}
                        </button>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {timeAgo(p.createdAt)}
                          {p.respondedAt ? ` • réponse ${timeAgo(p.respondedAt)}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Objet proposé */}
                    <div className="flex-1 rounded-xl bg-mint-50/70 p-3">
                      <p className="text-xs font-semibold text-forest-700">Objet proposé en échange</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        {(p.offeredImages?.length ?? 0) > 0 ? (
                          <span className="flex gap-1">
                            {p.offeredImages.slice(0, 3).map((url) => (
                              <span key={url} className="relative block h-10 w-10 overflow-hidden rounded-lg">
                                <Image src={url} alt="Objet proposé" fill sizes="40px" className="object-cover" />
                              </span>
                            ))}
                          </span>
                        ) : null}
                        <p className="min-w-0 flex-1 truncate text-sm text-foreground/90">
                          {p.offeredListing?.title ?? p.offeredText ?? "Objet décrit par le membre"}
                        </p>
                      </div>
                      {p.message && (
                        <p className="mt-2 border-l-2 border-forest-200 pl-2 text-xs italic text-muted-foreground">
                          « {p.message} »
                        </p>
                      )}
                      {p.counterText && (
                        <p
                          role="note"
                          className="mt-2 rounded-lg border border-mango-200 bg-mango-50 px-2.5 py-1.5 text-xs text-mango-700"
                        >
                          Contre-proposition : {p.counterText}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                    {p.direction === "received" && isPendingish(p) && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => act(p, "accept", undefined, "Proposition acceptée")}
                          className="h-10 min-h-11 bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
                        >
                          <Check size={16} aria-hidden="true" />
                          Accepter
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => act(p, "refuse", undefined, "Proposition refusée")}
                          className="h-11 min-h-11 border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <X size={16} aria-hidden="true" />
                          Refuser
                        </Button>
                        {p.status === "PENDING" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => act(p, "discuss", undefined, "Discussion engagée avec l'auteur")}
                            className="h-11 min-h-11"
                          >
                            <MessageCircleQuestion size={16} aria-hidden="true" />
                            Demander des précisions
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setCounterTarget(p);
                            setCounterText(p.counterText ?? "");
                          }}
                          className="h-11 min-h-11"
                        >
                          <Undo2 size={16} aria-hidden="true" />
                          Contre-proposer
                        </Button>
                      </>
                    )}

                    {p.direction === "sent" && p.status === "PENDING" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => act(p, "cancel", undefined, "Proposition annulée")}
                        className="h-11 min-h-11"
                      >
                        <X size={16} aria-hidden="true" />
                        Annuler ma proposition
                      </Button>
                    )}

                    {p.status === "ACCEPTED" && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => setCompleteTarget(p)}
                          className="h-11 min-h-11 bg-forest-700 text-white hover:bg-forest-800"
                        >
                          <Check size={16} aria-hidden="true" />
                          Marquer l&apos;échange comme réalisé
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => navigate("messages")}
                          className="h-11 min-h-11"
                        >
                          <MessagesSquare size={16} aria-hidden="true" />
                          Ouvrir la conversation
                        </Button>
                      </>
                    )}

                    {p.status === "COMPLETED" && (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-forest-700">
                        <Check size={14} aria-hidden="true" />
                        Échange réalisé le {p.completedAt ? new Date(p.completedAt).toLocaleDateString("fr-FR") : "—"}
                      </span>
                    )}

                    {p.direction === "received" && isPendingish(p) && (
                      <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
                        <MoreHorizontal size={14} aria-hidden="true" className="inline" /> Répondez vite pour garder le contact
                      </span>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* Dialog : contre-proposition */}
      <Dialog open={Boolean(counterTarget)} onOpenChange={(o) => !o && setCounterTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Proposer un autre échange</DialogTitle>
            <DialogDescription>
              Indiquez ce que vous proposez à la place pour l&apos;annonce « {counterTarget?.listing.title} ».
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="counter-text">Votre contre-proposition</Label>
            <Textarea
              id="counter-text"
              placeholder="Ex. Je peux plutôt proposer ma table basse en bois massif…"
              value={counterText}
              onChange={(e) => setCounterText(e.target.value)}
              maxLength={300}
              className="min-h-24"
            />
            <p className="text-right text-[11px] text-muted-foreground">{counterText.length}/300</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCounterTarget(null)} className="h-11">
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleCounterSubmit}
              disabled={counterSending}
              className="h-11 bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
            >
              {counterSending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              ) : (
                <Undo2 size={16} aria-hidden="true" />
              )}
              Envoyer la contre-proposition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : confirmer la réalisation */}
      <AlertDialog open={Boolean(completeTarget)} onOpenChange={(o) => !o && setCompleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la réalisation de l&apos;échange ?</AlertDialogTitle>
            <AlertDialogDescription>
              En confirmant, l&apos;annonce « {completeTarget?.listing.title} » sera marquée comme
              échangée et n&apos;apparaîtra plus dans les recherches. Ne confirmez qu&apos;après la
              remise en main propre des objets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Pas encore</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => completeTarget && act(completeTarget, "complete", undefined, "Échange marqué comme réalisé. Merci !")}
              className="bg-forest-700 text-white hover:bg-forest-800"
            >
              Oui, échange réalisé
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AccountShell>
  );
}
