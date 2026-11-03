"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  Eye,
  ImageOff,
  MoreHorizontal,
  Pencil,
  Search,
  Sparkles,
  Star,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate, listingStatusColor, listingStatusLabel } from "@/lib/constants";
import { useNavigate } from "@/stores/router-store";
import type { ListingSummary } from "@/lib/types";
import {
  AdminEmptyState,
  AdminPagination,
  AdminStatusBadge,
  AdminTableSkeleton,
  handleAdminError,
  useDebouncedValue,
} from "./admin-shared";

type AdminListing = ListingSummary & {
  owner: ListingSummary["owner"] & { email: string };
};

interface ListingsResponse {
  listings: AdminListing[];
  total: number;
  page: number;
  totalPages: number;
}

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
}

const STATUS_OPTIONS = [
  { value: "PENDING_MODERATION", label: "En modération" },
  { value: "PUBLISHED", label: "Publiée" },
  { value: "REFUSED", label: "Refusée" },
  { value: "DEACTIVATED", label: "Désactivée" },
  { value: "EXCHANGED", label: "Échangée" },
  { value: "PENDING_PAYMENT", label: "En attente de paiement" },
  { value: "DRAFT", label: "Brouillon" },
];

const EDIT_CONSTRAINTS = {
  title: { min: 5, max: 100 },
  description: { min: 20, max: 3000 },
  city: { max: 60 },
  wantedText: { max: 200 },
};

