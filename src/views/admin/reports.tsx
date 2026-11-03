"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Flag,
  MessageSquare,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { reportReasonLabel, timeAgo } from "@/lib/constants";
import { useNavigate } from "@/stores/router-store";
import { AdminEmptyState, AdminStatusBadge, handleAdminError } from "./admin-shared";

interface AdminReport {
  id: string;
  targetType: string;
  targetId: string;
  targetPreview: string | null;
  targetUrl: string | null;
  reason: string;
  details: string | null;
  status: string;
  resolution: string | null;
  createdAt: string;
  reporter: string;
  handledBy: string | null;
}

const TARGET_META: Record<string, { label: string; className: string }> = {
  LISTING: { label: "Annonce", className: "bg-mint-100 text-forest-700" },
  USER: { label: "Utilisateur", className: "bg-mango-100 text-mango-700" },
  MESSAGE: { label: "Message", className: "bg-gray-100 text-gray-700" },
};

const REPORT_TABS = [
  { value: "PENDING", label: "En attente" },
  { value: "RESOLVED", label: "Résolus" },
  { value: "DISMISSED", label: "Rejetés" },
  { value: "ALL", label: "Tous" },
];

/** Gestion des signalements de la communauté */
export default function AdminReports() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("PENDING");
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);

  // Dialogs de traitement
  const [resolveTarget, setResolveTarget] = useState<AdminReport | null>(null);
  const [resolution, setResolution] = useState("");
  const [dismissTarget, setDismissTarget] = useState<AdminReport | null>(null);
  const [dismissReason, setDismissReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab !== "ALL") params.set("status", tab);
      const res = await api.get<{ reports: AdminReport[] }>(
        `/api/admin/reports?${params.toString()}`
      );
      setReports(res.reports);
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setLoading(false);
    }
  }, [tab, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitResolve = async () => {
    if (!resolveTarget) return;
    setActionPending(true);
    try {
      const res = await api.patch<{ message?: string }>(`/api/admin/reports/${resolveTarget.id}`, {
        action: "resolve",
        resolution: resolution.trim(),
      });
      toast.success(res.message ?? "Signalement résolu");
      setResolveTarget(null);
      setResolution("");
      void load();
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setActionPending(false);
    }
  };

  const submitDismiss = async () => {
    if (!dismissTarget) return;
    setActionPending(true);
    try {
      const res = await api.patch<{ message?: string }>(`/api/admin/reports/${dismissTarget.id}`, {
        action: "dismiss",
        resolution: dismissReason.trim(),
      });
      toast.success(res.message ?? "Signalement rejeté");
      setDismissTarget(null);
      setDismissReason("");
      void load();
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setActionPending(false);
    }
  };

  const openTarget = (r: AdminReport) => {
    if (r.targetUrl?.startsWith("listing:")) {
      navigate("listing", { id: r.targetId });
      return;
    }
    toast.info("Seules les cibles de type annonce disposent d'une page consultable.");
  };

  const statusBadge = (status: string) => {
    if (status === "PENDING")
      return <AdminStatusBadge label="En attente" colorClass="bg-mango-100 text-mango-700" />;
    if (status === "RESOLVED")
      return <AdminStatusBadge label="Résolu" colorClass="bg-mint-100 text-forest-700" />;
    return <AdminStatusBadge label="Rejeté" colorClass="bg-gray-100 text-gray-700" />;
  };

  return (
    <div className="space-y-4">
      {/* Onglets de filtrage */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto custom-scrollbar pb-1">
          <TabsList className="h-auto">
            {REPORT_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="whitespace-nowrap">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {/* Liste des signalements */}
      {loading ? (
        <div className="space-y-4" role="status" aria-live="polite">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <AdminEmptyState
            icon={AlertTriangle}
            title="Aucun signalement dans cette catégorie"
            description="Les signalements envoyés par les membres apparaîtront ici pour traitement."
          />
        </Card>
      ) : (
        <ul className="space-y-4">
          {reports.map((r) => {
            const targetMeta = TARGET_META[r.targetType] ?? {
              label: r.targetType,
              className: "bg-gray-100 text-gray-700",
            };
            const isListing = r.targetUrl?.startsWith("listing:");
            return (
              <li key={r.id}>
                <Card>
                  <CardContent className="p-4 md:p-5 space-y-3">
                    {/* En-tête : type de cible, motif, date */}
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminStatusBadge
                        label={targetMeta.label}
                        colorClass={targetMeta.className}
                      />
                      {statusBadge(r.status)}
                      <span className="text-sm font-bold text-forest-800">
                        {reportReasonLabel(r.reason)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {timeAgo(r.createdAt)}
                      </span>
                    </div>

                    {/* Détails fournis par le déclarant */}
                    {r.details ? (
                      <p className="text-sm italic text-muted-foreground bg-mint-50/60 rounded-lg p-3">
                        « {r.details} »
                      </p>
                    ) : null}

                    {/* Cible */}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Cible :</span>
                      <span className="font-medium text-forest-800">
                        {r.targetPreview ?? "(contenu supprimé)"}
                      </span>
                      {isListing ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="gap-1 text-emerald-brand-600 p-0 h-auto"
                          onClick={() => openTarget(r)}
                        >
                          Consulter
                          <ExternalLink size={13} aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>

                    {/* Déclarant */}
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Flag size={12} aria-hidden="true" />
                      Signalé par {r.reporter}, {timeAgo(r.createdAt)}
                    </p>

                    {/* Traitement existant */}
                    {r.status !== "PENDING" && r.handledBy ? (
                      <div className="flex items-start gap-2 text-sm rounded-lg border bg-white p-3">
                        <CheckCircle2
                          size={16}
                          className="text-forest-600 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-medium text-forest-800">
                            Traité par {r.handledBy}
                          </p>
                          {r.resolution ? (
                            <p className="text-muted-foreground">{r.resolution}</p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {/* Actions (uniquement en attente) */}
                    {r.status === "PENDING" ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          size="sm"
                          className="bg-forest-700 hover:bg-forest-800 gap-2"
                          onClick={() => {
                            setResolveTarget(r);
                            setResolution("");
                          }}
                        >
                          <CheckCircle2 size={15} aria-hidden="true" />
                          Résoudre
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => {
                            setDismissTarget(r);
                            setDismissReason("");
                          }}
                        >
                          <MessageSquare size={15} aria-hidden="true" />
                          Rejeter
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* Dialog résolution */}
      <Dialog
        open={resolveTarget !== null}
        onOpenChange={(open) => !open && setResolveTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Résoudre le signalement</DialogTitle>
            <DialogDescription>
              Marquez ce signalement comme traité. Le déclarant sera notifié automatiquement.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="resolve-note">Résolution (facultative)</Label>
            <Textarea
              id="resolve-note"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Exemple : annonce retirée et compte averti."
              maxLength={500}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResolveTarget(null)}
              disabled={actionPending}
            >
              Annuler
            </Button>
            <Button
              className="bg-forest-700 hover:bg-forest-800"
              onClick={() => void submitResolve()}
              disabled={actionPending}
            >
              Confirmer la résolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog rejet */}
      <Dialog
        open={dismissTarget !== null}
        onOpenChange={(open) => !open && setDismissTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeter le signalement</DialogTitle>
            <DialogDescription>
              Aucune action n&apos;est nécessaire : le signalement sera archivé après vérification.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="dismiss-note">Note de vérification (facultative)</Label>
            <Textarea
              id="dismiss-note"
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              placeholder="Exemple : échanges vérifiés avec les deux parties, contenu conforme."
              maxLength={500}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDismissTarget(null)}
              disabled={actionPending}
            >
              Annuler
            </Button>
            <Button
              className="bg-forest-700 hover:bg-forest-800"
              onClick={() => void submitDismiss()}
              disabled={actionPending}
            >
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note d'usage */}
      <div className="flex items-start gap-3 rounded-xl border bg-mint-50 p-4">
        <UserIcon className="text-forest-700 shrink-0 mt-0.5" size={18} aria-hidden="true" />
        <p className="text-sm text-forest-800">
          Bonne pratique : vérifiez toujours la cible avant de résoudre un signalement. Les
          décisions sont journalisées et notifiées au membre déclarant.
        </p>
      </div>
    </div>
  );
}
