# SamaTroc — Contrat API (source de vérité)

> Version 1.0 — Toutes les routes sont préfixées `/api`. Les réponses sont en JSON.
> Authentification : cookie httpOnly `samatroc_session` (JWT HS256) posé par /api/auth/login|register.
> Le client n'a JAMAIS accès à des secrets.

## Format des réponses

- Succès : `200` avec le corps décrit ci-dessous (souvent `{ ... }` direct).
- Erreur : status 400/401/403/404/409/429/500 avec `{ "error": "message", "fields": { "champ": "message" } }`.
  `fields` est présent uniquement pour les erreurs de validation (400).
- 401 = non connecté. 403 = connecté mais interdit.

## Utilisateur courant (`CurrentMe`)

```ts
{
  id, email, firstName, lastName, phone, avatarUrl, city,
  role: "USER" | "ADMIN" | "SUPER_ADMIN",
  status: "ACTIVE" | "SUSPENDED",
  emailVerified, phoneVerified, createdAt,
  profile: { bio, quartier, showPhone, whatsappEnabled } | null,
  unreadNotifications: number, unreadMessages: number
}
```

---

## 1. Authentification

| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| POST | `/api/auth/register` | `{ firstName, lastName, email, password, phone?, city?, acceptTerms: true }` | `{ user: CurrentMe, devVerifyToken: string \| null }` + cookie |
| POST | `/api/auth/login` | `{ email, password }` | `{ user: CurrentMe }` + cookie |
| POST | `/api/auth/logout` | — | `{ ok: true }` |
| GET | `/api/auth/me` | — | `{ user: CurrentMe \| null }` |
| POST | `/api/auth/forgot-password` | `{ email }` | `{ ok: true, devResetToken?: string }` (token retourné uniquement hors production) |
| POST | `/api/auth/reset-password` | `{ token, password }` | `{ ok: true }` |
| POST | `/api/auth/change-password` | `{ currentPassword, newPassword }` (auth) | `{ ok: true }` |
| POST | `/api/auth/verify-email` | `{ token }` | `{ ok: true }` |

Limites anti-abus : login 5 essais / 15 min (par email+IP), register 3/h, forgot 3/h.

## 2. Utilisateurs

| Méthode | Route | Description |
|---|---|---|
| PATCH | `/api/users/me` | Corps partiel `{ firstName?, lastName?, phone?, city?, avatarUrl?, bio?, quartier?, showPhone?, whatsappEnabled? }` → `{ user }` |
| GET | `/api/users/me/dashboard` | `{ activeListings, pendingListings, proposalsReceived, proposalsSent, completedExchanges, favoritesCount, unreadMessages, unreadNotifications, myActiveListings: Listing[], recentProposals: Proposal[], recentNotifications: Notification[] }` |
| GET | `/api/users/[id]` | Profil public → `{ user: { id, firstName, lastName, avatarUrl, city, memberSince, listingsCount, showPhone, phone?, whatsappEnabled }, listings: Listing[] }` (phone présent uniquement si showPhone=true) |
| POST | `/api/users/[id]/block` | Bloquer/débloquer → `{ blocked: boolean }` |

## 3. Annonces (Listing)

