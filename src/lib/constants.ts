/**
 * Constantes partagées SamaTroc (client + serveur)
 * Locale : français • Monnaie : FCFA • Fuseau : Africa/Dakar
 */

export const APP_NAME = "SamaTroc";
export const APP_SLOGAN = "Échangez • Économisez • Donnez une seconde vie";
export const APP_TIMEZONE = "Africa/Dakar";
export const PUBLICATION_FEE_DEFAULT = 500; // FCFA

// ---------- Conditions des objets ----------
export const CONDITIONS = [
  { value: "NEUF", label: "Neuf" },
  { value: "TRES_BON", label: "Très bon état" },
  { value: "BON", label: "Bon état" },
  { value: "SATISFAISANT", label: "État satisfaisant" },
] as const;
export type ConditionValue = (typeof CONDITIONS)[number]["value"];

export function conditionLabel(value: string): string {
  return CONDITIONS.find((c) => c.value === value)?.label ?? value;
}

// ---------- Statuts d'annonce ----------
// Double vocabulaire assumé :
//  • l'UI (vues inchangées) connaît les libellés historiques (PENDING_MODERATION, REFUSED, DEACTIVATED)
//  • la base Supabase utilise l'enum `listing_status` (PENDING_REVIEW, REJECTED, INACTIVE, …)
// LISTING_STATUSES couvre donc les deux vocables (mêmes libellés/couleurs par paire).
// Les routes traduisent via listingStatusToDb (entrée) et listingStatusToApi (sortie).
export const LISTING_STATUSES = [
  { value: "DRAFT", label: "Brouillon", color: "bg-gray-100 text-gray-700" },
  { value: "PENDING_PAYMENT", label: "En attente de paiement", color: "bg-mango-100 text-mango-700" },
  // Vocabulaire historique (contrat des vues)
  { value: "PENDING_MODERATION", label: "En attente de modération", color: "bg-amber-100 text-amber-700" },
  { value: "REFUSED", label: "Refusée", color: "bg-red-100 text-red-700" },
  { value: "DEACTIVATED", label: "Désactivée", color: "bg-gray-100 text-gray-700" },
  // Valeurs de l'enum Prisma/Supabase `listing_status`
  { value: "PENDING_REVIEW", label: "En attente de modération", color: "bg-amber-100 text-amber-700" },
  { value: "REJECTED", label: "Refusée", color: "bg-red-100 text-red-700" },
  { value: "INACTIVE", label: "Désactivée", color: "bg-gray-100 text-gray-700" },
  { value: "PUBLISHED", label: "Publiée", color: "bg-mint-100 text-forest-700" },
  { value: "EXCHANGED", label: "Échangée", color: "bg-forest-600 text-white" },
  { value: "DELETED", label: "Supprimée", color: "bg-red-100 text-red-700" },
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number]["value"];

/** Valeurs exactes de l'enum base `listing_status` (Supabase) */
export const LISTING_DB_STATUSES = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
  "INACTIVE",
  "EXCHANGED",
  "DELETED",
] as const;

/**
 * Vocabulaire UI (historique) → enum base Supabase.
 * Appliqué aux données ENTRANTES (query `status`, corps de requêtes).
 */
export function listingStatusToDb(value: string): string {
  switch (value) {
    case "PENDING_MODERATION":
      return "PENDING_REVIEW";
    case "REFUSED":
      return "REJECTED";
    case "DEACTIVATED":
      return "INACTIVE";
    default:
      return value;
  }
}

/**
 * Enum base Supabase → vocabulaire UI (historique).
 * Appliqué aux données SORTANTES pour préserver EXACTEMENT le format JSON
 * attendu par les vues (ex. statut « DEACTIVATED » affiché « Désactivée »).
 */
export function listingStatusToApi(value: string): string {
  switch (value) {
    case "PENDING_REVIEW":
      return "PENDING_MODERATION";
    case "REJECTED":
      return "REFUSED";
    case "INACTIVE":
      return "DEACTIVATED";
    default:
      return value;
  }
}

export function listingStatusLabel(value: string): string {
  return LISTING_STATUSES.find((s) => s.value === value)?.label ?? value;
}
export function listingStatusColor(value: string): string {
  return (
    LISTING_STATUSES.find((s) => s.value === value)?.color ?? "bg-gray-100 text-gray-700"
  );
}

