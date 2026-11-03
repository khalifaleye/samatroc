"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, CreditCard, Search, ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { formatFCFA, formatDate, paymentStatusColor, paymentStatusLabel } from "@/lib/constants";
import { useNavigate } from "@/stores/router-store";
import {
  AdminEmptyState,
  AdminPagination,
  AdminStatusBadge,
  AdminTableSkeleton,
  handleAdminError,
  useDebouncedValue,
} from "./admin-shared";

interface AdminPayment {
  reference: string;
  amount: number;
  status: string;
  provider: string;
  method: string | null;
  isTest: boolean;
  phone: string | null;
  createdAt: string;
  paidAt: string | null;
  user: { name: string; email: string } | null;
  listing: { id: string; title: string } | null;
}

interface PaymentsResponse {
  payments: AdminPayment[];
  total: number;
  page: number;
  totalPages: number;
  revenue: number;
}

const STATUS_OPTIONS = ["SUCCESS", "PENDING", "FAILED", "EXPIRED", "REFUNDED"];

const PROVIDER_LABELS: Record<string, string> = {
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
  TEST: "Test",
};

/** Gestion des paiements : frais de publication uniquement, aucun secret exposé */
export default function AdminPayments() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 400);

  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", String(page));
      const res = await api.get<PaymentsResponse>(`/api/admin/payments?${params.toString()}`);
      setData(res);
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, page, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Chiffre d'affaires */}
      <Card className="border-mint-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-forest-800 text-lg">
            <Banknote size={20} aria-hidden="true" />
            Chiffre d&apos;affaires brut
          </CardTitle>
          <CardDescription>
            Frais de publication uniquement. Aucun secret de paiement n&apos;est accessible depuis
            cette interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-extrabold text-forest-800" aria-live="polite">
            {data ? formatFCFA(data.revenue) : "—"}
          </p>
        </CardContent>
      </Card>

      {/* Filtres */}
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
                placeholder="Rechercher une référence..."
                className="pl-9"
                aria-label="Rechercher une référence de paiement"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <SelectTrigger className="md:w-52" aria-label="Filtrer par statut de paiement">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {paymentStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            {data
              ? `${data.total} paiement${data.total > 1 ? "s" : ""} trouvé${data.total > 1 ? "s" : ""}`
              : "Chargement..."}
          </p>
        </CardContent>
      </Card>

      {/* Liste */}
      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <AdminTableSkeleton rows={6} />
          ) : !data || data.payments.length === 0 ? (
            <AdminEmptyState
              icon={CreditCard}
              title="Aucun paiement trouvé"
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
                    <TableHead>Moyen</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead>Payé le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.map((p) => (
                    <TableRow key={p.reference}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs">{p.reference}</span>
                          {p.isTest ? (
                            <AdminStatusBadge
                              label="TEST"
                              colorClass="bg-mango-100 text-mango-700"
                            />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.user ? (
                          <>
                            <p className="text-sm truncate max-w-[150px]">{p.user.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {p.user.email}
                            </p>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                        {p.listing?.title ?? "—"}
                      </TableCell>
                      <TableCell className="font-semibold whitespace-nowrap">
                        {formatFCFA(p.amount)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span>{PROVIDER_LABELS[p.provider] ?? p.provider}</span>
                        {p.method ? (
                          <span className="block text-xs text-muted-foreground">{p.method}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <AdminStatusBadge
                          label={paymentStatusLabel(p.status)}
                          colorClass={paymentStatusColor(p.status)}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(p.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {p.paidAt ? formatDate(p.paidAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <AdminPagination
            page={page}
            totalPages={data?.totalPages ?? 1}
            onChange={setPage}
            className="px-4"
          />
        </CardContent>
      </Card>

      {/* Note de sécurité */}
      <div className="flex items-start gap-3 rounded-xl border bg-mint-50 p-4">
        <ShieldCheck className="text-forest-700 shrink-0 mt-0.5" size={18} aria-hidden="true" />
        <p className="text-sm text-forest-800">
          Sécurité : cette interface n&apos;expose ni clé marchande, ni identifiant de
          prestataire. Les paiements sont confirmés uniquement par webhook signé côté serveur.
        </p>
      </div>
    </div>
  );
}