**`ListingSummary`** (carte) :
```ts
{
  id, reference, title, description, condition: "NEUF"|"TRES_BON"|"BON"|"SATISFAISANT",
  city, quartier, wantedText, wantedCategory, wantedMultiple, status, featured,
  viewsCount, publishedAt, createdAt, expiresAt, fees: 500,
  category: { id, name, slug, icon, color } | null,
  images: [{ url, isPrimary }], // triées, primaire d'abord
  owner: { id, firstName, lastName, avatarUrl } ,
  isFavorite: boolean // si connecté
}
```

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/listings` | Recherche publique. Query : `q` (mots-clés titre/description/wantedText), `category` (slug), `city`, `condition`, `wanted` (type d'article recherché), `sort` (`recent`\|`relevance`\|`popular`), `page`, `pageSize` (def 12), `ownerId`, `status` (def PUBLISHED ; accepte csv), `featured` | → `{ listings: ListingSummary[], total, page, pageSize, totalPages }` |
| POST | `/api/listings` | Création (auth). Corps `ListingInput` : `{ title, description, categoryId, subcategoryId?, condition, city, quartier?, wantedText, wantedCategory?, wantedMultiple, images: [{url, isPrimary}], saveAsDraft }` → `{ listing }`. Status final : DRAFT ou PENDING_PAYMENT. Champs suspects → `moderationNote` renseignée |
| GET | `/api/listings/[id]` | Détail public → `{ listing: ListingSummary & { owner: { ...profil public, memberSince, whatsappEnabled, showPhone, phone? }, subcategory? }, isOwner, isFavorite, similar: ListingSummary[] }` (+1 vue) |
| PATCH | `/api/listings/[id]` | MAJ (propriétaire, statut ≠ PUBLISHED non payé : titre/desc/condition/wanted éditables si DRAFT/PENDING_PAYMENT/PENDING_MODERATION/REFUSED ; ville/quartier éditables toujours). Corps = ListingInput partiel → `{ listing }` |
| DELETE | `/api/listings/[id]` | Suppression (propriétaire si DRAFT/PENDING_PAYMENT/REFUSED/DEACTIVATED ; admin toujours) → `{ ok: true }` |
| POST | `/api/listings/[id]/status` | `{ status: "PUBLISHED"|"DEACTIVATED"|"EXCHANGED" }` (propriétaire). Transitions permises : PUBLISHED↔DEACTIVATED, PUBLISHED/DEACTIVATED→EXCHANGED, EXCHANGED→DEACTIVATED → `{ listing }` |
| POST | `/api/listings/[id]/favorite` | Toggle favori (auth) → `{ isFavorite }` |
| GET | `/api/my/listings` | Mes annonces (auth) → `{ listings: ListingSummary[] }` triées par date desc |

## 4. Propositions d'échange

**`Proposal`** :
```ts
{
  id, status: "PENDING"|"ACCEPTED"|"REFUSED"|"DISCUSSING"|"CANCELLED"|"COMPLETED",
  message, counterText, offeredText, offeredImages: string[], createdAt, respondedAt, completedAt,
  listing: ListingSummary, // annonce ciblée
  offeredListing: ListingSummary | null,
  proposer: { id, firstName, lastName, avatarUrl },
  owner: { id, firstName, lastName, avatarUrl },
  direction: "sent" | "received" // relatif à l'appelant
}
```

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/listings/[id]/proposals` | Créer une proposition (auth, pas sur sa propre annonce, annonce PUBLISHED, pas de doublon PENDING du même proposer). Corps : `{ offeredListingId?, offeredText?, images?: url[], message? }` → `{ proposal }`. Effets : notification au propriétaire + conversation auto-créée avec message système |
| GET | `/api/proposals?box=sent\|received&status=` | Mes propositions (auth) → `{ proposals: Proposal[] }` |
| PATCH | `/api/proposals/[id]` | Répondre. Corps `{ action, counterText? }` : `accept`/`refuse`/`discuss`/`counter` (propriétaire), `cancel` (proposer, si PENDING), `complete` (les deux, si ACCEPTED → COMPLETED + annonce EXCHANGED) → `{ proposal }`. Notifications à chaque action |

## 5. Messagerie

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/conversations` | Mes conversations → `{ conversations: [{ id, listing: {id,title,images}|null, other: {id, firstName, lastName, avatarUrl}, lastMessage: { content, type, senderId, createdAt }, unreadCount, lastMessageAt }] }` |
| POST | `/api/conversations` | Démarrer : `{ userId, listingId?, message }` → `{ conversationId }` (réutilise l'existant) |
| GET | `/api/conversations/[id]` | Détail (participants uniquement) → `{ conversation: { id, listing, other: User, blocked }, messages: [{ id, senderId, type: "TEXT"|"IMAGE"|"SYSTEM", content, imageUrl, readAt, createdAt }] }` — marque automatiquement les messages entrants comme lus |
| POST | `/api/conversations/[id]/messages` | `{ content, imageUrl? }` → `{ message }` (refusé si bloqué) |
| POST | `/api/conversations/[id]/read` | Marque tout lu → `{ ok }` |
| POST | `/api/conversations/[id]/block` | Bloque l'autre participant → `{ blocked: true }` |
| POST | `/api/conversations/[id]/report` | `{ reason, details? }` → signale l'autre utilisateur → `{ ok }` |

## 6. Favoris, notifications, signalements

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/favorites` | → `{ listings: ListingSummary[] }` |
| GET | `/api/notifications` | → `{ notifications: [{ id, type, title, body, linkView, linkParams, readAt, createdAt }], unreadCount }` |
| POST | `/api/notifications/read` | `{ ids?: string[], all?: true }` → `{ ok }` |
| POST | `/api/reports` | `{ targetType: "LISTING"|"USER"|"MESSAGE", targetId, reason: "FRAUDE"|"CONTENU_INTERDIT"|"OFFENSANT"|"CONTREFACON"|"FAUX_PROFIL"|"AUTRE", details? }` → `{ ok: true }` |

## 7. Paiements (mode test clairement identifié)

