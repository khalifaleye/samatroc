"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { FileEdit, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/constants";
import { useNavigate } from "@/stores/router-store";
import { handleAdminError } from "./admin-shared";

type ContentPage =
  | "ABOUT"
  | "HOW_IT_WORKS"
  | "FAQ"
  | "SAFETY"
  | "CGU"
  | "PRIVACY"
  | "MODERATION"
  | "CONTACT";

interface SiteContent {
  page: string;
  title: string;
  body: string;
  updatedAt: string;
}

const PAGES: { value: ContentPage; label: string }[] = [
  { value: "ABOUT", label: "À propos" },
  { value: "HOW_IT_WORKS", label: "Comment ça marche" },
  { value: "FAQ", label: "FAQ" },
  { value: "SAFETY", label: "Conseils de sécurité" },
  { value: "CGU", label: "CGU" },
  { value: "PRIVACY", label: "Confidentialité" },
  { value: "MODERATION", label: "Modération" },
  { value: "CONTACT", label: "Contact" },
];

const EMPTY_DRAFT = { title: "", body: "" };

/** Gestion du contenu éditorial : 8 pages statiques en markdown */
export default function AdminContent() {
  const navigate = useNavigate();
  const [contents, setContents] = useState<SiteContent[]>([]);
  const [activePage, setActivePage] = useState<ContentPage>("ABOUT");
  const [drafts, setDrafts] = useState<Record<string, { title: string; body: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ contents: SiteContent[] }>("/api/admin/content");
      setContents(res.contents);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const c of res.contents) {
          if (!next[c.page]) {
            next[c.page] = { title: c.title, body: c.body };
          }
        }
        return next;
      });
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const existing = useMemo(
    () => contents.find((c) => c.page === activePage) ?? null,
    [contents, activePage]
  );
  const draft = drafts[activePage] ?? EMPTY_DRAFT;
  const isNew = !existing;

  const setDraftField = (field: "title" | "body", value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [activePage]: { ...(prev[activePage] ?? EMPTY_DRAFT), [field]: value },
    }));
  };

  const titleValid = draft.title.trim().length >= 2 && draft.title.trim().length <= 150;
  const bodyValid = draft.body.trim().length >= 10 && draft.body.trim().length <= 50000;

  const save = async () => {
    if (!titleValid || !bodyValid) {
      toast.error(
        "Le titre doit contenir au moins 2 caractères et le contenu au moins 10 caractères."
      );
      return;
    }
    setSaving(true);
    try {
      const res = await api.put<{ content: SiteContent; message?: string }>("/api/admin/content", {
        page: activePage,
        title: draft.title.trim(),
        body: draft.body.trim(),
      });
      toast.success(res.message ?? "Contenu mis à jour");
      const updated = res.content;
      setContents((prev) => {
        const rest = prev.filter((c) => c.page !== activePage);
        return [...rest, updated].sort((a, b) => a.page.localeCompare(b.page));
      });
    } catch (error) {
      handleAdminError(error, navigate);
    } finally {
      setSaving(false);
    }
  };

  if (loading && contents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3" role="status" aria-live="polite">
        <Loader2 className="animate-spin text-forest-600" size={32} />
        <p className="text-sm text-muted-foreground">Chargement du contenu éditorial…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sélecteur de page */}
      <Tabs value={activePage} onValueChange={(v) => setActivePage(v as ContentPage)}>
        <div className="overflow-x-auto custom-scrollbar pb-1">
          <TabsList className="h-auto">
            {PAGES.map((p) => {
              const exists = contents.some((c) => c.page === p.value);
              return (
                <TabsTrigger key={p.value} value={p.value} className="whitespace-nowrap">
                  {p.label}
                  {exists ? "" : " *"}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
      </Tabs>

      {isNew ? (
        <div className="flex items-start gap-3 rounded-xl border border-mango-200 bg-mango-50 p-4">
          <FileEdit className="text-mango-600 shrink-0 mt-0.5" size={18} aria-hidden="true" />
          <p className="text-sm text-mango-700">
            Cette page n&apos;a pas encore de contenu publié sur le site. Rédigez-le puis
            enregistrez : il sera créé automatiquement et visible par les visiteurs.
          </p>
        </div>
      ) : null}

      <div className="grid xl:grid-cols-[1fr_420px] gap-4 items-start">
        {/* Éditeur */}
        <Card>
          <CardContent className="p-4 md:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h2 className="font-semibold text-forest-800 flex-1">
                Édition : {PAGES.find((p) => p.value === activePage)?.label}
              </h2>
              {existing ? (
                <p className="text-xs text-muted-foreground">
                  Dernière mise à jour : {formatDate(existing.updatedAt)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Nouveau contenu</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="content-title">Titre de la page</Label>
              <Input
                id="content-title"
                value={draft.title}
                onChange={(e) => setDraftField("title", e.target.value)}
                maxLength={150}
                placeholder="Exemple : À propos de SamaTroc"
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="content-body">Contenu (markdown)</Label>
                <span className="text-xs text-muted-foreground" aria-live="polite">
                  {draft.body.length.toLocaleString("fr-FR")} caractères
                </span>
              </div>
              <Textarea
                id="content-body"
                value={draft.body}
                onChange={(e) => setDraftField("body", e.target.value)}
                className="min-h-[400px] font-mono text-sm leading-relaxed"
                placeholder="Rédigez le contenu de la page en markdown (## titres, listes, **gras**...)"
              />
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Le markdown est pris en charge : « ## Titre », listes à puces, **gras**, liens.
              </p>
              <Button
                className="bg-forest-700 hover:bg-forest-800 gap-2"
                onClick={() => void save()}
                disabled={saving || !titleValid || !bodyValid}
              >
                {saving ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Save size={15} aria-hidden="true" />
                )}
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Aperçu */}
        <Card className="xl:sticky xl:top-20">
          <CardContent className="p-4 md:p-5">
            <h2 className="font-semibold text-forest-800 mb-3">Aperçu public</h2>
            <div className="max-h-[560px] overflow-y-auto custom-scrollbar rounded-lg border bg-white p-4">
              {draft.title.trim() ? (
                <h1 className="text-xl font-extrabold text-forest-800 mb-3">{draft.title}</h1>
              ) : (
                <p className="text-sm italic text-muted-foreground mb-3">(Titre vide)</p>
              )}
              {draft.body.trim() ? (
                <div className="text-sm space-y-2">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-lg font-extrabold text-forest-800 mt-4 mb-2">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="font-bold text-forest-800 text-base mt-4 mb-1">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="font-semibold text-forest-700 mt-3 mb-1">{children}</h3>
                      ),
                      p: ({ children }) => (
                        <p className="text-muted-foreground leading-relaxed">{children}</p>
                      ),
                      ul: ({ children }) => <ul className="space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal ml-5 space-y-1">{children}</ol>,
                      li: ({ children }) => (
                        <li className="list-disc ml-5 text-muted-foreground">{children}</li>
                      ),
                      a: ({ children, href }) => (
                        <a href={href} className="text-emerald-brand-600 underline break-words">
                          {children}
                        </a>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-forest-800">{children}</strong>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-mint-200 pl-3 italic text-muted-foreground">
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {draft.body}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm italic text-muted-foreground">(Contenu vide)</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Aperçu approximatif : la page publique applique la mise en page complète du site.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
