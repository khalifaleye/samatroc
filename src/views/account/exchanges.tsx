"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ArrowLeftRight, Check, ImageIcon, PartyPopper, Repeat } from "lucide-react";
import { toast } from "sonner";
import AccountShell from "@/views/account/account-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useAuth } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/constants";
import type { ProposalData } from "@/lib/types";

interface ExchangeItem {
  id: string;
  status: "ACCEPTED" | "COMPLETED";
  listing: ProposalData["listing"];
  offeredListing: ProposalData["offeredListing"];
  offeredText: string | null;
  offeredImages: string[];
  otherParty: string;
  completedAt: string | null;
  raw: ProposalData;
}

export default function ExchangesView() {
  const refresh = useAuth((s) => s.refresh);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ExchangeItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [completeTarget, setCompleteTarget] = useState<ExchangeItem | null>(null);

  const fetchExchanges = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([
        api.get<{ proposals: ProposalData[] }>("/api/proposals?box=received"),
        api.get<{ proposals: ProposalData[] }>("/api/proposals?box=sent"),
      ]);
      const merged = [...r.proposals, ...s.proposals].filter(
        (p) => p.status === "ACCEPTED" || p.status === "COMPLETED"
      );
      const mapped: ExchangeItem[] = merged.map((p) => ({
        id: p.id,
        status: p.status as "ACCEPTED" | "COMPLETED",
        listing: p.listing,
        offeredListing: p.offeredListing,
        offeredText: p.offeredText,
        offeredImages: p.offeredImages,
        otherParty:
          p.direction === "received"
            ? `${p.proposer.firstName} ${p.proposer.lastName}`
            : `${p.owner.firstName} ${p.owner.lastName}`,
        completedAt: p.completedAt,
        raw: p,
      }));
      setItems(mapped);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchExchanges();
  }, [fetchExchanges]);

  const inProgress = useMemo(() => items.filter((i) => i.status === "ACCEPTED"), [items]);
  const completed = useMemo(() => items.filter((i) => i.status === "COMPLETED"), [items]);

  async function markComplete(item: ExchangeItem) {
    setBusyId(item.id);
    try {
      await api.patch(`/api/proposals/${item.id}`, { action: "complete" });
      toast.success("Échange marqué comme réalisé. Merci !");
      await fetchExchanges();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible");
    } finally {
      setBusyId(null);
      setCompleteTarget(null);
    }
  }

  function ExchangeObject({ item }: { item: ExchangeItem }) {
    const offeredImage =
      item.offeredImages?.[0] ??
      item.offeredListing?.images?.find((i) => i.isPrimary)?.url ??
      item.offeredListing?.images?.[0]?.url;
    const listingImage =
      item.listing.images?.find((i) => i.isPrimary)?.url ?? item.listing.images?.[0]?.url;

    return (
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Annonce ciblée */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-mint-50">
            {listingImage ? (
              <Image src={listingImage} alt={item.listing.title} fill sizes="56px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-forest-300">
                <ImageIcon size={18} aria-hidden="true" />
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Objet donné
            </span>
            <span className="block truncate text-sm font-medium text-foreground">{item.listing.title}</span>
          </span>
        </div>

        {/* Flèche d'échange */}
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint-100 text-forest-700"
          aria-hidden="true"
        >
          <ArrowLeftRight size={16} />
        </span>

        {/* Objet reçu */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-mango-50">
            {offeredImage ? (
              <Image
                src={offeredImage}
                alt={item.offeredListing?.title ?? item.offeredText ?? "Objet reçu"}
                fill
                sizes="56px"
                className="object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-mango-300">
                <ImageIcon size={18} aria-hidden="true" />
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Objet reçu
            </span>
            <span className="block truncate text-sm font-medium text-foreground">
              {item.offeredListing?.title ?? item.offeredText ?? "Objet convenu avec le membre"}
            </span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <AccountShell active="exchanges" title="Mes échanges">
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mint-100">
            <Repeat className="text-forest-600" size={26} aria-hidden="true" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground">
            Vos échanges à venir et réussis apparaîtront ici. Chaque objet échangé, c&apos;est un
            objet qui connaît une seconde vie : lancez-vous !
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Échanges en cours */}
          <section aria-label="Échanges en cours">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-forest-800">
              <ArrowLeftRight size={18} className="text-emerald-brand-600" aria-hidden="true" />
              En cours — organisez la remise
              <Badge className="ml-1 border-transparent bg-mint-100 font-semibold text-forest-700">
                {inProgress.length}
              </Badge>
            </h2>
            {inProgress.length === 0 ? (
              <Card className="p-5 text-sm text-muted-foreground">
                Aucun échange en cours. Acceptez une proposition pour organiser une remise en main propre.
              </Card>
            ) : (
              <ul className="space-y-3">
                {inProgress.map((item) => (
                  <li key={item.id}>
                    <Card className="p-4">
                      <ExchangeObject item={item} />
                      <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                          Partenaire : <span className="font-medium text-forest-700">{item.otherParty}</span> —
                          convenez ensemble du lieu et de l&apos;heure de la remise.
                        </p>
                        <Button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => setCompleteTarget(item)}
                          className="h-11 bg-forest-700 text-white hover:bg-forest-800"
                        >
                          <Check size={16} aria-hidden="true" />
                          Marquer comme réalisé
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Historique */}
          <section aria-label="Échanges réalisés">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-forest-800">
              <PartyPopper size={18} className="text-mango-500" aria-hidden="true" />
              Historique des échanges réalisés
              <Badge className="ml-1 border-transparent bg-forest-600 font-semibold text-white">
                {completed.length}
              </Badge>
            </h2>
            {completed.length === 0 ? (
              <Card className="p-5 text-sm text-muted-foreground">
                Votre première réussite sera célébrée ici.
              </Card>
            ) : (
              <ul className="space-y-3">
                {completed.map((item) => (
                  <li key={item.id}>
                    <Card className="p-4">
                      <ExchangeObject item={item} />
                      <div className="mt-3 flex flex-col gap-1.5 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                          Avec <span className="font-medium text-forest-700">{item.otherParty}</span>
                          {item.completedAt ? ` — réalisé le ${formatDate(item.completedAt)}` : ""}
                        </p>
                        <Badge className="w-fit border-transparent bg-forest-600 font-semibold text-white">
                          <Check size={12} aria-hidden="true" />
                          Échange réalisé
                        </Badge>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* Confirmation réalisation */}
      <AlertDialog open={Boolean(completeTarget)} onOpenChange={(o) => !o && setCompleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marquer cet échange comme réalisé ?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;annonce « {completeTarget?.listing.title} » sera marquée comme échangée.
              Ne confirmez qu&apos;après avoir reçu l&apos;objet convenu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Pas encore</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => completeTarget && markComplete(completeTarget)}
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
