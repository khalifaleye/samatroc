"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  CreditCard,
  Handshake,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import AccountShell from "@/views/account/account-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/stores/router-store";
import { useAuth } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/constants";
import type { NotificationData } from "@/lib/types";
import { cn } from "@/lib/utils";

function notificationIcon(type: string) {
  if (type.startsWith("PROPOSAL")) return Handshake;
  if (type === "MESSAGE") return MessageSquare;
  if (type.startsWith("PAYMENT")) return CreditCard;
  if (type === "LISTING_PUBLISHED" || type === "PROPOSAL_COMPLETED") return CheckCircle2;
  if (type === "LISTING_REFUSED" || type === "PROPOSAL_REFUSED") return XCircle;
  return Bell;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

export default function NotificationsView() {
  const navigate = useRouter((s) => s.navigate);
  const refresh = useAuth((s) => s.refresh);

  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get<{ notifications: NotificationData[]; unreadCount: number }>(
        "/api/notifications"
      );
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await api.post("/api/notifications/read", { all: true });
      await fetchNotifications();
      await refresh();
      toast.success("Toutes les notifications sont marquées comme lues");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible");
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleNotificationClick(n: NotificationData) {
    try {
      if (!n.readAt) {
        await api.post("/api/notifications/read", { ids: [n.id] });
        await refresh();
      }
      if (n.linkView) {
        let params: Record<string, string> = {};
        if (n.linkParams) {
          try {
            params = JSON.parse(n.linkParams) as Record<string, string>;
          } catch {
            params = {};
          }
        }
        navigate(n.linkView, params);
      } else {
        await fetchNotifications();
      }
    } catch {
      // La navigation prime, même si le marquage échoue
      if (n.linkView) {
        navigate(n.linkView);
      }
    }
  }

  const { today, earlier } = useMemo(() => {
    const t: NotificationData[] = [];
    const e: NotificationData[] = [];
    for (const n of notifications) {
      (isToday(new Date(n.createdAt)) ? t : e).push(n);
    }
    return { today: t, earlier: e };
  }, [notifications]);

  function NotificationRow({ n }: { n: NotificationData }) {
    const Icon = notificationIcon(n.type);
    const unread = !n.readAt;
    return (
      <li>
        <button
          type="button"
          onClick={() => handleNotificationClick(n)}
          aria-label={`${n.title}${unread ? " (non lue)" : ""}`}
          className={cn(
            "flex w-full items-start gap-3 rounded-xl p-3.5 text-left transition-colors",
            unread ? "bg-mint-50 hover:bg-mint-100" : "hover:bg-accent"
          )}
        >
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              unread ? "bg-emerald-brand-100 text-emerald-brand-700" : "bg-muted text-muted-foreground"
            )}
          >
            <Icon size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-2">
              <span className={cn("text-sm", unread ? "font-bold text-forest-800" : "font-medium text-foreground")}>
                {n.title}
              </span>
              {unread && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-brand-500" aria-label="Non lue" />
              )}
            </span>
            {n.body && (
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{n.body}</span>
            )}
            <span className="mt-1 block text-[11px] text-muted-foreground/80">{timeAgo(n.createdAt)}</span>
          </span>
        </button>
      </li>
    );
  }

  return (
    <AccountShell
      active="notifications"
      title="Notifications"
      actions={
        <Button
          type="button"
          variant="outline"
          onClick={markAllRead}
          disabled={markingAll || unreadCount === 0}
          className="h-11"
        >
          {markingAll ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-forest-300 border-t-transparent" aria-hidden="true" />
          ) : (
            <CheckCheck size={18} aria-hidden="true" />
          )}
          Tout marquer comme lu
          {unreadCount > 0 && (
            <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-brand-500 px-1 text-[11px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </Button>
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Bell className="text-forest-200" size={40} aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Aucune notification pour le moment. Vous serez informé des propositions, messages et
            mises à jour de vos annonces.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {today.length > 0 && (
            <section aria-label="Notifications du jour">
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Aujourd&apos;hui
              </h2>
              <ul className="space-y-1.5">
                {today.map((n) => (
                  <NotificationRow key={n.id} n={n} />
                ))}
              </ul>
            </section>
          )}
          {earlier.length > 0 && (
            <section aria-label="Notifications antérieures">
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Plus tôt
              </h2>
              <ul className="space-y-1.5">
                {earlier.map((n) => (
                  <NotificationRow key={n.id} n={n} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </AccountShell>
  );
}
