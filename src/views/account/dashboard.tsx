"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Bell,
  Clock,
  FileText,
  Handshake,
  Inbox,
  MessageSquare,
  PackagePlus,
  Plus,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import AccountShell from "@/views/account/account-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ListingCard, ListingCardSkeleton } from "@/components/listing-card";
import { useRouter } from "@/stores/router-store";
import { api } from "@/lib/api";
import { timeAgo, proposalStatusLabel, proposalStatusColor } from "@/lib/constants";
import type { ListingSummary, NotificationData, ProposalData } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DashboardData {
  activeListings: number;
  pendingListings: number;
  proposalsReceived: number;
  proposalsSent: number;
  completedExchanges: number;
  favoritesCount: number;
  unreadMessages: number;
  unreadNotifications: number;
  myActiveListings: ListingSummary[];
  recentProposals: ProposalData[];
  recentNotifications: NotificationData[];
}

export default function DashboardView() {
  const navigate = useRouter((s) => s.navigate);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get<DashboardData>("/api/users/me/dashboard");
        if (mounted) setData(res);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Chargement impossible");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = [
    { label: "Annonces actives", value: data?.activeListings ?? 0, icon: FileText, tone: "bg-mint-100 text-forest-700" },
    { label: "En attente", value: data?.pendingListings ?? 0, icon: Clock, tone: "bg-mango-100 text-mango-700" },
    { label: "Propositions reçues", value: data?.proposalsReceived ?? 0, icon: Inbox, tone: "bg-emerald-brand-100 text-emerald-brand-700" },
    { label: "Propositions envoyées", value: data?.proposalsSent ?? 0, icon: Send, tone: "bg-mint-100 text-forest-600" },
    { label: "Échanges réalisés", value: data?.completedExchanges ?? 0, icon: ArrowLeftRight, tone: "bg-forest-100 text-forest-800" },
  ];

  return (
    <AccountShell active="dashboard" title="Vue d'ensemble">
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : !data ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Impossible de charger vos indicateurs. Rechargez la page.
        </Card>
      ) : (
        <div className="space-y-6 animate-fade-up">
          {/* Statistiques */}
          <section aria-label="Statistiques de mon activité" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="p-4">
                  <div className="flex items-center gap-3">
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", stat.tone)}>
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xl font-bold leading-tight text-forest-800">{stat.value}</p>
                      <p className="truncate text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </section>

          {/* Actions rapides */}
          <section aria-label="Actions rapides" className="flex flex-wrap gap-2.5">
            <Button
              type="button"
              onClick={() => navigate("publish")}
              className="h-11 bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
            >
              <Plus size={18} aria-hidden="true" />
              Publier un article
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("my-listings")}
              className="h-11"
            >
              <FileText size={18} aria-hidden="true" />
              Voir mes annonces
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("messages")}
              className="h-11"
            >
              <MessageSquare size={18} aria-hidden="true" />
              Ouvrir la messagerie
            </Button>
          </section>

          {/* Propositions + notifications récentes */}
          <section className="grid gap-4 lg:grid-cols-2" aria-label="Activité récente">
            <Card className="flex flex-col p-0">
              <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/60 pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-forest-800">
                  <Handshake size={18} className="text-emerald-brand-600" aria-hidden="true" />
                  Dernières propositions
                </CardTitle>
                <button
                  type="button"
                  onClick={() => navigate("proposals")}
                  className="text-xs font-semibold text-forest-600 underline-offset-4 hover:underline"
                >
                  Voir tout
                </button>
              </CardHeader>
              <CardContent className="p-2 sm:p-3">
                {data.recentProposals.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <Handshake className="text-forest-200" size={32} aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">
                      Aucune proposition pour le moment. Publiez un article pour lancer des échanges.
                    </p>
                  </div>
                ) : (
                  <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto custom-scrollbar">
                    {data.recentProposals.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => navigate("proposals")}
                          className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-accent"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {p.listing.title}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {p.direction === "received" ? "Reçue de" : "Envoyée à"}{" "}
                              {(p.direction === "received" ? p.proposer : p.owner).firstName} • {timeAgo(p.createdAt)}
                            </span>
                          </span>
                          <Badge className={cn("shrink-0 border-transparent font-semibold", proposalStatusColor(p.status))}>
                            {proposalStatusLabel(p.status)}
                          </Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col p-0">
              <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/60 pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-forest-800">
                  <Bell size={18} className="text-mango-500" aria-hidden="true" />
                  Notifications récentes
                </CardTitle>
                <button
                  type="button"
                  onClick={() => navigate("notifications")}
                  className="text-xs font-semibold text-forest-600 underline-offset-4 hover:underline"
                >
                  Voir tout
                </button>
              </CardHeader>
              <CardContent className="p-2 sm:p-3">
                {data.recentNotifications.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <Bell className="text-forest-200" size={32} aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">Aucune notification pour le moment.</p>
                  </div>
                ) : (
                  <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto custom-scrollbar">
                    {data.recentNotifications.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => navigate("notifications")}
                          className="flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-accent"
                        >
                          <span className="mt-1.5 flex h-2 w-2 shrink-0">
                            {!n.readAt && <span className="h-2 w-2 rounded-full bg-emerald-brand-500" aria-label="Non lue" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">{n.title}</span>
                            <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>
                            <span className="mt-1 block text-[11px] text-muted-foreground/80">{timeAgo(n.createdAt)}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Mes annonces actives */}
          <section aria-label="Mes annonces actives">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-forest-800">Mes annonces actives</h2>
              <button
                type="button"
                onClick={() => navigate("my-listings")}
                className="text-xs font-semibold text-forest-600 underline-offset-4 hover:underline"
              >
                Tout voir
              </button>
            </div>
            {data.myActiveListings.length === 0 ? (
              <Card className="flex flex-col items-center gap-3 p-8 text-center">
                <PackagePlus className="text-forest-200" size={36} aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  Vous n&apos;avez aucune annonce publiée. Publiez votre premier article pour trouver un échange.
                </p>
                <Button
                  type="button"
                  onClick={() => navigate("publish")}
                  className="h-11 bg-emerald-brand-500 text-white hover:bg-emerald-brand-600"
                >
                  <Plus size={18} aria-hidden="true" />
                  Publier un article
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                {data.myActiveListings.slice(0, 6).map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AccountShell>
  );
}
