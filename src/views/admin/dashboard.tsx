"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CreditCard,
  Download,
  FileText,
  Hourglass,
  RefreshCw,
  ScrollText,
  UserMinus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import {
  formatFCFA,
  paymentStatusColor,
  paymentStatusLabel,
  reportReasonLabel,
  timeAgo,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useNavigate } from "@/stores/router-store";
import { AdminEmptyState, AdminStatusBadge, handleAdminError } from "./admin-shared";

interface AdminStats {
  users: { total: number; new7d: number; suspended: number };
  listings: {
    published: number;
    pendingModeration: number;
    pendingPayment: number;
    refused: number;
    exchanged: number;
    total: number;
  };
  payments: { success: number; revenue: number; test: number };
  proposals: { total: number; completed: number };
  reports: { pending: number };
  recentPayments: {
    reference: string;
    amount: number;
    status: string;
    provider: string;
    isTest: boolean;
    createdAt: string;
    user: string;
    listingTitle: string;
  }[];
  recentReports: {
    id: string;
    targetType: string;
    reason: string;
    createdAt: string;
    reporter: string;
  }[];
  recentLogs: {
    id: string;
    action: string;
    targetType: string;
    details: string | null;
    createdAt: string;
    admin: string;
  }[];
}

const TARGET_LABELS: Record<string, string> = {
  LISTING: "Annonce",
  USER: "Utilisateur",
  MESSAGE: "Message",
};

/** Carte indicateur clé (rangée principale) */
function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "mt-2 text-2xl md:text-3xl font-extrabold truncate",
              tone === "default" && "text-forest-800",
              tone === "warning" && "text-mango-600",
              tone === "danger" && "text-red-600"
            )}
          >
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            tone === "default" && "bg-mint-100 text-forest-700",
            tone === "warning" && "bg-mango-100 text-mango-600",
            tone === "danger" && "bg-red-100 text-red-600"
          )}
        >
          <Icon size={20} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

/** Carte indicateur secondaire (plus compacte) */
function SecondaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="rounded-xl border bg-mint-50/50 p-4 flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white border border-mint-200 text-forest-700">
        <Icon size={17} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-forest-800 leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

