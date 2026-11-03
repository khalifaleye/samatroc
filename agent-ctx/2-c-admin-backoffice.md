# Task 2-c — Back-office administrateur (views/admin)

## Résumé
Création du back-office SamaTroc complet : 11 fichiers dans `src/views/admin/`, aucun autre fichier modifié. ESLint (dossier admin) : 0 erreur. `tsc --noEmit` filtré sur `views/admin` : 0 erreur.

## Fichiers créés
| Fichier | Contenu |
|---|---|
| `admin-shared.tsx` | Helpers partagés : `handleAdminError` (401/403 → toast + navigate("home")), `useDebouncedValue` (400 ms), `AdminPagination` (‹ › + page X/Y), `InitialsAvatar`, `AdminEmptyState`, `AdminTableSkeleton`, `AdminStatusBadge` |
| `admin-shell.tsx` | Conteneur layout (max-w-[1400px], sidebar sticky Card 240px, badge rôle Super admin/Admin, bouton « Retour au site », menu chips mobile scrollable, switch de rendu par `view`, titre H1 + sous-titre par section) |
| `dashboard.tsx` | GET /api/admin/stats : 6 cartes KPI (badge « +N cette semaine », mango si modération > 0, rouge si signalements > 0), 4 cartes secondaires, 3 boutons export CSV (window.open /api/admin/export?type=...), derniers paiements (table), signalements récents (lien → admin-reports), dernières actions admin |
| `users.tsx` | GET /api/admin/users (recherche debounce, filtres statut/rôle, pagination) ; DropdownMenu : détails (GET /users/{id} avec annonces/paiements/compteurs), modifier (PATCH edit), suspendre/réactiver (AlertDialog + PATCH), changer le rôle (visible seulement SUPER_ADMIN) ; badge « Démo » |
| `listings.tsx` | GET /api/admin/listings (+ compteur modération via requête status=PENDING_MODERATION, catégories via /api/categories) ; encart mango « N en attente » avec filtre rapide ; actions : voir (navigate listing), valider (publish), refuser (Dialog motif REQUIS), mettre en avant/retirer (feature/unfeature), modifier (Dialog title/city/wantedText/description), supprimer (AlertDialog DELETE) |
| `payments.tsx` | GET /api/admin/payments : carte CA brut + note sécurité, filtre référence/statut, table complète (badge TEST mango, moyen provider/method, payé le ou —) |
| `categories.tsx` | GET/POST/PATCH/DELETE /api/admin/categories + POST reorder : Switch isActive, réordonnancement optimiste ChevronUp/Down (ids complets après swap), Dialog création/édition (Select icônes CATEGORY_ICON_NAMES avec aperçu, Input type="color", ordre), suppression avec 409 géré (toast du message serveur « Désactivez-la plutôt ») |
| `reports.tsx` | GET /api/admin/reports?status= : onglets En attente/Résolus/Rejetés/Tous, cartes riches (badge targetType, reportReasonLabel, détails italique, cible + lien annonce, déclarant, « Traité par X — résolution »), Résoudre/Rejeter via Dialogs + PATCH |
| `content.tsx` | GET /api/admin/content + PUT : Tabs 8 pages (labels FR, * si page absente → « Créer le contenu »), brouillons par page (pas de perte au changement d'onglet), Input titre + Textarea min-h-[400px] font-mono + compteur, panneau aperçu react-markdown stylé (palette forest/mint), validation titre ≥2 / corps ≥10 (contraintes zod serveur) |
| `settings.tsx` | GET/PUT /api/admin/settings : cartes Général / Publication (frais FCFA, validité jours, Switch auto_moderate ↔ "true"/"false") / Statistiques démo (encart mango + note) / Réseaux sociaux / Bannière (aperçu en direct), tout reste en string |
| `logs.tsx` | GET /api/admin/logs?page= : table (date+heure Africa/Dakar, admin, action code mono, cible type:id, détails tronqués avec title tooltip), pagination, note traçabilité |

## Endpoints consommés
GET /api/admin/stats · GET/PATCH /api/admin/users[/:id] · GET/PATCH/DELETE /api/admin/listings[/:id] · GET /api/admin/payments · GET/PATCH /api/admin/reports[/:id] · GET/POST /api/admin/categories, PATCH/DELETE /api/admin/categories/:id, POST /api/admin/categories/reorder · GET/PUT /api/admin/content · GET/PUT /api/admin/settings · GET /api/admin/logs · GET /api/admin/export?type=users|listings|payments · GET /api/categories (filtre annonces)

## Décisions notables
- **Édition d'annonce** : la route PATCH n'a pas d'action "edit" seule ; toute `action` mute une donnée. Solution retenue : `action = listing.featured ? "feature" : "unfeature"` + `edits` → le champ `featured` reste inchangé pendant l'édition (comportement confirmé en lisant `src/app/api/admin/listings/[id]/route.ts` et `adminListingActionSchema`).
- **Compteur modération** : le endpoint listings ne renvoie pas le total PENDING_MODERATION globalement → requête dédiée `/api/admin/listings?status=PENDING_MODERATION&page=1` (champ `total`), rafraîchie après chaque action de modération.
- 11e fichier `admin-shared.tsx` = helpers communs (hors périmètre « section », évite la duplication dans les 10 vues).
- Navigation : toutes les clés `admin-*` y compris `admin-logs` sont gérées par le switch du shell (app-router actuel n'enregistre pas `admin-logs` ; hors de mon périmètre de le modifier).
- Fetchs en chemins relatifs, erreurs 401/403 → toast + navigate("home"), toasts sonner partout, palette forest/mint/mango uniquement, aucun emoji, textes 100 % FR, tables en overflow-x-auto + custom-scrollbar, cibles tactiles ≥ 36-44 px, aria-labels sur les boutons icônes.

## Vérifications
- `bunx eslint src/views/admin/` → 0 problème.
- `bunx tsc --noEmit | grep views/admin` → vide.
- Les 8 erreurs lint restantes du projet sont dans `views/auth` / `views/public` (autres tâches).
- dev.log : plus aucune erreur « Module not found » sur `@/views/admin/*` (restantes = vues public/account d'autres agents).
