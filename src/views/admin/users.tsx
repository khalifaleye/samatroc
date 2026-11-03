"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  MoreHorizontal,
  Pencil,
  Search,
  Shield,
  UserCheck,
  UserX,
  Users,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate, formatFCFA, formatPhoneSN, paymentStatusColor, paymentStatusLabel, listingStatusColor, listingStatusLabel } from "@/lib/constants";
import { useNavigate } from "@/stores/router-store";
import { useAuth } from "@/stores/auth-store";
import {
  AdminEmptyState,
  AdminPagination,
  AdminStatusBadge,
  AdminTableSkeleton,
  InitialsAvatar,
  handleAdminError,
  useDebouncedValue,
} from "./admin-shared";

interface AdminUserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  city: string | null;
  role: string;
  status: string;
  emailVerified: boolean;
  isDemo: boolean;
  createdAt: string;
  listingsCount: number;
}

interface AdminUserDetail extends AdminUserRow {
  bio: string | null;
}

interface AdminUserDetailResponse {
  user: AdminUserDetail;
  listings: { id: string; title: string; status: string; createdAt: string }[];
  payments: { reference: string; amount: number; status: string; provider: string; createdAt: string }[];
  proposalsCount: number;
  reportsAgainst: number;
}

interface UsersResponse {
  users: AdminUserRow[];
  total: number;
  page: number;
  totalPages: number;
}

const ROLE_META: Record<string, { label: string; className: string }> = {
  SUPER_ADMIN: { label: "Super admin", className: "bg-forest-800 text-white" },
  ADMIN: { label: "Admin", className: "bg-mint-100 text-forest-700" },
  USER: { label: "Membre", className: "bg-gray-100 text-gray-700" },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Actif", className: "bg-mint-100 text-forest-700" },
  SUSPENDED: { label: "Suspendu", className: "bg-red-100 text-red-700" },
};