Le montant = frais de publication (500 FCFA par défaut, configurable). **Jamais** le prix de l'objet.

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/payments/config` | `{ mode: "TEST"|"LIVE", fee: number, currency: "FCFA", providers: [{id:"WAVE"|"ORANGE_MONEY"|"TEST", name, description, color}] }` |
| POST | `/api/payments/initiate` | `{ listingId, provider, phone? }` (auth, annonce à soi en PENDING_PAYMENT) → `{ payment: { reference, amount, status, provider }, instructions: string }`. Idempotent : réutilise le paiement PENDING existant |
| GET | `/api/payments/[reference]` | → `{ payment: { reference, amount, status, provider, listingId, paidAt } }` (pour polling) |
| POST | `/api/payments/webhook` | Webhook prestataire. Header `x-samatroc-signature` = HMAC-SHA256(hex) du corps brut avec `PAYMENT_WEBHOOK_SECRET`. Corps : `{ reference, status: "SUCCESS"|"FAILED", providerRef? }` → `{ received: true }`. À SUCCESS : paiement SUCCESS + activation serveur de l'annonce (PENDING_MODERATION si suspect ou auto_moderate=true, sinon PUBLISHED) + notifications |
| POST | `/api/payments/test-confirm` | Uniquement si `PAYMENT_MODE=TEST`. `{ reference }` → même effet que webhook SUCCESS. Bouton UI clairement libellé « Simuler la confirmation (mode test) » |
| GET | `/api/my/payments` | Historique → `{ payments: [{ reference, amount, status, provider, method, createdAt, paidAt, listing: {id,title,images}|null }] }` |

## 8. Téléversement

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/upload` | FormData `files` (1..6 fichiers image jpeg/png/webp ≤ 5 Mo) (auth) → `{ urls: string[] }`. Fichiers servis depuis `/uploads/...`. Validation type + taille + magic bytes côté serveur |

## 9. Référentiels publics

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/categories` | → `{ categories: [{ id, name, slug, icon, color, sortOrder, count }] }` (actives, triées) |
| GET | `/api/cities` | → `{ cities: [{ id, name, region }] }` |
| GET | `/api/stats` | → `{ stats: { users, listings, exchanges, isDemo: true }, real: { users, listings, exchanges } }` (données de démo clairement identifiées) |
| GET | `/api/content/[page]` | page ∈ `ABOUT|HOW_IT_WORKS|FAQ|SAFETY|CGU|PRIVACY|MODERATION|CONTACT` → `{ content: { page, title, body } }` (404 si absent → fallback) |
| POST | `/api/contact` | `{ name, email, subject, message }` → `{ ok: true }` (notification aux admins) |

## 10. Administration (role ADMIN / SUPER_ADMIN — contrôle serveur)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/admin/stats` | `{ users: {total, new7d, suspended}, listings: {published, pendingModeration, pendingPayment, refused, exchanged, total}, payments: {success, revenue, test}, proposals: {total, completed}, reports: {pending}, recentPayments: [...], recentReports: [...], recentLogs: [...] }` |
| GET | `/api/admin/users?q=&status=&role=&page=` | `{ users: [User + counts], total, page, pageSize, totalPages }` |
| PATCH | `/api/admin/users/[id]` | `{ action: "suspend"|"reactivate"|"setRole"|"edit", role?, firstName?, lastName?, phone?, city? }` → `{ user }` (journalisé) |
| GET | `/api/admin/listings?q=&status=&category=&page=` | `{ listings, total, totalPages }` |
| PATCH | `/api/admin/listings/[id]` | `{ action: "publish"|"refuse"|"feature"|"unfeature", reason?, edits? {title?, description?, city?, wantedText?} }` → `{ listing }` (notification + journal) |
| DELETE | `/api/admin/listings/[id]` | Suppression → `{ ok }` (journal) |
| GET | `/api/admin/payments?status=&q=&page=` | `{ payments, total, totalPages, revenue }` |
| GET | `/api/admin/reports?status=` | `{ reports: [{ ...Report, reporter: {...}, targetPreview }] }` |
| PATCH | `/api/admin/reports/[id]` | `{ action: "resolve"|"dismiss", resolution? }` → `{ report }` |
| GET | `/api/admin/categories` | toutes (avec inactives) → `{ categories }` |
| POST | `/api/admin/categories` | `{ name, icon, color, sortOrder, parentId? }` → `{ category }` |
| PATCH | `/api/admin/categories/[id]` | MAJ partielle (name/icon/color/sortOrder/parentId/isActive) → `{ category }` |
| DELETE | `/api/admin/categories/[id]` | 409 si annonces attachées → `{ ok }` |
| POST | `/api/admin/categories/reorder` | `{ ids: string[] }` → `{ ok }` |
| GET | `/api/admin/cities` | → `{ cities }` ; POST `{ name, region? }` ; DELETE `/[id]` |
| GET | `/api/admin/content` | → `{ contents: [{ page, title, body, updatedAt }] }` |
| PUT | `/api/admin/content` | `{ page, title, body }` → `{ content }` (journal) |
| GET | `/api/admin/settings` | → `{ settings: { key: value } }` |
| PUT | `/api/admin/settings` | `{ settings: {key: value} }` → `{ settings }` (journal) |
| GET | `/api/admin/logs?page=` | `{ logs: [{ id, admin: {firstName,lastName}, action, targetType, targetId, details, createdAt }], total }` |
| GET | `/api/admin/export?type=users\|listings\|payments` | CSV téléchargeable |

### Clés de `site_settings`

`platform_name`, `platform_email`, `platform_phone`, `publication_fee`, `listing_validity_days`, `auto_moderate` ("true"/"false"), `announcement_banner`, `facebook_url`, `instagram_url`, `tiktok_url`, `youtube_url`, `whatsapp_number`, `demo_stats_users`, `demo_stats_listings`, `demo_stats_exchanges`
