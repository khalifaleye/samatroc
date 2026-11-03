# SamaTroc — Guide Frontend (conventions obligatoires)

## Stack & règles absolues

- Next.js 16 App Router + TypeScript strict. **Une seule route serveur : `/`** (src/app/page.tsx).
- Toutes les « pages » sont des **vues client** dans `src/views/<domaine>/<nom>.tsx`, naviguées via le store routeur.
- **Aucune URL absolue** dans les fetch : toujours des chemins relatifs (`/api/...`).
- `'use client'` en tête de chaque fichier de vue.
- UI : shadcn/ui (`@/components/ui/*`) + Lucide (`lucide-react`). Pas d'emoji dans le code.
- Pas d'indigo/bleu : palette verte/orange SamaTroc.
- Toasts : `import { toast } from "sonner"`.
- Images : `<Image src="..." fill sizes="..." className="object-cover" alt="..."/>` de next/image.
- Tout texte affichable est en **français**. Montants via `formatFCFA`, dates via `timeAgo`/`formatDate` (src/lib/constants.ts).
- Composants présents dans `src/components/` : `ListingCard`, `CategoryIcon`, `Logo`, `Navbar`, `Footer`, `RequireAuth`.

## Palette (classes Tailwind disponibles)

- Vert forêt identité : `forest-50…950` (700 = boutons principaux sombres, 950 = footer)
- Vert émeraude actions : `emerald-brand-50…700` (500 = boutons/actions)
- Orange accents : `mango-50…700` (500 = accents/logo, 100 = fonds badges)
- Vert menthe fonds : `mint-50/100/200`
- shadcn : `bg-primary text-primary-foreground`, `bg-accent`, `text-muted-foreground`, `border`, `ring` déjà alignés sur la palette.

Typo : Poppins via `font-sans` (défaut). Ombres : `shadow-card`, `shadow-card-hover`. Animation entrée : `animate-fade-up`.

## Routeur (src/stores/router-store.ts)

```tsx
import { useRouter } from "@/stores/router-store";
const navigate = useRouter((s) => s.navigate);
navigate("explore", {}, { q: "vélo", city: "Dakar" });   // (view, params, query)
navigate("listing", { id: listing.id });
navigate("messages", { id: conversationId });
```

Vues enregistrées (fichier → clé de vue) :

| Clé | Fichier | Props reçues |
|---|---|---|
| home | views/public/home.tsx | — |
| explore | views/public/explore.tsx | `{ query }` |
| listing | views/public/listing-detail.tsx | `{ id }` |
| categories | views/public/categories.tsx | `{ query }` |
| about / how-it-works / faq / contact / safety | views/public/*.tsx | — |
| cgu / privacy / moderation | views/public/legal.tsx | `{ page: "CGU"|"PRIVACY"|"MODERATION" }` |
| login / register / forgot-password / reset-password | views/auth/*.tsx | reset-password : `{ token }` |
| dashboard, profile, my-listings, publish, proposals, exchanges, favorites, messages, payments, notifications, settings | views/account/*.tsx | publish : `{ editId }` ; messages : `{ conversationId }` |
| admin-* | views/admin/* via admin-shell.tsx | `{ view }` |

Dans les vues publiques/account, la navigation interne vers l'espace personnel se fait vers les clés `dashboard`, `profile`, etc. Administration : `admin-dashboard`, `admin-users`, `admin-listings`, `admin-payments`, `admin-categories`, `admin-reports`, `admin-content`, `admin-settings`.

## Auth (src/stores/auth-store.ts)

```tsx
import { useAuth } from "@/stores/auth-store";
const { user, status, refresh, login, logout } = useAuth();
// user: CurrentUser | null (avec unreadNotifications, unreadMessages)
// status: "loading" | "authenticated" | "guest"
```

Après toute action qui change l'état serveur (favori, message envoyé, annonce publiée…), appeler `useAuth.getState().refresh()` quand des compteurs sont impliqués.

## Client API (src/lib/api.ts)

```tsx
import { api } from "@/lib/api";
const data = await api.get<{ listings: ListingSummary[] }>("/api/listings?page=1");
await api.post("/api/listings", payload);
await api.upload<{ urls: string[] }>("/api/upload", formData);
// erreurs : ApiClientError { status, message, fields? } — fields pour formulaires
```

`compressImage(file)` compresse une image avant upload (utiliser pour photos).

## Types partagés (src/lib/types.ts)

`ListingSummary`, `Proposal`, `CurrentMe`, etc. — importer plutôt que re-déclarer.

## Modération UI

- Formulaire en 4 étapes (publier) avec indicateur de progression, aperçu photos, récapitulatif.
- Grilles d'annonces : `grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4`.
- Listes longues : `max-h-96 overflow-y-auto custom-scrollbar`.
- Boutons ≥ 44px sur mobile ; labels `aria-*` sur les boutons icônes ; focus visible.
- Skeletons pendant les chargements (`ListingCardSkeleton`, `Skeleton`).
- Pagination shadcn ou boutons ‹ › avec numéros.
- Vide → état vide illustré (icône + texte + bouton d'action).
