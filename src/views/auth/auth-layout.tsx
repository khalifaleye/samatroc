"use client";

import type { ReactNode } from "react";
import { useRouter } from "@/stores/router-store";
import { Logo } from "@/components/logo";

/**
 * Layout commun des vues d'authentification :
 * plein écran centré sur fond menthe très clair, carte blanche arrondie,
 * logo SamaTroc cliquable en haut (retour à l'accueil).
 */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const navigate = useRouter((s) => s.navigate);

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center bg-mint-50 px-4 py-10 sm:py-14">
      <div className="w-full max-w-md animate-fade-up">
        <button
          type="button"
          onClick={() => navigate("home")}
          aria-label="Retour à l'accueil SamaTroc"
          className="mx-auto mb-6 flex h-11 items-center rounded-xl px-2 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Logo size="md" showSlogan={false} />
        </button>

        <section className="rounded-2xl border border-border/60 bg-white p-6 shadow-card sm:p-8">
          <h1 className="text-xl font-bold text-forest-800 sm:text-2xl">{title}</h1>
          {subtitle ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
          <div className="mt-6">{children}</div>
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Échangez, économisez, donnez une seconde vie à vos objets au Sénégal.
        </p>
      </div>
    </div>
  );
}

/** Message d'erreur sous un champ de formulaire */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
      {message}
    </p>
  );
}
