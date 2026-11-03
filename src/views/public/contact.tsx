"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { ChevronRight, AlertCircle, Mail, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/stores/router-store";
import { api } from "@/lib/api";

interface ContentResponse {
  content: { page: string; title: string; body: string };
}

const markdownComponents: Components = {
  h2: ({ children }) => (
    <h2 className="text-lg font-bold text-forest-800 mt-6 mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-forest-900 mt-5 mb-2">{children}</h3>
  ),
  p: ({ children }) => <p className="text-muted-foreground leading-relaxed mb-3">{children}</p>,
  li: ({ children }) => (
    <li className="ml-5 list-disc text-muted-foreground mb-1">{children}</li>
  ),
  strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactView() {
  const navigate = useRouter((s) => s.navigate);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ContentResponse>("/api/content/CONTACT")
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

  function retryContent() {
    setError(null);
    setLoading(true);
    setReloadTick((t) => t + 1);
  }

  async function submitForm(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      toast.error("Merci de remplir tous les champs obligatoires");
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      toast.error("Adresse e-mail invalide");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/contact", {
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      toast.success("Message envoyé ! Notre équipe vous répondra dans les meilleurs délais.");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'envoi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Fil d'Ariane */}
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-xs text-muted-foreground mb-6">
        <button onClick={() => navigate("home")} className="hover:text-forest-700 transition-colors">
          Accueil
        </button>
        <ChevronRight size={12} aria-hidden="true" />
        <span className="text-forest-800 font-medium">Contact &amp; assistance</span>
      </nav>

      <h1 className="text-3xl font-extrabold text-forest-900 mb-2">Contact &amp; assistance</h1>
      <p className="text-muted-foreground mb-8">
        Une question, un problème ou une suggestion ? Écrivez-nous, nous vous répondrons rapidement.
      </p>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* Informations pratiques */}
        <div className="bg-mint-50 border border-mint-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-9 w-9 rounded-full bg-forest-700 text-white flex items-center justify-center">
              <Mail size={16} aria-hidden="true" />
            </span>
            <h2 className="font-semibold text-forest-900">{title || "Nous joindre"}</h2>
          </div>
          {loading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-sm text-muted-foreground">
              <p className="mb-3">Informations momentanément indisponibles : {error}</p>
              <Button variant="outline" onClick={retryContent} className="rounded-full h-9">
                Réessayer
              </Button>
            </div>
          ) : (
            <ReactMarkdown components={markdownComponents}>{body}</ReactMarkdown>
          )}
        </div>

        {/* Formulaire */}
        <form onSubmit={(e) => void submitForm(e)} className="bg-card border border-border/70 rounded-2xl p-6 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="contact-name" className="text-sm font-medium">
              Votre nom
            </Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Exemple : Awa Diop"
              autoComplete="name"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-email" className="text-sm font-medium">
              Votre e-mail
            </Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemple@email.com"
              autoComplete="email"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-subject" className="text-sm font-medium">
              Sujet
            </Label>
            <Input
              id="contact-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Exemple : question sur un paiement"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-message" className="text-sm font-medium">
              Message
            </Label>
            <Textarea
              id="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Décrivez votre demande..."
              rows={5}
            />
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-full bg-forest-700 hover:bg-forest-800 text-white gap-2"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Send size={16} aria-hidden="true" />
            )}
            Envoyer le message
          </Button>
        </form>
      </div>
    </div>
  );
}
