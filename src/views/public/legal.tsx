"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { ChevronRight, AlertCircle, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/stores/router-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface LegalViewProps {
  page: "CGU" | "PRIVACY" | "MODERATION";
}

interface ContentResponse {
  content: { page: string; title: string; body: string };
}

const LEGAL_PAGES: { key: LegalViewProps["page"]; view: string; label: string }[] = [
  { key: "CGU", view: "cgu", label: "Conditions d'utilisation" },
  { key: "PRIVACY", view: "privacy", label: "Politique de confidentialité" },
  { key: "MODERATION", view: "moderation", label: "Politique de modération" },
];

const markdownComponents: Components = {
  h2: ({ children }) => (
    <h2 className="text-xl font-bold text-forest-800 mt-8 mb-3">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-forest-900 mt-6 mb-2">{children}</h3>
  ),
  p: ({ children }) => <p className="text-muted-foreground leading-relaxed mb-3">{children}</p>,
  li: ({ children }) => (
    <li className="ml-5 list-disc text-muted-foreground mb-1">{children}</li>
  ),
  strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
};

export default function LegalView({ page }: LegalViewProps) {
  const navigate = useRouter((s) => s.navigate);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ContentResponse>(`/api/content/${page}`)
      .then((res) => {
        if (cancelled) return;
        setTitle(res.content.title);
        setBody(res.content.body);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Erreur de chargement");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, reloadTick]);

  function retry() {
    setError(null);
    setLoading(true);
    setReloadTick((t) => t + 1);
  }

  const currentLabel =
    LEGAL_PAGES.find((p) => p.key === page)?.label ?? "Document légal";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Fil d'Ariane */}
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-xs text-muted-foreground mb-6">
        <button onClick={() => navigate("home")} className="hover:text-forest-700 transition-colors">
          Accueil
        </button>
        <ChevronRight size={12} aria-hidden="true" />
        <span className="text-forest-800 font-medium">{currentLabel}</span>
      </nav>

      {/* Sélecteur de documents légaux */}
      <div className="flex flex-wrap gap-2 mb-8" role="navigation" aria-label="Documents légaux">
        {LEGAL_PAGES.map((legal) => (
          <button
            key={legal.key}
            type="button"
            onClick={() => navigate(legal.view)}
            aria-current={legal.key === page ? "page" : undefined}
            className={cn(
              "h-10 px-4 rounded-full text-sm font-medium transition-colors",
              legal.key === page
                ? "bg-forest-700 text-white"
                : "bg-card border border-border text-foreground hover:bg-accent"
            )}
          >
            {legal.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : error ? (
        <div className="bg-card border rounded-2xl text-center py-12 px-4">
          <AlertCircle className="mx-auto text-mango-500 mb-3" size={32} aria-hidden="true" />
          <p className="text-sm text-muted-foreground mb-4">
            Impossible de charger ce document : {error}
          </p>
          <Button variant="outline" onClick={retry} className="rounded-full">
            Réessayer
          </Button>
        </div>
      ) : (
        <article>
          <div className="flex items-center gap-3 mb-8">
            <span className="h-11 w-11 rounded-full bg-mint-100 text-forest-700 flex items-center justify-center shrink-0">
              <Scale size={20} aria-hidden="true" />
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-forest-900 text-balance">
              {title}
            </h1>
          </div>
          <ReactMarkdown components={markdownComponents}>{body}</ReactMarkdown>
        </article>
      )}
    </div>
  );
}
