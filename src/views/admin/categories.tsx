"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
  Tags,
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { CategoryIcon, CATEGORY_ICON_NAMES } from "@/components/category-icon";
import { useNavigate } from "@/stores/router-store";
import {
  AdminEmptyState,
  AdminTableSkeleton,
  handleAdminError,
} from "./admin-shared";

interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  parentId: string | null;
  listingsCount: number;
  childrenCount: number;
}

interface CategoryForm {
  name: string;
  icon: string;
  color: string;
  sortOrder: string;
}

const EMPTY_FORM: CategoryForm = { name: "", icon: "package", color: "#0e5c3d", sortOrder: "0" };

/** Gestion des catégories : création, édition, activation, ordre, suppression */
export default function AdminCategories() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);

  // Dialog création / édition
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);

  // Dialog suppression
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ categories: AdminCategory[] }>("/api/admin/categories");
      setCategories([...res.categories].sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      name: "",
      icon: "package",
      color: "#0e5c3d",
      sortOrder: String(categories.length),
    });
    setFormOpen(true);
  };

  const openEdit = (c: AdminCategory) => {
    setEditingId(c.id);
    setForm({ name: c.name, icon: c.icon, color: c.color, sortOrder: String(c.sortOrder) });
    setFormOpen(true);
  };

  const submitForm = async () => {
    if (form.name.trim().length < 2) {
      toast.error("Le nom doit contenir au moins 2 caractères");
      return;
    }
    setActionPending(true);
    try {
      const payload = {
        name: form.name.trim(),
        icon: form.icon,
        color: form.color,
        sortOrder: parseInt(form.sortOrder, 10) || 0,
      };
      if (editingId) {
        await api.patch(`/api/admin/categories/${editingId}`, payload);
        toast.success("Catégorie mise à jour");
      } else {
        await api.post("/api/admin/categories", payload);
        toast.success("Catégorie créée");
      }
      setFormOpen(false);
      void load();
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setActionPending(false);
    }
  };

  const toggleActive = async (c: AdminCategory, isActive: boolean) => {
    try {
      await api.patch(`/api/admin/categories/${c.id}`, { isActive });
      toast.success(isActive ? "Catégorie activée" : "Catégorie désactivée");
      void load();
    } catch (error) {
      handleAdminError(error, navigate);
    }
  };

  /** Réordonnancement : échange la catégorie avec sa voisine puis renvoie l'ordre complet */
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    const ids = next.map((c) => c.id);
    // Mise à jour optimiste de l'affichage
    setCategories(next.map((c, i) => ({ ...c, sortOrder: i })));
    try {
      await api.post("/api/admin/categories/reorder", { ids });
      toast.success("Ordre mis à jour");
    } catch (error) {
      handleAdminError(error, navigate);
      void load();
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setActionPending(true);
    try {
      await api.del(`/api/admin/categories/${deleteTarget.id}`);
      toast.success("Catégorie supprimée");
      setDeleteTarget(null);
      void load();
    } catch (error) {
      // 409 : annonces rattachées → le message serveur invite à désactiver la catégorie
      handleAdminError(error, navigate);
    } finally {
      setActionPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* En-tête actions */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm text-muted-foreground flex-1">
          L'ordre définit l'affichage des catégories sur le site. Désactivez une catégorie pour la
          masquer sans supprimer son historique.
        </p>
        <Button className="bg-forest-700 hover:bg-forest-800 gap-2 shrink-0" onClick={openCreate}>
          <Plus size={16} aria-hidden="true" />
          Nouvelle catégorie
        </Button>
      </div>

      {/* Liste */}
      <Card>
        <CardContent className="p-0">
          {loading && categories.length === 0 ? (
            <AdminTableSkeleton rows={6} />
          ) : categories.length === 0 ? (
            <AdminEmptyState
              icon={Tags}
              title="Aucune catégorie"
              description="Créez votre première catégorie pour organiser les annonces."
            />
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Ordre</TableHead>
                    <TableHead>Aperçu</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className="text-center">Annonces</TableHead>
                    <TableHead>Sous-catégories</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c, index) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={index === 0 || actionPending}
                            onClick={() => void move(index, -1)}
                            aria-label={`Monter ${c.name}`}
                          >
                            <ChevronUp size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={index === categories.length - 1 || actionPending}
                            onClick={() => void move(index, 1)}
                            aria-label={`Descendre ${c.name}`}
                          >
                            <ChevronDown size={14} />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                            style={{ backgroundColor: `${c.color}14`, borderColor: `${c.color}33` }}
                          >
                            <CategoryIcon icon={c.icon} color={c.color} size={20} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm">{c.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.parentId ? "Sous-catégorie" : "Catégorie racine"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs font-mono bg-mint-50 text-forest-700 rounded px-1.5 py-0.5">
                          {c.slug}
                        </code>
                      </TableCell>
                      <TableCell className="text-center text-sm">{c.listingsCount}</TableCell>
                      <TableCell className="text-center text-sm">{c.childrenCount}</TableCell>
                      <TableCell>
                        <Switch
                          checked={c.isActive}
                          onCheckedChange={(checked) => void toggleActive(c, checked)}
                          aria-label={`Activer la catégorie ${c.name}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(c)}
                            aria-label={`Modifier ${c.name}`}
                          >
                            <Pencil size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                            onClick={() => setDeleteTarget(c)}
                            aria-label={`Supprimer ${c.name}`}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog création / édition */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Mettez à jour le nom, l'icône, la couleur ou l'ordre d'affichage."
                : "La catégorie sera visible immédiatement dans le formulaire de publication."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="cat-name">Nom</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Exemple : Électroménager"
                maxLength={60}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cat-icon">Icône</Label>
              <Select value={form.icon} onValueChange={(v) => setForm((f) => ({ ...f, icon: v }))}>
                <SelectTrigger id="cat-icon">
                  <SelectValue placeholder="Choisir une icône" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {CATEGORY_ICON_NAMES.map((name) => (
                    <SelectItem key={name} value={name}>
                      <span className="flex items-center gap-2">
                        <CategoryIcon icon={name} color={form.color} size={16} />
                        {name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cat-color">Couleur</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="cat-color"
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="h-10 w-14 p-1 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-muted-foreground">{form.color}</span>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cat-order">Ordre d&apos;affichage</Label>
                <Input
                  id="cat-order"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
              </div>
            </div>
            {/* Aperçu en conditions réelles */}
            <div className="flex items-center gap-3 rounded-lg border bg-mint-50/60 p-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full border"
                style={{ backgroundColor: `${form.color}14`, borderColor: `${form.color}33` }}
              >
                <CategoryIcon icon={form.icon} color={form.color} size={20} />
              </div>
              <p className="text-sm font-medium text-forest-800">
                {form.name.trim() || "Aperçu de la catégorie"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={actionPending}>
              Annuler
            </Button>
            <Button
              className="bg-forest-700 hover:bg-forest-800"
              onClick={() => void submitForm()}
              disabled={actionPending || form.name.trim().length < 2}
            >
              {editingId ? "Enregistrer" : "Créer"}
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
            <AlertDialogTitle>Supprimer la catégorie « {deleteTarget?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Si des annonces utilisent encore cette catégorie, la
              suppression sera refusée : il faudra alors la désactiver plutôt que la supprimer.
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
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