// ---------- Statuts de proposition d'échange ----------
/**
 * Statuts de proposition — zone du domaine échanges (tâche 5-c).
 * L'enum base `proposal_status` (Supabase) est PENDING / ACCEPTED / REJECTED /
 * COUNTERED / CANCELLED / COMPLETED : les valeurs REJECTED et COUNTERED sont
 * ajoutées ci-dessous. Les entrées historiques REFUSED / DISCUSSING sont
 * conservées : l'API expose le vocabulaire legacy (les vues — filtres de
 * statut et `isPendingish` — s'y réfèrent) et les badges restent rendus quoi
 * qu'il arrive.
 */
export const PROPOSAL_STATUSES = [
  { value: "PENDING", label: "En attente", color: "bg-mango-100 text-mango-700" },
  { value: "ACCEPTED", label: "Acceptée", color: "bg-mint-100 text-forest-700" },
  { value: "REFUSED", label: "Refusée", color: "bg-red-100 text-red-700" },
  { value: "REJECTED", label: "Refusée", color: "bg-red-100 text-red-700" },
  { value: "DISCUSSING", label: "En discussion", color: "bg-amber-100 text-amber-700" },
  { value: "COUNTERED", label: "Contre-proposition", color: "bg-amber-100 text-amber-700" },
  { value: "CANCELLED", label: "Annulée", color: "bg-gray-100 text-gray-700" },
  { value: "COMPLETED", label: "Échange réalisé", color: "bg-forest-600 text-white" },
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]["value"];

/** Valeurs exactes de l'enum base `proposal_status` (Supabase) */
export const PROPOSAL_DB_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "COUNTERED",
  "CANCELLED",
  "COMPLETED",
] as const;
/** Statut de proposition tel que stocké en base (union littérale de l'enum). */
export type ProposalDbStatus = (typeof PROPOSAL_DB_STATUSES)[number];

/**
 * Enum base `proposal_status` (Supabase) → vocabulaire UI (historique).
 * Appliqué aux données SORTANTES pour préserver le format JSON des vues
 * (REJECTED → REFUSED, COUNTERED → DISCUSSING) — même mécanique que
 * listingStatusToApi pour les annonces.
 */
export function proposalStatusToApi(value: string): string {
  switch (value) {
    case "REJECTED":
      return "REFUSED";
    case "COUNTERED":
      return "DISCUSSING";
    default:
      return value;
  }
}

/**
 * Vocabulaire UI (historique) → enum base Supabase.
 * Appliqué aux données ENTRANTES (query `status`). Les deux vocables sont
 * acceptés ; retourne null si la valeur est inconnue (filtre alors ignoré).
 */
export function proposalStatusToDb(value: string): ProposalDbStatus | null {
  const mapped =
    value === "DISCUSSING" ? "COUNTERED" : value === "REFUSED" ? "REJECTED" : value;
  return (PROPOSAL_DB_STATUSES as readonly string[]).includes(mapped)
    ? (mapped as ProposalDbStatus)
    : null;
}

export function proposalStatusLabel(value: string): string {
  return PROPOSAL_STATUSES.find((s) => s.value === value)?.label ?? value;
}
export function proposalStatusColor(value: string): string {
  return (
    PROPOSAL_STATUSES.find((s) => s.value === value)?.color ?? "bg-gray-100 text-gray-700"
  );
}

// ---------- Paiements ----------
export const PAYMENT_PROVIDERS = [
  {
    id: "WAVE",
    name: "Wave",
    description: "Paiement instantané via l'application Wave",
    color: "#1DC8FF",
  },
  {
    id: "ORANGE_MONEY",
    name: "Orange Money",
    description: "Paiement via votre compte Orange Money",
    color: "#FF7900",
  },
] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDERS)[number]["id"];

export const PAYMENT_STATUSES = [
  { value: "PENDING", label: "En attente", color: "bg-mango-100 text-mango-700" },
  { value: "PROCESSING", label: "Paiement en cours", color: "bg-amber-100 text-amber-700" },
  { value: "SUCCESS", label: "Réussi", color: "bg-mint-100 text-forest-700" },
  { value: "FAILED", label: "Échoué", color: "bg-red-100 text-red-700" },
  { value: "EXPIRED", label: "Expiré", color: "bg-gray-100 text-gray-700" },
  { value: "REFUNDED", label: "Remboursé", color: "bg-purple-100 text-purple-700" },
] as const;

export function paymentStatusLabel(value: string): string {
  return PAYMENT_STATUSES.find((s) => s.value === value)?.label ?? value;
}
export function paymentStatusColor(value: string): string {
  return (
    PAYMENT_STATUSES.find((s) => s.value === value)?.color ?? "bg-gray-100 text-gray-700"
  );
}