/** Tableau de bord administrateur (cahier des charges §13) */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<AdminStats>("/api/admin/stats");
      setStats(data);
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = (type: "users" | "listings" | "payments") => {
    window.open(`/api/admin/export?type=${type}`, "_blank");
    toast.info("Export CSV en cours de téléchargement");
  };

  if (loading && !stats) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <AdminEmptyState
          icon={AlertTriangle}
          title="Impossible de charger les statistiques"
          description="Vérifiez votre connexion puis réessayez."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rangée 1 : indicateurs clés */}
      <section aria-label="Indicateurs clés">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <KpiCard
            icon={Users}
            label="Utilisateurs"
            value={stats.users.total}
            hint={
              stats.users.new7d > 0 ? `+${stats.users.new7d} cette semaine` : undefined
            }
          />
          <KpiCard
            icon={FileText}
            label="Annonces publiées"
            value={stats.listings.published}
          />
          <KpiCard
            icon={Hourglass}
            label="En attente de modération"
            value={stats.listings.pendingModeration}
            tone={stats.listings.pendingModeration > 0 ? "warning" : "default"}
          />
          <KpiCard
            icon={CreditCard}
            label="Paiements réussis"
            value={stats.payments.success}
          />
          <KpiCard
            icon={Banknote}
            label="Chiffre d'affaires brut"
            value={formatFCFA(stats.payments.revenue)}
            hint="Frais de publication"
          />
          <KpiCard
            icon={AlertTriangle}
            label="Signalements en attente"
            value={stats.reports.pending}
            tone={stats.reports.pending > 0 ? "danger" : "default"}
          />
        </div>
      </section>

      {/* Rangée 2 : indicateurs secondaires */}
      <section aria-label="Indicateurs secondaires">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <SecondaryCard
            label="Annonces refusées"
            value={stats.listings.refused}
            icon={FileText}
          />
          <SecondaryCard
            label="Annonces échangées"
            value={stats.listings.exchanged}
            icon={FileText}
          />
          <SecondaryCard
            label="Échanges réalisés"
            value={stats.proposals.completed}
            icon={RefreshCw}
          />
          <SecondaryCard
            label="Comptes suspendus"
            value={stats.users.suspended}
            icon={UserMinus}
          />
        </div>
      </section>

      {/* Exports CSV */}
      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div className="flex-1">
              <h2 className="font-semibold text-forest-800">Exports CSV</h2>
              <p className="text-sm text-muted-foreground">
                Téléchargez les données brutes pour vos analyses externes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCsv("listings")}>
                <Download size={15} aria-hidden="true" />
                Exporter les annonces
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCsv("payments")}>
                <Download size={15} aria-hidden="true" />
                Exporter les paiements
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCsv("users")}>
                <Download size={15} aria-hidden="true" />
                Exporter les utilisateurs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deux colonnes : derniers paiements + signalements récents */}
      <section className="grid lg:grid-cols-2 gap-4" aria-label="Activité récente">
        <Card>
          <CardContent className="p-4 md:p-5">
            <h2 className="font-semibold text-forest-800 mb-3">Derniers paiements</h2>
            {stats.recentPayments.length === 0 ? (
              <AdminEmptyState
                icon={CreditCard}
                title="Aucun paiement pour le moment"
                description="Les frais de publication encaissés apparaîtront ici."
              />
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Référence</TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Annonce</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentPayments.map((p) => (
                      <TableRow key={p.reference}>
                        <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                        <TableCell className="max-w-[120px] truncate">{p.user}</TableCell>
                        <TableCell className="max-w-[140px] truncate text-muted-foreground">
                          {p.listingTitle}
                        </TableCell>
                        <TableCell className="font-semibold">{formatFCFA(p.amount)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <AdminStatusBadge
                              label={paymentStatusLabel(p.status)}
                              colorClass={paymentStatusColor(p.status)}
                            />
                            {p.isTest ? (
                              <AdminStatusBadge
                                label="TEST"
                                colorClass="bg-mango-100 text-mango-700"
                              />
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {timeAgo(p.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-semibold text-forest-800">Signalements récents</h2>
              <Button
                variant="link"
                size="sm"
                className="gap-1 text-emerald-brand-600 p-0 h-auto"
                onClick={() => navigate("admin-reports")}
              >
                Tout voir
                <ArrowRight size={14} aria-hidden="true" />
              </Button>
            </div>
            {stats.recentReports.length === 0 ? (
              <AdminEmptyState
                icon={AlertTriangle}
                title="Aucun signalement en attente"
                description="La communauté ne remonte aucune anomalie actuellement."
              />
            ) : (
              <ul className="divide-y max-h-80 overflow-y-auto custom-scrollbar">
                {stats.recentReports.map((r) => (
                  <li key={r.id} className="py-3 flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminStatusBadge
                        label={TARGET_LABELS[r.targetType] ?? r.targetType}
                        colorClass="bg-gray-100 text-gray-700"
                      />
                      <span className="text-sm font-semibold text-forest-800">
                        {reportReasonLabel(r.reason)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {timeAgo(r.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Signalé par {r.reporter}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Dernières actions administratives */}
      <Card>
        <CardContent className="p-4 md:p-5">
          <h2 className="font-semibold text-forest-800 mb-3">Dernières actions administratives</h2>
          {stats.recentLogs.length === 0 ? (
            <AdminEmptyState
              icon={ScrollText}
              title="Aucune action enregistrée"
              description="Les actions des administrateurs seront tracées ici."
            />
          ) : (
            <ul className="divide-y max-h-96 overflow-y-auto custom-scrollbar">
              {stats.recentLogs.map((l) => (
                <li key={l.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="font-medium text-sm text-forest-800 shrink-0">{l.admin}</span>
                  <code className="text-xs bg-mint-50 text-forest-700 rounded px-1.5 py-0.5 w-fit shrink-0">
                    {l.action}
                  </code>
                  <span className="text-sm text-muted-foreground truncate flex-1">
                    {l.details ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {timeAgo(l.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
