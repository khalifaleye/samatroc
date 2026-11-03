"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { ChevronRight, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/stores/router-store";
import { api } from "@/lib/api";

interface ContentResponse {
  content: { page: string; title: string; body: string };
}

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

export default function AboutView() {
  const navigate = useRouter((s) => s.navigate);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ContentResponse>("/api/content/ABOUT")
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
  }, [reloadTick]);

  function retry() {
    setError(null);
    setLoading(true);
    setReloadTick((t) => t + 1);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Fil d'Ariane */}
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-xs text-muted-foreground mb-6">
        <button onClick={() => navigate("home")} className="hover:text-forest-700 transition-colors">
          Accueil
        </button>
        <ChevronRight size={12} aria-hidden="true" />
        <span className="text-forest-800 font-medium">À propos</span>
      </nav>

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
            Impossible de charger cette page : {error}
          </p>
          <Button variant="outline" onClick={retry} className="rounded-full">
            Réessayer
          </Button>
        </div>
      ) : (
        <article>
          <h1 className="text-3xl font-extrabold text-forest-900 mb-8 text-balance">{title}</h1>
          <ReactMarkdown components={markdownComponents}>{body}</ReactMarkdown>
          <div className="mt-10 bg-mint-50 border border-mint-200 rounded-2xl p-5 flex items-start gap-3">
            <Info size={20} className="text-forest-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-forest-900/80 leading-relaxed">
              SamaTroc est une plateforme sénégalaise d&apos;échange d&apos;objets entre
              particuliers. Pour en savoir plus sur le fonctionnement, consultez la page{" "}
              <button
                onClick={() => navigate("how-it-works")}
                className="font-semibold text-forest-700 underline underline-offset-2 hover:text-forest-800"
              >
                Comment ça marche ?
              </button>
              .
            </p>
          </div>
        </article>
      )}
    </div>
  );
}