/** Gestion des utilisateurs (back-office) */
export default function AdminUsers() {
  const navigate = useNavigate();
  const me = useAuth((s) => s.user);
  const isSuperAdmin = me?.role === "SUPER_ADMIN";

  // Filtres + pagination
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 400);

  // Données
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);

  // Dialogs
  const [detailUser, setDetailUser] = useState<AdminUserRow | null>(null);
  const [detail, setDetail] = useState<AdminUserDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", phone: "", city: "" });
  const [suspendTarget, setSuspendTarget] = useState<AdminUserRow | null>(null);
  const [roleTarget, setRoleTarget] = useState<AdminUserRow | null>(null);
  const [newRole, setNewRole] = useState("USER");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (roleFilter !== "all") params.set("role", roleFilter);
      params.set("page", String(page));
      const res = await api.get<UsersResponse>(`/api/admin/users?${params.toString()}`);
      setData(res);
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, roleFilter, page, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  // Réinitialise la page quand un filtre change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, roleFilter]);

  const openDetail = async (u: AdminUserRow) => {
    setDetailUser(u);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.get<AdminUserDetailResponse>(`/api/admin/users/${u.id}`);
      setDetail(res);
    } catch (error) {
      handleAdminError(error, navigate);
      setDetailUser(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const openEdit = (u: AdminUserRow) => {
    setEditUser(u);
    setEditForm({
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone ?? "",
      city: u.city ?? "",
    });
  };

  const submitEdit = async () => {
    if (!editUser) return;
    setActionPending(true);
    try {
      await api.patch(`/api/admin/users/${editUser.id}`, {
        action: "edit",
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone,
        city: editForm.city,
      });
      toast.success("Informations mises à jour");
      setEditUser(null);
      void load();
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setActionPending(false);
    }
  };

  const toggleSuspension = async () => {
    if (!suspendTarget) return;
    const suspending = suspendTarget.status === "ACTIVE";
    setActionPending(true);
    try {
      const res = await api.patch<{ message?: string }>(`/api/admin/users/${suspendTarget.id}`, {
        action: suspending ? "suspend" : "reactivate",
      });
      toast.success(res.message ?? (suspending ? "Compte suspendu" : "Compte réactivé"));
      setSuspendTarget(null);
      void load();
      if (detailUser?.id === suspendTarget.id) {
        setDetailUser(null);
      }
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setActionPending(false);
    }
  };

  const submitRole = async () => {
    if (!roleTarget) return;
    setActionPending(true);
    try {
      const res = await api.patch<{ message?: string }>(`/api/admin/users/${roleTarget.id}`, {
        action: "setRole",
        role: newRole,
      });
      toast.success(res.message ?? "Rôle mis à jour");
      setRoleTarget(null);
      void load();
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setActionPending(false);
    }
  };

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
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
                placeholder="Nom, email, téléphone..."
                className="pl-9"
                aria-label="Rechercher un utilisateur"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v)}
            >
              <SelectTrigger className="md:w-44" aria-label="Filtrer par statut">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="ACTIVE">Actif</SelectItem>
                <SelectItem value="SUSPENDED">Suspendu</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v)}>
              <SelectTrigger className="md:w-44" aria-label="Filtrer par rôle">
                <SelectValue placeholder="Rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="USER">Membre</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            {data ? `${data.total} utilisateur${data.total > 1 ? "s" : ""} trouvé${data.total > 1 ? "s" : ""}` : "Chargement..."}
          </p>
        </CardContent>
      </Card>

      {/* Liste */}
      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <AdminTableSkeleton rows={6} />
          ) : !data || data.users.length === 0 ? (
            <AdminEmptyState
              icon={Users}
              title="Aucun utilisateur trouvé"
              description="Ajustez votre recherche ou vos filtres pour afficher des comptes."
            />
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-center">Annonces</TableHead>
                    <TableHead>Inscription</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.map((u) => {
                    const roleMeta = ROLE_META[u.role] ?? ROLE_META.USER;
                    const statusMeta = STATUS_META[u.status] ?? STATUS_META.ACTIVE;
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <InitialsAvatar firstName={u.firstName} lastName={u.lastName} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium text-sm truncate">
                                  {u.firstName} {u.lastName}
                                </p>
                                {u.isDemo ? (
                                  <AdminStatusBadge
                                    label="Démo"
                                    colorClass="bg-mango-100 text-mango-700"
                                  />
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.city ?? "—"}
                        </TableCell>
                        <TableCell>
                          <AdminStatusBadge label={roleMeta.label} colorClass={roleMeta.className} />
                        </TableCell>
                        <TableCell>
                          <AdminStatusBadge
                            label={statusMeta.label}
                            colorClass={statusMeta.className}
                          />
                        </TableCell>
                        <TableCell className="text-center text-sm">{u.listingsCount}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(u.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                aria-label={`Actions pour ${u.firstName} ${u.lastName}`}
                              >
                                <MoreHorizontal size={18} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuLabel>Actions utilisateur</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => void openDetail(u)}>
                                <Eye size={15} aria-hidden="true" />
                                Voir détails
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(u)}>
                                <Pencil size={15} aria-hidden="true" />
                                Modifier
                              </DropdownMenuItem>
                              {u.status === "ACTIVE" ? (
                                <DropdownMenuItem onClick={() => setSuspendTarget(u)}>
                                  <UserX size={15} aria-hidden="true" />
                                  Suspendre
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => setSuspendTarget(u)}>
                                  <UserCheck size={15} aria-hidden="true" />
                                  Réactiver
                                </DropdownMenuItem>
                              )}
                              {isSuperAdmin && u.role !== "SUPER_ADMIN" ? (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setRoleTarget(u);
                                    setNewRole(u.role === "ADMIN" ? "ADMIN" : "USER");
                                  }}
                                >
                                  <Shield size={15} aria-hidden="true" />
                                  Changer le rôle
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      {/* Dialog détails utilisateur */}
      <Dialog open={detailUser !== null} onOpenChange={(open) => !open && setDetailUser(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle>Détails du compte</DialogTitle>
            <DialogDescription>
              Profil complet et historique de l'utilisateur sélectionné.
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <AdminTableSkeleton rows={4} />
          ) : (
            <div className="space-y-5">
              {/* Identité */}
              <div className="flex items-center gap-3">
                <InitialsAvatar
                  firstName={detail.user.firstName}
                  lastName={detail.user.lastName}
                  className="h-12 w-12 text-base"
                />
                <div className="min-w-0">
                  <p className="font-bold text-forest-800">
                    {detail.user.firstName} {detail.user.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">{detail.user.email}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <AdminStatusBadge
                      label={(ROLE_META[detail.user.role] ?? ROLE_META.USER).label}
                      colorClass={(ROLE_META[detail.user.role] ?? ROLE_META.USER).className}
                    />
                    <AdminStatusBadge
                      label={(STATUS_META[detail.user.status] ?? STATUS_META.ACTIVE).label}
                      colorClass={(STATUS_META[detail.user.status] ?? STATUS_META.ACTIVE).className}
                    />
                    {detail.user.emailVerified ? (
                      <AdminStatusBadge label="Email vérifié" colorClass="bg-mint-100 text-forest-700" />
                    ) : (
                      <AdminStatusBadge label="Email non vérifié" colorClass="bg-mango-100 text-mango-700" />
                    )}
                    {detail.user.isDemo ? (
                      <AdminStatusBadge label="Démo" colorClass="bg-mango-100 text-mango-700" />
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Informations */}
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="flex justify-between sm:block gap-2">
                  <dt className="text-muted-foreground text-xs">Téléphone</dt>
                  <dd>{formatPhoneSN(detail.user.phone)}</dd>
                </div>
                <div className="flex justify-between sm:block gap-2">
                  <dt className="text-muted-foreground text-xs">Ville</dt>
                  <dd>{detail.user.city ?? "—"}</dd>
                </div>
                <div className="flex justify-between sm:block gap-2">
                  <dt className="text-muted-foreground text-xs">Inscription</dt>
                  <dd>{formatDate(detail.user.createdAt)}</dd>
                </div>
                <div className="flex justify-between sm:block gap-2">
                  <dt className="text-muted-foreground text-xs">Propositions envoyées</dt>
                  <dd>{detail.proposalsCount}</dd>
                </div>
                <div className="flex justify-between sm:block gap-2">
                  <dt className="text-muted-foreground text-xs">Signalements visant ce compte</dt>
                  <dd>{detail.reportsAgainst}</dd>
                </div>
              </dl>

              {detail.user.bio ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Biographie</p>
                  <p className="text-sm bg-mint-50 rounded-lg p-3 text-forest-800">
                    {detail.user.bio}
                  </p>
                </div>
              ) : null}

              {/* Annonces */}
              <div>
                <p className="text-sm font-semibold text-forest-800 mb-2">
                  Ses annonces ({detail.listings.length})
                </p>
                {detail.listings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune annonce déposée.</p>
                ) : (
                  <ul className="divide-y border rounded-lg max-h-48 overflow-y-auto custom-scrollbar">
                    {detail.listings.map((l) => (
                      <li key={l.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                        <span className="flex-1 min-w-0 truncate">{l.title}</span>
                        <AdminStatusBadge
                          label={listingStatusLabel(l.status)}
                          colorClass={listingStatusColor(l.status)}
                        />
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDate(l.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Paiements */}
              <div>
                <p className="text-sm font-semibold text-forest-800 mb-2">
                  Ses paiements ({detail.payments.length})
                </p>
                {detail.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun paiement enregistré.</p>
                ) : (
                  <ul className="divide-y border rounded-lg max-h-48 overflow-y-auto custom-scrollbar">
                    {detail.payments.map((p) => (
                      <li key={p.reference} className="px-3 py-2 flex items-center gap-2 text-sm">
                        <code className="font-mono text-xs">{p.reference}</code>
                        <span className="font-semibold">{formatFCFA(p.amount)}</span>
                        <AdminStatusBadge
                          label={paymentStatusLabel(p.status)}
                          colorClass={paymentStatusColor(p.status)}
                        />
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                          {formatDate(p.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog modification */}
      <Dialog open={editUser !== null} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>
              Mettez à jour les informations du compte de {editUser?.firstName} {editUser?.lastName}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-firstname">Prénom</Label>
              <Input
                id="edit-firstname"
                value={editForm.firstName}
                onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                maxLength={60}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-lastname">Nom</Label>
              <Input
                id="edit-lastname"
                value={editForm.lastName}
                onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                maxLength={60}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Téléphone</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+221 77 123 45 67"
                maxLength={20}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-city">Ville</Label>
              <Input
                id="edit-city"
                value={editForm.city}
                onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                maxLength={60}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={actionPending}>
              Annuler
            </Button>
            <Button
              className="bg-forest-700 hover:bg-forest-800"
              onClick={() => void submitEdit()}
              disabled={actionPending || !editForm.firstName.trim() || !editForm.lastName.trim()}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmation suspension / réactivation */}
      <AlertDialog
        open={suspendTarget !== null}
        onOpenChange={(open) => !open && setSuspendTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {suspendTarget?.status === "ACTIVE"
                ? "Suspendre ce compte ?"
                : "Réactiver ce compte ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendTarget?.status === "ACTIVE"
                ? `L'utilisateur ${suspendTarget?.firstName} ${suspendTarget?.lastName} ne pourra plus se connecter ni publier d'annonces tant que son compte est suspendu.`
                : `L'utilisateur ${suspendTarget?.firstName} ${suspendTarget?.lastName} retrouvera l'accès complet à son compte.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void toggleSuspension();
              }}
              disabled={actionPending}
              className={
                suspendTarget?.status === "ACTIVE"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-forest-700 hover:bg-forest-800"
              }
            >
              {suspendTarget?.status === "ACTIVE" ? "Suspendre" : "Réactiver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog changement de rôle */}
      <Dialog open={roleTarget !== null} onOpenChange={(open) => !open && setRoleTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Changer le rôle</DialogTitle>
            <DialogDescription>
              Définissez le niveau d'accès de {roleTarget?.firstName} {roleTarget?.lastName}.
              Seul un super administrateur peut effectuer cette action.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="role-select">Nouveau rôle</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger id="role-select">
                <SelectValue placeholder="Choisir un rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">Membre</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleTarget(null)} disabled={actionPending}>
              Annuler
            </Button>
            <Button
              className="bg-forest-700 hover:bg-forest-800"
              onClick={() => void submitRole()}
              disabled={actionPending}
            >
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
