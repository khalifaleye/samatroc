"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CreditCard, FlaskConical, Info, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import AccountShell from "@/views/account/account-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  formatDate,
  paymentStatusLabel,
  paymentStatusColor,
} from "@/lib/constants";
import type { PaymentData } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function PaymentsView() {
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get<{ payments: PaymentData[] }>("/api/my/payments");
        if (mounted) setPayments(res.payments);
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

  const totalPaid = useMemo(
    () => payments.filter((p) => p.status === "SUCCESS").reduce((sum, p) => sum + (p.amount ?? 0), 0),
    [payments]
  );

  return (
    <AccountShell active="payments" title="Mes paiements">
      {/* Encart informatif */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-mint-200 bg-mint-100 p-4">
        <Info size={20} className="mt-0.5 shrink-0 text-forest-600" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-forest-700">
          Les paiements correspondent aux frais de publication des annonces (500 FCFA par article).
          Aucun paiement lié à la valeur des objets ne transite par SamaTroc.
        </p>
      </div>

      {/* Total payé */}
      <Card className="mb-5 flex items-center gap-4 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest-700 text-white">
          <ReceiptText size={20} aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">Total payé (paiements réussis)</p>
          <p className="text-xl font-bold text-forest-800">{formatFCFA(totalPaid)}</p>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <CreditCard className="text-forest-200" size={40} aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Aucun paiement pour le moment. Vos transactions de publication apparaîtront ici.
          </p>
        </Card>
      ) : (
        <>
          {/* Tableau (bureau) */}
          <Card className="hidden overflow-hidden p-0 lg:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-mint-50/60 hover:bg-mint-50/60">
                  <TableHead className="text-forest-800">Référence</TableHead>
                  <TableHead className="text-forest-800">Annonce</TableHead>
                  <TableHead className="text-forest-800">Montant</TableHead>
                  <TableHead className="text-forest-800">Prestataire</TableHead>
                  <TableHead className="text-forest-800">Statut</TableHead>
                  <TableHead className="text-forest-800">Dates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => {
                  const image = p.listing?.images?.find((i) => i.isPrimary)?.url ?? p.listing?.images?.[0]?.url;
                  return (
                    <TableRow key={p.reference}>
                      <TableCell className="font-mono text-xs font-medium text-forest-700">
                        {p.reference}
                      </TableCell>
                      <TableCell className="max-w-52">
                        <span className="flex items-center gap-2">
                          {image && (
                            <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-md">
                              <Image src={image} alt="" fill sizes="36px" className="object-cover" />
                            </span>
                          )}
                          <span className="truncate text-sm">
                            {p.listing?.title ?? "—"}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-semibold text-forest-700">
                        {formatFCFA(p.amount)}
                      </TableCell>
                      <TableCell className="text-sm">{p.method ?? p.provider}</TableCell>
                      <TableCell>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge className={cn("border-transparent font-semibold", paymentStatusColor(p.status))}>
                            {paymentStatusLabel(p.status)}
                          </Badge>
                          {p.isTest && (
                            <Badge className="border-transparent bg-mango-100 text-[10px] font-bold text-mango-700">
                              TEST
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(p.createdAt)}
                        {p.paidAt ? (
                          <span className="block">Payé le {formatDate(p.paidAt)}</span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Cartes (mobile) */}
          <ul className="space-y-3 lg:hidden">
            {payments.map((p) => {
              const image = p.listing?.images?.find((i) => i.isPrimary)?.url ?? p.listing?.images?.[0]?.url;
              return (
                <li key={p.reference}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold text-forest-700">{p.reference}</p>
                        <div className="mt-1 flex items-center gap-2">
                          {image && (
                            <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-md">
                              <Image src={image} alt="" fill sizes="36px" className="object-cover" />
                            </span>
                          )}
                          <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                            {p.listing?.title ?? "—"}
                          </p>
                        </div>
                      </div>
                      <p className="shrink-0 font-bold text-forest-700">{formatFCFA(p.amount)}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge className={cn("border-transparent font-semibold", paymentStatusColor(p.status))}>
                        {paymentStatusLabel(p.status)}
                      </Badge>
                      {p.isTest && (
                        <Badge className="gap-1 border-transparent bg-mango-100 text-[10px] font-bold text-mango-700">
                          <FlaskConical size={10} aria-hidden="true" />
                          TEST
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{p.method ?? p.provider}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Créé le {formatDate(p.createdAt)}
                      {p.paidAt ? ` • payé le ${formatDate(p.paidAt)}` : ""}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </AccountShell>
  );
}
