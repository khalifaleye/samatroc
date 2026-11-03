"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Ban,
  Flag,
  Info,
  Loader2,
  MessageSquare,
  MoreVertical,
  SendHorizonal,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import AccountShell from "@/views/account/account-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "@/stores/router-store";
import { useAuth } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { timeAgo, reportReasonLabel, REPORT_REASONS } from "@/lib/constants";
import type { ConversationData, MessageData } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ConversationDetail {
  conversation: {
    id: string;
    listing: { id: string; title: string; images: { url: string; isPrimary: boolean }[] } | null;
    other: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
    blocked: boolean;
    blockedByOther?: boolean;
  };
  messages: MessageData[];
}

interface ReportForm {
  reason: string;
  details: string;
}

const timeFormatter = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" });

interface MessagesViewProps {
  conversationId?: string | null;
}

export default function MessagesView({ conversationId }: MessagesViewProps) {
  const navigate = useRouter((s) => s.navigate);
  const refresh = useAuth((s) => s.refresh);
  const myId = useAuth((s) => s.user?.id);

  // ---------- Liste des conversations ----------
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // ---------- Conversation ouverte ----------
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");

  // ---------- Signalement / blocage ----------
  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState<ReportForm>({ reason: "AUTRE", details: "" });
  const [reporting, setReporting] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  // ---------- Chargement de la liste (polling 10 s) ----------
  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get<{ conversations: ConversationData[] }>("/api/conversations");
      setConversations(res.conversations);
    } catch {
      // Silencieux : le polling réessaiera
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConversations();
    const timer = setInterval(() => void fetchConversations(), 10000);
    return () => clearInterval(timer);
  }, [fetchConversations]);

  // ---------- Défilement en bas ----------
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  // ---------- Chargement de la conversation (polling 4 s) ----------
  const fetchConversation = useCallback(
    async (id: string, markRead = false) => {
      try {
        const res = await api.get<ConversationDetail>(`/api/conversations/${id}`);
        setDetail(res);
        setChatError(null);
        if (markRead) {
          try {
            await api.post(`/api/conversations/${id}/read`);
            await refresh();
          } catch {
            // Non bloquant
          }
        }
        lastCountRef.current = res.messages.length;
        scrollToBottom();
      } catch (error) {
        setChatError(error instanceof Error ? error.message : "Conversation indisponible");
      } finally {
        setChatLoading(false);
      }
    },
    [refresh, scrollToBottom]
  );

  useEffect(() => {
    if (!conversationId) {
      setDetail(null);
      setChatError(null);
      return;
    }
    setChatLoading(true);
    lastCountRef.current = 0;
    void fetchConversation(conversationId, true);

    const timer = setInterval(() => void fetchConversation(conversationId), 4000);
    return () => clearInterval(timer);
  }, [conversationId, fetchConversation]);

  // ---------- Envoi ----------
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!conversationId || !detail) return;
    const content = draft.trim();
    if (!content) return;

    setSending(true);
    try {
      const res = await api.post<{ message: MessageData }>(
        `/api/conversations/${conversationId}/messages`,
        { content }
      );
      setDetail((d) => (d ? { ...d, messages: [...d.messages, res.message] } : d));
      setDraft("");
      lastCountRef.current = lastCountRef.current + 1;
      scrollToBottom();
      void fetchConversations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Envoi impossible");
    } finally {
      setSending(false);
    }
  }

  // ---------- Signalement ----------
  async function handleReport() {
    if (!conversationId) return;
    if (reportForm.reason.length < 3) {
      toast.error("Choisissez un motif de signalement");
      return;
    }
    setReporting(true);
    try {
      await api.post(`/api/conversations/${conversationId}/report`, {
        reason: reportForm.reason,
        details: reportForm.details.trim() || undefined,
      });
      toast.success("Signalement envoyé. Notre équipe de modération va examiner la conversation.");
      setReportOpen(false);
      setReportForm({ reason: "AUTRE", details: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Signalement impossible");
    } finally {
      setReporting(false);
    }
  }

  // ---------- Blocage ----------
  async function handleBlock() {
    if (!conversationId) return;
    setBlocking(true);
    try {
      await api.post(`/api/conversations/${conversationId}/block`);
      toast.success("Utilisateur bloqué. Il ne pourra plus vous contacter.");
      setDetail((d) => (d ? { ...d, conversation: { ...d.conversation, blocked: true } } : d));
      setBlockOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Blocage impossible");
    } finally {
      setBlocking(false);
    }
  }

  const otherName = detail
    ? `${detail.conversation.other.firstName} ${detail.conversation.other.lastName}`.trim()
    : "";
  const otherInitials = detail
    ? `${detail.conversation.other.firstName.charAt(0)}${detail.conversation.other.lastName.charAt(0)}`.toUpperCase()
    : "";

  const chatDisabled = Boolean(detail?.conversation.blocked || detail?.conversation.blockedByOther);

  // ================= Rendu =================

  const conversationList = (
    <div
      className={cn(
        "flex min-h-0 flex-col rounded-2xl border border-border/70 bg-card shadow-card",
        conversationId ? "hidden lg:flex" : "flex"
      )}
    >
      <div className="border-b border-border/60 p-3">
        <h2 className="text-sm font-semibold text-forest-800">Conversations</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        {listLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <MessageSquare className="text-forest-200" size={30} aria-hidden="true" />
            <p className="text-xs text-muted-foreground">
              Aucune conversation. Contactez un membre depuis son annonce ou une proposition.
            </p>
          </div>
        ) : (
          <ul aria-label="Liste des conversations">
            {conversations.map((c) => {
              const isActive = c.id === conversationId;
              const isSystem = c.lastMessage?.type === "SYSTEM";
              const initials = `${c.other.firstName.charAt(0)}${c.other.lastName.charAt(0)}`.toUpperCase();
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate("messages", { id: c.id })}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 p-3 text-left transition-colors",
                      isActive ? "bg-mint-100" : "hover:bg-accent"
                    )}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      {c.other.avatarUrl ? <AvatarImage src={c.other.avatarUrl} alt={`Avatar de ${c.other.firstName}`} /> : null}
                      <AvatarFallback className="bg-forest-700 text-xs font-semibold text-white">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn("truncate text-sm", c.unreadCount > 0 ? "font-bold text-forest-800" : "font-medium text-foreground")}>
                          {c.other.firstName} {c.other.lastName}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {timeAgo(c.lastMessageAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className={cn("flex min-w-0 items-center gap-1 text-xs", c.unreadCount > 0 ? "font-medium text-forest-700" : "text-muted-foreground")}>
                          {isSystem && <Info size={12} className="shrink-0 text-forest-500" aria-hidden="true" />}
                          <span className="truncate">
                            {isSystem ? "Système : " : ""}
                            {c.lastMessage?.content ?? "Nouvelle conversation"}
                          </span>
                        </span>
                        {c.unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-brand-500 px-1.5 text-[11px] font-bold text-white">
                            {c.unreadCount}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  const emptyChat = (
    <div className="hidden flex-1 items-center justify-center rounded-2xl border border-dashed border-forest-200 bg-mint-50/50 lg:flex">
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <MessageSquare className="text-forest-300" size={40} aria-hidden="true" />
        <p className="max-w-xs text-sm text-muted-foreground">
          Sélectionnez une conversation pour lire vos messages et poursuivre vos échanges.
        </p>
      </div>
    </div>
  );

  const chatPanel = () => {
    if (!conversationId) return emptyChat;
    if (chatLoading) {
      return (
        <div className="flex flex-1 flex-col rounded-2xl border border-border/70 bg-card shadow-card">
          <div className="flex items-center gap-3 border-b border-border/60 p-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="flex-1 space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className={cn("h-10 rounded-2xl", i % 2 === 0 ? "w-2/3" : "ml-auto w-1/2")} />
            ))}
          </div>
        </div>
      );
    }
    if (chatError || !detail) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-border/70 bg-card p-8 text-center shadow-card">
          <ShieldAlert className="text-muted-foreground" size={32} aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{chatError ?? "Conversation introuvable."}</p>
          <Button type="button" variant="outline" onClick={() => navigate("messages")} className="h-11">
            Retour à la messagerie
          </Button>
        </div>
      );
    }

    const conv = detail.conversation;
    const listingImage = conv.listing?.images?.find((i) => i.isPrimary)?.url ?? conv.listing?.images?.[0]?.url;

    return (
      <div className={cn("flex min-h-0 flex-1 flex-col rounded-2xl border border-border/70 bg-card shadow-card", conversationId ? "flex" : "hidden lg:flex")}>
        {/* En-tête de la conversation */}
        <div className="flex items-center gap-2.5 border-b border-border/60 p-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate("messages")}
            aria-label="Retour à la liste des conversations"
            className="h-10 w-10 shrink-0 lg:hidden"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Button>
          <Avatar className="h-10 w-10 shrink-0">
            {conv.other.avatarUrl ? (
              <AvatarImage src={conv.other.avatarUrl} alt={`Avatar de ${otherName}`} />
            ) : null}
            <AvatarFallback className="bg-forest-700 text-xs font-semibold text-white">
              {otherInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-forest-800">{otherName}</p>
            {conv.listing && (
              <button
                type="button"
                onClick={() => navigate("listing", { id: conv.listing!.id })}
                className="mt-0.5 flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-accent"
              >
                {listingImage && (
                  <span className="relative block h-6 w-6 shrink-0 overflow-hidden rounded">
                    <Image src={listingImage} alt="" fill sizes="24px" className="object-cover" />
                  </span>
                )}
                <span className="truncate text-xs text-muted-foreground">{conv.listing.title}</span>
              </button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Actions sur la conversation"
                className="h-10 w-10 shrink-0"
              >
                <MoreVertical size={18} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setReportOpen(true)}>
                <Flag size={15} aria-hidden="true" />
                Signaler la conversation
              </DropdownMenuItem>
              {!conv.blocked && (
                <DropdownMenuItem
                  onClick={() => setBlockOpen(true)}
                  className="text-red-600 focus:text-red-700"
                >
                  <Ban size={15} aria-hidden="true" />
                  Bloquer cet utilisateur
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3 sm:p-4 custom-scrollbar"
          aria-label="Messages de la conversation"
          aria-live="polite"
        >
          {detail.messages.map((m) => {
            if (m.type === "SYSTEM") {
              return (
                <div key={m.id} className="flex justify-center">
                  <span className="flex max-w-[85%] items-center gap-1.5 rounded-full bg-mint-100 px-3 py-1.5 text-xs text-forest-700">
                    <Info size={13} className="shrink-0" aria-hidden="true" />
                    {m.content}
                    <span className="ml-1 shrink-0 text-[10px] text-forest-500">{timeFormatter.format(new Date(m.createdAt))}</span>
                  </span>
                </div>
              );
            }
            const mine = m.senderId === myId;
            return (
              <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                {m.imageUrl && (
                  <a
                    href={m.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Ouvrir l'image partagée dans un nouvel onglet"
                    className="mb-1 block overflow-hidden rounded-xl border border-border/60"
                  >
                    <span className="relative block h-40 w-40">
                      <Image src={m.imageUrl} alt="Image partagée" fill sizes="160px" className="object-cover" />
                    </span>
                  </a>
                )}
                <div
                  className={cn(
                    "max-w-[80%] whitespace-pre-wrap break-words px-3.5 py-2.5 text-sm leading-relaxed",
                    mine
                      ? "rounded-2xl rounded-br-sm bg-forest-700 text-white"
                      : "rounded-2xl rounded-bl-sm bg-gray-100 text-foreground"
                  )}
                >
                  {m.content}
                </div>
                <span className={cn("mt-0.5 text-[10px] text-muted-foreground", mine ? "text-right" : "text-left")}>
                  {timeFormatter.format(new Date(m.createdAt))}
                  {mine && m.readAt ? " • lu" : ""}
                </span>
              </div>
            );
          })}
        </div>

        {/* Saisie */}
        <div className="border-t border-border/60 p-3">
          {conv.blocked ? (
            <p className="rounded-lg bg-red-50 px-3 py-2.5 text-center text-xs font-medium text-red-600">
              Vous avez bloqué cet utilisateur. Débloquez-le depuis son profil pour reprendre la conversation.
            </p>
          ) : conv.blockedByOther ? (
            <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">
              Conversation indisponible.
            </p>
          ) : (
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Écrivez votre message…"
                aria-label="Votre message"
                maxLength={2000}
                className="h-11 flex-1"
              />
              <Button
                type="submit"
                disabled={sending || draft.trim().length === 0}
                aria-label="Envoyer le message"
                className="h-11 w-11 shrink-0 bg-emerald-brand-500 p-0 text-white hover:bg-emerald-brand-600"
              >
                {sending ? (
                  <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                ) : (
                  <SendHorizonal size={18} aria-hidden="true" />
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  };

  return (
    <AccountShell active="messages" title="Ma messagerie">
      {/* Bureau : liste + chat côte à côte */}
      <div className="hidden h-[calc(100vh-13rem)] gap-4 lg:grid lg:grid-cols-[320px_1fr]">
        {conversationList}
        {chatPanel()}
      </div>

      {/* Mobile : liste OU chat */}
      <div className="h-[calc(100vh-16rem)] min-h-96 lg:hidden">
        {conversationId ? chatPanel() : conversationList}
      </div>

      {/* Dialog : signalement */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Signaler la conversation</DialogTitle>
            <DialogDescription>
              Votre signalement sera transmis à l&apos;équipe de modération avec le contexte de la
              conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="report-reason">Motif</Label>
              <Select value={reportForm.reason} onValueChange={(v) => setReportForm((f) => ({ ...f, reason: v }))}>
                <SelectTrigger id="report-reason" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Motif sélectionné : {reportReasonLabel(reportForm.reason)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-details">Détails (facultatif)</Label>
              <Textarea
                id="report-details"
                placeholder="Décrivez le problème rencontré…"
                value={reportForm.details}
                onChange={(e) => setReportForm((f) => ({ ...f, details: e.target.value }))}
                maxLength={500}
                className="min-h-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReportOpen(false)} className="h-11">
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleReport}
              disabled={reporting}
              className="h-11 bg-forest-700 text-white hover:bg-forest-800"
            >
              {reporting ? (
                <Loader2 className="animate-spin" size={16} aria-hidden="true" />
              ) : (
                <Flag size={16} aria-hidden="true" />
              )}
              Envoyer le signalement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : blocage */}
      <AlertDialog open={blockOpen} onOpenChange={setBlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              {otherName} ne pourra plus vous envoyer de messages. Cette action peut être annulée
              depuis son profil public.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlock}
              disabled={blocking}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {blocking ? "Blocage…" : "Bloquer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AccountShell>
  );
}