/** Gestion des annonces (modération, édition, suppression) */
export default function AdminListings() {
  const navigate = useNavigate();

  // Filtres + pagination
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 400);

  // Données
  const [data, setData] = useState<ListingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingModeration, setPendingModeration] = useState(0);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [actionPending, setActionPending] = useState(false);

  // Dialogs
  const [refuseTarget, setRefuseTarget] = useState<AdminListing | null>(null);
  const [refuseReason, setRefuseReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminListing | null>(null);
  const [editTarget, setEditTarget] = useState<AdminListing | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    city: "",
    wantedText: "",
    description: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      params.set("page", String(page));
      const res = await api.get<ListingsResponse>(`/api/admin/listings?${params.toString()}`);
      setData(res);
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, categoryFilter, page, navigate]);

  // Compteur d'annonces en modération + référentiel catégories
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [pending, cats] = await Promise.all([
          api.get<ListingsResponse>("/api/admin/listings?status=PENDING_MODERATION&page=1"),
          api.get<{ categories: CategoryItem[] }>("/api/categories"),
        ]);
        setPendingModeration(pending.total);
        setCategories(cats.categories);
      } catch (error) {
        handleAdminError(error, navigate);
      }
    };
    void loadMeta();
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, categoryFilter]);

  const refreshMeta = async () => {
    try {
      const pending = await api.get<ListingsResponse>(
        "/api/admin/listings?status=PENDING_MODERATION&page=1"
      );
      setPendingModeration(pending.total);
    } catch {
      // silencieux : le compteur est secondaire
    }
  };

  const afterAction = () => {
    void load();
    void refreshMeta();
  };

  const publish = async (listing: AdminListing) => {
    setActionPending(true);
    try {
      const res = await api.patch<{ message?: string }>(`/api/admin/listings/${listing.id}`, {
        action: "publish",
      });
      toast.success(res.message ?? "Annonce validée et publiée");
      afterAction();
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setActionPending(false);
    }
  };

  const submitRefuse = async () => {
    if (!refuseTarget || !refuseReason.trim()) return;
    setActionPending(true);
    try {
      const res = await api.patch<{ message?: string }>(`/api/admin/listings/${refuseTarget.id}`, {
        action: "refuse",
        reason: refuseReason.trim(),
      });
      toast.success(res.message ?? "Annonce refusée");
      setRefuseTarget(null);
      setRefuseReason("");
      afterAction();
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setActionPending(false);
    }
  };

  const toggleFeature = async (listing: AdminListing) => {
    setActionPending(true);
    try {
      const res = await api.patch<{ message?: string }>(`/api/admin/listings/${listing.id}`, {
        action: listing.featured ? "unfeature" : "feature",
      });
      toast.success(res.message ?? (listing.featured ? "Mise en avant retirée" : "Annonce mise en avant"));
      afterAction();
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setActionPending(false);
    }
  };

  /** Édition : action feature/unfeature alignée sur l'état courant pour ne pas modifier la mise en avant */
  const submitEdit = async () => {
    if (!editTarget) return;
    setActionPending(true);
    try {
      await api.patch(`/api/admin/listings/${editTarget.id}`, {
        action: editTarget.featured ? "feature" : "unfeature",
        edits: {
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          city: editForm.city.trim(),
          wantedText: editForm.wantedText.trim(),
        },
      });
      toast.success("Annonce modifiée");
      setEditTarget(null);
      afterAction();
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setActionPending(false);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setActionPending(true);
    try {
      await api.del(`/api/admin/listings/${deleteTarget.id}`);
      toast.success("Annonce supprimée");
      setDeleteTarget(null);
      afterAction();
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setActionPending(false);
    }
  };

  const openEdit = (l: AdminListing) => {
    setEditTarget(l);
    setEditForm({
      title: l.title,
      city: l.city,
      wantedText: l.wantedText ?? "",
      description: l.description ?? "",
    });
  };

  const editValid =
    editForm.title.trim().length >= EDIT_CONSTRAINTS.title.min &&
    editForm.title.trim().length <= EDIT_CONSTRAINTS.title.max &&
    editForm.description.trim().length >= EDIT_CONSTRAINTS.description.min &&
    editForm.description.trim().length <= EDIT_CONSTRAINTS.description.max &&
    editForm.wantedText.trim().length <= EDIT_CONSTRAINTS.wantedText.max &&
    editForm.city.trim().length <= EDIT_CONSTRAINTS.city.max;

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      {/* Encart modération */}
      {pendingModeration > 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-mango-200 bg-mango-50 p-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mango-100 text-mango-600">
              <Sparkles size={20} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-mango-700">
              {pendingModeration} annonce{pendingModeration > 1 ? "s" : ""} en attente de
              modération. Vérifiez-les avant publication.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-mango-500 hover:bg-mango-600 text-white shrink-0"
            onClick={() => {
              setStatusFilter("PENDING_MODERATION");
              setPage(1);
            }}
          >
            Examiner maintenant
          </Button>
        </div>
      ) : null}

      {/* Barre de filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Titre, description, référence..."
                className="pl-9"
                aria-label="Rechercher une annonce"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <SelectTrigger className="md:w-52" aria-label="Filtrer par statut">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v)}>
              <SelectTrigger className="md:w-52" aria-label="Filtrer par catégorie">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            {data
              ? `${data.total} annonce${data.total > 1 ? "s" : ""} trouvée${data.total > 1 ? "s" : ""}`
              : "Chargement..."}
          </p>
        </CardContent>
      </Card>

      {/* Liste */}
      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <AdminTableSkeleton rows={6} />
          ) : !data || data.listings.length === 0 ? (
            <AdminEmptyState
              icon={Search}
              title="Aucune annonce trouvée"
              description="Ajustez votre recherche ou vos filtres pour afficher des annonces."
            />
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Annonce</TableHead>
                    <TableHead>Propriétaire</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-center">Vues</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.listings.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-mint-50 border border-mint-100">
                            {l.images?.[0]?.url ? (
                              <Image
                                src={l.images[0].url}
                                alt={`Photo de ${l.title}`}
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-mint-200">
                                <ImageOff size={18} aria-hidden="true" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-sm truncate max-w-[220px]">
                                {l.title}
                              </p>
                              {l.featured ? (
                                <Star
                                  size={14}
                                  className="text-mango-500 fill-mango-400 shrink-0"
                                  aria-label="Mise en avant"
                                />
                              ) : null}
                            </div>
                            <p className="text-xs font-mono text-muted-foreground">{l.reference}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm truncate max-w-[140px]">
                          {l.owner.firstName} {l.owner.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                          {l.owner.email}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {l.category?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.city}</TableCell>
                      <TableCell>
                        <AdminStatusBadge
                          label={listingStatusLabel(l.status)}
                          colorClass={listingStatusColor(l.status)}
                        />
                      </TableCell>
                      <TableCell className="text-center text-sm">{l.viewsCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(l.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              aria-label={`Actions pour l'annonce ${l.title}`}
                            >
                              <MoreHorizontal size={18} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Modération</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate("listing", { id: l.id })}>
                              <Eye size={15} aria-hidden="true" />
                              Voir la page publique
                            </DropdownMenuItem>
                            {(l.status === "PENDING_MODERATION" || l.status === "REFUSED") && (
                              <DropdownMenuItem
                                onClick={() => void publish(l)}
                                disabled={actionPending}
                              >
                                <CheckCircle2 size={15} aria-hidden="true" />
                                Valider et publier
                              </DropdownMenuItem>
                            )}
                            {l.status !== "REFUSED" && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setRefuseTarget(l);
                                  setRefuseReason("");
                                }}
                              >
                                <XCircle size={15} aria-hidden="true" />
                                Refuser
                              </DropdownMenuItem>
                            )}
                            {l.featured ? (
                              <DropdownMenuItem
                                onClick={() => void toggleFeature(l)}
                                disabled={actionPending}
                              >
                                <Star size={15} aria-hidden="true" />
                                Retirer la une
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => void toggleFeature(l)}
                                disabled={actionPending}
                              >
                                <Star size={15} aria-hidden="true" />
                                Mettre en avant
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openEdit(l)}>
                              <Pencil size={15} aria-hidden="true" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(l)}
                              className="text-red-600 focus:text-red-700"
                            >
                              <Trash2 size={15} aria-hidden="true" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <AdminPagination
            page={page}
            totalPages={totalPages}
            onChange={setPage}
            className="px-4"
          />
        </CardContent>
      </Card>

      {/* Dialog refus avec motif obligatoire */}
      <Dialog open={refuseTarget !== null} onOpenChange={(open) => !open && setRefuseTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Refuser l'annonce</DialogTitle>
            <DialogDescription>
              « {refuseTarget?.title} » ne sera plus visible et le propriétaire recevra une
              notification avec le motif.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="refuse-reason">Motif du refus (obligatoire)</Label>
            <Textarea
              id="refuse-reason"
              value={refuseReason}
              onChange={(e) => setRefuseReason(e.target.value)}
              placeholder="Exemple : les photos ne correspondent pas à l'objet décrit."
              maxLength={500}
              rows={4}
            />
            {!refuseReason.trim() ? (
              <p className="text-xs text-red-600">Un motif est requis pour refuser une annonce.</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefuseTarget(null)} disabled={actionPending}>
              Annuler
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void submitRefuse()}
              disabled={actionPending || !refuseReason.trim()}
            >
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog édition administrative */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle>Modifier l'annonce</DialogTitle>
            <DialogDescription>
              Correction administrative. Le statut et la mise en avant de l'annonce ne sont pas
              modifiés.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Titre ({EDIT_CONSTRAINTS.title.min} à {EDIT_CONSTRAINTS.title.max} caractères)</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                maxLength={EDIT_CONSTRAINTS.title.max}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-city">Ville</Label>
              <Input
                id="edit-city"
                value={editForm.city}
                onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                maxLength={EDIT_CONSTRAINTS.city.max}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-wanted">Article recherché</Label>
              <Input
                id="edit-wanted"
                value={editForm.wantedText}
                onChange={(e) => setEditForm((f) => ({ ...f, wantedText: e.target.value }))}
                maxLength={EDIT_CONSTRAINTS.wantedText.max}
                placeholder="Contre quoi ?"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">
                Description ({EDIT_CONSTRAINTS.description.min} caractères minimum)
              </Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                maxLength={EDIT_CONSTRAINTS.description.max}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                {editForm.description.length} / {EDIT_CONSTRAINTS.description.max} caractères
              </p>
            </div>
            {!editValid ? (
              <p className="text-xs text-mango-700">
                Le titre doit contenir au moins {EDIT_CONSTRAINTS.title.min} caractères et la
                description au moins {EDIT_CONSTRAINTS.description.min}.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={actionPending}>
              Annuler
            </Button>
            <Button
              className="bg-forest-700 hover:bg-forest-800"
              onClick={() => void submitEdit()}
              disabled={actionPending || !editValid}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmation suppression */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette annonce ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleteTarget?.title} » sera définitivement supprimée. Cette action est
              irréversible et sera tracée dans le journal administratif.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void submitDelete();
              }}
              disabled={actionPending}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
