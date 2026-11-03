"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/constants";
import { useNavigate } from "@/stores/router-store";
import {
  AdminEmptyState,
  AdminPagination,
  AdminStatusBadge,
  AdminTableSkeleton,
  handleAdminError,
} from "./admin-shared";

interface AdminLog {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  createdAt: string;
  admin: string;
}

interface LogsResponse {
  logs: AdminLog[];
  total: number;
  page: number;
  totalPages: number;
}

/** Date + heure (fuseau Africa/Dakar) pour le journal */
function formatDateTime(value: string): string {
  const d = new Date(value);
  const date = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Dakar",
  }).format(d);
  const time = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Dakar",
  }).format(d);
  return `${date} à ${time}`;
}

/** Journal des actions administratives (traçabilité) */
export default function AdminLogs() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<LogsResponse>(`/api/admin/logs?page=${page}`);
      setData(res);
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setLoading(false);
    }
  }, [page, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <AdminTableSkeleton rows={8} />
          ) : !data || data.logs.length === 0 ? (
            <AdminEmptyState
              icon={ScrollText}
              title="Aucune action enregistrée"
              description="Le journal se remplira automatiquement à chaque action sensible."
            />
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Cible</TableHead>
                    <TableHead>Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap">
                        <p className="text-sm">{formatDateTime(l.createdAt)}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(l.createdAt)}</p>
                      </TableCell>
                      <TableCell className="text-sm font-medium whitespace-nowrap">
                        {l.admin}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs font-mono bg-mint-50 text-forest-700 rounded px-1.5 py-0.5 whitespace-nowrap">
                          {l.action}
                        </code>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {l.targetType ? `${l.targetType}:${l.targetId ?? "—"}` : "—"}
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <span
                          title={l.details ?? undefined}
                          className="block text-sm text-muted-foreground truncate"
                        >
                          {l.details ?? "—"}
                        </span>
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

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AdminStatusBadge label="Traçabilité" colorClass="bg-mint-100 text-forest-700" />
        <p>
          Toutes les actions administratives sensibles sont journalisées automatiquement :
          modération, paiements, comptes, contenu et paramètres.
        </p>
      </div>
    </div>
  );
}