// ---------- Motifs de signalement ----------
export const REPORT_REASONS = [
  { value: "FRAUDE", label: "Fraude ou arnaque présumée" },
  { value: "CONTENU_INTERDIT", label: "Contenu interdit (illégal, dangereux, volé)" },
  { value: "OFFENSANT", label: "Contenu offensant ou inapproprié" },
  { value: "CONTREFACON", label: "Contrefaçon" },
  { value: "FAUX_PROFIL", label: "Faux profil ou usurpation" },
  { value: "AUTRE", label: "Autre motif" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export function reportReasonLabel(value: string): string {
  return REPORT_REASONS.find((r) => r.value === value)?.label ?? value;
}

// ---------- Villes du Sénégal (référentiel de démonstration extensible via l'admin) ----------
export const SENEGAL_CITIES = [
  { name: "Dakar", region: "Dakar" },
  { name: "Thiès", region: "Thiès" },
  { name: "Mbour", region: "Thiès" },
  { name: "Touba", region: "Diourbel" },
  { name: "Saint-Louis", region: "Saint-Louis" },
  { name: "Kaolack", region: "Kaolack" },
  { name: "Ziguinchor", region: "Ziguinchor" },
  { name: "Diourbel", region: "Diourbel" },
  { name: "Louga", region: "Louga" },
  { name: "Fatick", region: "Fatick" },
  { name: "Tambacounda", region: "Tambacounda" },
  { name: "Kolda", region: "Kolda" },
  { name: "Matam", region: "Matam" },
  { name: "Kédougou", region: "Kédougou" },
  { name: "Sédhiou", region: "Sédhiou" },
] as const;

// ---------- Catégories par défaut (slug, nom, icône lucide, couleur) ----------
export const DEFAULT_CATEGORIES = [
  { name: "Vêtements & chaussures", slug: "vetements-chaussures", icon: "shirt", color: "#12a05f" },
  { name: "Électronique & téléphonie", slug: "electronique-telephonie", icon: "smartphone", color: "#0e5c3d" },
  { name: "Maison & jardin", slug: "maison-jardin", icon: "home", color: "#2dbd80" },
  { name: "Beauté & santé", slug: "beaute-sante", icon: "flower", color: "#ec4899" },
  { name: "Sport & loisirs", slug: "sport-loisirs", icon: "trophy", color: "#f59e0b" },
  { name: "Livres & papeterie", slug: "livres-papeterie", icon: "book", color: "#0a3d2a" },
  { name: "Enfants & bébés", slug: "enfants-bebes", icon: "baby", color: "#8b5cf6" },
  { name: "Meubles & décoration", slug: "meubles-decoration", icon: "armchair", color: "#17724c" },
  { name: "Autres", slug: "autres", icon: "grid", color: "#5b6b63" },
] as const;

// ---------- Mots-clés suspects (détection automatique de spam) ----------
export const SUSPICIOUS_KEYWORDS = [
  "western union",
  "moneygram",
  "bitcoin",
  "crypto",
  "investissement garanti",
  "gagnez de l'argent",
  "urgently",
  "whatsapp only",
  "paiement avant livraison",
  "frais de dossier",
  "loterie",
  "héritage",
];

// ---------- Types de notification ----------
export const NOTIFICATION_TYPES = {
  PROPOSAL_RECEIVED: "Nouvelle proposition d'échange",
  PROPOSAL_ACCEPTED: "Proposition acceptée",
  PROPOSAL_REFUSED: "Proposition refusée",
  PROPOSAL_COMPLETED: "Échange réalisé",
  MESSAGE: "Nouveau message",
  PAYMENT_CONFIRMED: "Paiement confirmé",
  LISTING_PUBLISHED: "Annonce publiée",
  LISTING_REFUSED: "Annonce refusée",
  LISTING_EXPIRED: "Annonce expirée",
  REPORT_UPDATE: "Signalement traité",
  SYSTEM: "Information",
} as const;

// ---------- Formatage FCFA ----------
export function formatFCFA(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `${amount.toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ")} FCFA`;
}

/** Formate une date en français avec le fuseau Africa/Dakar */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: APP_TIMEZONE,
  }).format(d);
}

/** Date relative : « il y a 3 jours » */
export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} jour${days > 1 ? "s" : ""}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `il y a ${weeks} semaine${weeks > 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  const years = Math.floor(days / 365);
  return `il y a ${years} an${years > 1 ? "s" : ""}`;
}

/** Formate un numéro de téléphone sénégalais : +221 77 123 45 67 */
export function formatPhoneSN(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("221") ? digits.slice(3) : digits;
  if (local.length === 9) {
    return `+221 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
  }
  return phone;
}

export const PAGE_SIZE_DEFAULT = 12;
