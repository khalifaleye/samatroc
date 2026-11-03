"use client";

import { useEffect, useState, type ComponentType } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type NavigateFn = (
  view: string,
  params?: Record<string, string>,
  query?: Record<string, string>
) => void;

/**
 * Gestion centralisée des erreurs d'appel API du back-office.
 * 401/403 : la session n'est plus valide ou le rôle ne suffit plus → retour à l'accueil.
 * Autres erreurs : message serveur affiché en toast.
 */
export function handleAdminError(error: unknown, navigate: NavigateFn): void {
  if (error instanceof ApiClientError) {
    if (error.status === 401 || error.status === 403) {
      toast.error("Accès refusé : cette section est réservée aux administrateurs connectés.");
      navigate("home");
      return;
    }
    toast.error(error.message);
    return;
  }
  toast.error("Une erreur inattendue est survenue. Veuillez réessayer.");
}

/** Valeur différée (recherche avec debounce) */
export function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Pagination compacte : page précédente / suivante + « page X sur Y » */
export function AdminPagination({
  page,
  totalPages,
  onChange,
  className,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div
      className={cn("flex items-center justify-end gap-2 py-3", className)}
      role="navigation"
      aria-label="Pagination"
    >
      <span className="text-sm text-muted-foreground mr-1">
        Page {page} sur {totalPages}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Page précédente"
      >
        <ChevronLeft size={16} />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Page suivante"
      >
        <ChevronRight size={16} />
      </Button>
    </div>
  );
}

/** Avatar avec initiales (les comptes admin n'ont pas toujours de photo) */
export function InitialsAvatar({
  firstName,
  lastName,
  className,
}: {
  firstName?: string | null;
  lastName?: string | null;
  className?: string;
}) {
  const initials =
    `${firstName?.trim()?.[0] ?? ""}${lastName?.trim()?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint-100 text-xs font-bold text-forest-700",
        className
      )}
    >
      {initials}
    </div>
  );
}

/** État vide illustré pour les listes du back-office */
export function AdminEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  className,
}: {
  icon?: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-12 px-4 text-center",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-mint-50">
        <Icon size={26} className="text-forest-600" aria-hidden="true" />
      </div>
      <p className="font-semibold text-forest-800">{title}</p>
      {description ? (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      ) : null}
    </div>
  );
}

/** Squelette de tableau pendant le chargement */
export function AdminTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" role="status" aria-live="polite" aria-label="Chargement en cours">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24 hidden sm:block" />
          <Skeleton className="h-4 w-20 hidden md:block" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Badge de statut générique (couleurs de la palette SamaTroc) */
export function AdminStatusBadge({
  label,
  colorClass,
  className,
}: {
  label: string;
  colorClass?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        colorClass ?? "bg-gray-100 text-gray-700",
        className
      )}
    >
      {label}
    </span>
  );
}
