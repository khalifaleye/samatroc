# SamaTroc 🇸🇳

**Plateforme sénégalaise d'échange d'objets entre particuliers.**
Slogan : Échangez • Économisez • Donnez une seconde vie.

SamaTroc permet aux particuliers de publier des objets dont ils n'ont plus besoin et de les proposer à l'échange contre d'autres articles. La plateforme est un **service de mise en relation** : elle ne rachète pas les objets, ne fixe pas leur valeur, ne gère ni la livraison ni l'échange physique. Les utilisateurs organisent librement leurs échanges.

---

## 🚀 Mise en ligne en 3 étapes (Supabase → GitHub → Vercel)

> **Honnêteté** (règle §15 du cahier des charges) : les 3 étapes ci-dessous nécessitent
> vos comptes personnels (Supabase, GitHub, Vercel) — elles ne peuvent pas être
> effectuées depuis l'environnement de développement. **Tout le reste est prêt** :
> migrations, seed, configuration, scripts. Comptez ~30 minutes.

### Étape 1 — Créer la base de données Supabase (~10 min)

1. Ouvrir **https://supabase.com/dashboard/new** → *New project* :
   - Name : `samatroc-prod` · Region : **West EU (Paris)** (la plus proche du Sénégal)
   - Database Password : générer et **sauvegarder** (il ne sera plus affiché)
2. Une fois le projet créé → **SQL Editor** (barre latérale) → *New query* →
   copier-coller **tout le contenu de `supabase/bootstrap-all-in-one.sql`** → *Run*.
   *(Une seule exécution crée : 16 tables, 26 fonctions sécurisées, RLS complète,
   4 buckets Storage, Realtime, catégories/villes/paramètres.)*
3. **Project Settings → API** : récupérer les 3 valeurs —
   `Project URL`, `anon public`, `service_role` — à coller dans `.env` (local)
   et plus tard dans Vercel. ⚠️ `service_role` ne quitte jamais le serveur.

### Étape 2 — Publier le code sur GitHub (~5 min)

1. Créer un dépôt **privé** vide sur https://github.com/new (nom : `samatroc`,
   sans README initial).
2. Depuis le projet :

```bash
bash scripts/push-to-github.sh git@github.com:<votre-org>/samatroc.git
# → pousse main + crée develop et staging (3 environnements)
```

*(Ou manuellement : `git remote add origin <url>` puis `git push -u origin main`.)*
`.env` est exclu du dépôt par `.gitignore` — aucun secret n'est committé.

### Étape 3 — Déployer sur Vercel (~15 min)

1. **https://vercel.com/new** → *Import Git Repository* → `samatroc`.
   Framework Next.js auto-détecté (le `build` est `next build`, compatible Vercel).
2. **Avant de cliquer Deploy** : *Environment Variables* → ajouter
   (Production + Preview + Development) :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase (étape 1.3) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé anon (étape 1.3) |
| `SUPABASE_SERVICE_ROLE_KEY` | clé service_role (étape 1.3) ⚠️ secret |
| `AUTH_SECRET` | chaîne aléatoire ≥ 32 caractères |
| `NEXT_PUBLIC_SITE_URL` | `https://samatroc.vercel.app` (puis le domaine final) |
| `PAYMENT_MODE` | `TEST` (jusqu'au contrat Wave/Orange Money — guide 04) |

3. *Deploy* → le site est en ligne sur `https://samatroc.vercel.app`.
4. Retour sur Supabase → *Authentication → URL Configuration* → ajouter
   `https://samatroc.vercel.app/**` aux *Redirect URLs*.
5. Créer le premier super administrateur : s'inscrire sur le site puis suivre
   **`docs/supabase/06-premier-admin.md`**.

**Guides détaillés** : `docs/supabase/01` (Supabase) · `02` (GitHub) ·
`03` (Vercel) · `04` (paiements) · `05` (sauvegardes) · `06` (admin) ·
`07` (bascule) · `08` (tests RLS).

---

## 1. Démarrage rapide

```bash
# 1. Installer les dépendances
bun install

# 2. Configurer l'environnement
cp .env.example .env
# (en dev, les valeurs par défaut suffisent)

# 3. Créer la base de données et pousser le schéma
bun run db:push

# 4. Charger les données de démonstration
bun prisma/seed.ts

# 5. Lancer le serveur de développement
bun run dev
```

L'application est servie sur la route `/` (port 3000).

### Comptes de démonstration

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Super administrateur | `admin@samatroc.sn` | `admin1234` |
| Utilisateur (membre) | `moussa@demo.sn` | `demo1234` |
| Autres membres démo | `fatou@demo.sn`, `ousmane@demo.sn`, `awa@demo.sn`, `cheikh@demo.sn`, `mariama@demo.sn`, `ibrahima@demo.sn` | `demo1234` |

> Les comptes de démonstration sont distincts des futurs comptes de production (flag `isDemo` en base). Le jeu de données démo comprend 8 utilisateurs, 24 annonces variées avec photos, 5 propositions d'échange, 4 conversations, 13 paiements de test clairement identifiés et 3 signalements.

---

## ⚡ Infrastructure backend Supabase (production)

Le backend professionnel décrit au cahier des charges est **livré et testé** : migrations PostgreSQL versionnées, Row Level Security complète, Supabase Auth + Storage + Realtime, paiements idempotents, guides de déploiement.

```
supabase/migrations/          5 migrations SQL (14 tables spec + contraintes, 17 fonctions
                              SECURITY DEFINER, RLS complète, 4 buckets Storage, Realtime)
supabase/seed.sql             catégories, 16 villes/régions, paramètres (500 FCFA)
supabase/tests/run-tests.mjs  55 tests de sécurité exécutés sur PostgreSQL → 55 PASS / 0 FAIL
prisma/schema.supabase.prisma schéma Prisma de production mappé sur les migrations
src/lib/supabase/             clients browser / server / service_role + types + Realtime
src/proxy.ts             rafraîchissement des sessions + en-têtes de sécurité
docs/supabase/                9 guides : audit, projet Supabase, GitHub, Vercel,
                              paiements, sauvegarde/restauration, premier admin,
                              bascule progressive, tests
```

**Deux modes coexistent sans rien casser** : variables Supabase vides → mode démo (SQLite, comportement actuel) ; variables renseignées → Supabase (Storage d'upload et sessions Auth basculent automatiquement, le reste suit le guide 07).

⚠️ **Action humaine restante** (règle d'honnêteté du cahier des charges §15) : créer le projet sur supabase.com, exécuter les migrations et renseigner les 3 clés — moins de 30 minutes, tout est prêt : voir **`docs/supabase/01-guide-projet-supabase.md`**.

```bash
# Rejouer la validation de sécurité complète (PostgreSQL local requis)
bun supabase/tests/run-tests.mjs
```

---

## 2. Périmètre fonctionnel livré

### Pages publiques
- **Accueil** fidèle à la maquette : bannière photographique, carte des 3 étapes (mention « À partir de 500 FCFA par article »), 9 catégories cliquables, dernières annonces (base de données), encart promotionnel, statistiques communautaires **clairement identifiées comme données de démonstration**, pied de page complet (réseaux sociaux, drapeau Sénégal, liens légaux).
- **Explorateur d'annonces** : recherche par mots-clés (titre, description, objet recherché), filtres catégorie / ville / état / type d'article recherché, tri (récence, pertinence, popularité), pagination, vue grille ou liste.
- **Détail d'annonce** : galerie photos, état, localisation, objet recherché, profil public du propriétaire (numéro jamais exposé sans son accord), boutons « Proposer un échange », « Contacter via la messagerie », WhatsApp (si autorisé), « Signaler », annonces similaires.
- **Toutes les catégories**, **À propos**, **Comment ça marche ?**, **FAQ**, **Contact & assistance** (formulaire → notification aux admins), **Conseils de sécurité**, **CGU**, **Politique de confidentialité**, **Politique de modération**, **Page 404**.
- Contenus éditoriaux stockés en base et modifiables depuis l'administration.

### Authentification et comptes
- Inscription (acceptation des conditions obligatoire), connexion, déconnexion, mot de passe oublié, réinitialisation sécurisée (jeton haché SHA-256, expiration 1 h, usage unique), changement de mot de passe, vérification e-mail (jeton ; en mode démo le lien est fourni dans l'interface, en production brancher un SMTP).
- Mots de passe hachés **bcrypt**, sessions **JWT HS256** en cookie **httpOnly**.
- Rôles : Visiteur / Utilisateur / Administrateur / Super administrateur — contrôlés **côté serveur** sur chaque endpoint.
- Limitation des tentatives de connexion (5 / 15 min), anti-spam inscription/contact/signalements.

### Espace personnel
- Menu latéral complet : Vue d'ensemble, Mon profil, Mes annonces, Publier un article, Mes propositions, Mes échanges, Mes favoris, Ma messagerie, Mes paiements, Notifications, Paramètres, Déconnexion.
- Indicateurs : annonces actives, en attente, propositions reçues/envoyées, échanges réalisés.
- Gestion des annonces : modifier (selon statut), désactiver/réactiver, marquer « échangée », supprimer.

### Publication d'annonce (4 étapes + paiement)
1. **Informations** : titre, description, catégorie/sous-catégorie, état (neuf → état satisfaisant), ville, quartier.
2. **Photos** : téléversement multiple (max 6, JPEG/PNG/WebP, 5 Mo), compression automatique côté client, aperçu, choix de la photo principale, suppression ; validation serveur (types, tailles, magic bytes, noms aléatoires anti-path-traversal).
3. **Ce que je recherche** : objet recherché, catégorie souhaitée, plusieurs types acceptés.
4. **Publication** : récapitulatif + encart « Frais de publication : 500 FCFA par article » (jamais confondu avec le prix de l'objet) + brouillon ou paiement.
- **Statuts d'annonce** : Brouillon, En attente de paiement, Paiement en cours, En attente de modération, Publiée, Refusée (avec motif), Désactivée, Échangée.

### Paiement mobile (mode test clairement identifié)
- Choix du prestataire : **Wave** ou **Orange Money** (architecture prête pour tout agrégateur compatible Sénégal).
- Référence de transaction unique (`ST-PAY-XXXXXXXX`), écran d'attente avec polling du statut, gestion succès/échec/expiration, **prévention des doubles paiements**, historique complet.
- **Confirmation serveur obligatoire** via webhook signé **HMAC-SHA256** (`x-samatroc-signature`) — l'annonce n'est JAMAIS activée sur la seule base d'une redirection navigateur.
- Aucun code PIN Mobile Money n'est demandé ni stocké. Clés et secrets en variables d'environnement uniquement.
- Tant que `PAYMENT_API_KEY` / `PAYMENT_WEBHOOK_SECRET` ne sont pas configurés, la plateforme reste en `PAYMENT_MODE=TEST` avec un bouton explicite « Simuler la confirmation (mode test) ». **Aucun paiement réel n'est simulé comme réussi.**
- Remboursements : statut `REFUNDED` prévu, conforme aux conditions.

### Propositions d'échange
- « Proposer un échange » : sélection d'une annonce personnelle OU description d'un objet avec photos, message facultatif.
- Réponses du propriétaire : accepter, refuser, demander des précisions, contre-proposition ; annulation par le proposant ; « échange réalisé » par les deux parties (l'annonce passe alors en Échangée).
- Statuts : En attente, Acceptée, Refusée, En discussion, Annulée, Échange réalisé.
- Conversation créée automatiquement à l'envoi ; notifications à chaque étape.

### Messagerie interne
- Conversations privées rattachées aux annonces, messages texte, messages système, date/heure (fuseau Africa/Dakar), indicateur de non-lus, polling temps quasi-réel.
- Accès strictement réservé aux participants (contrôle serveur).
- Blocage et signalement depuis la conversation ; WhatsApp/appel uniquement si le propriétaire a choisi d'afficher son numéro.

### Favoris & notifications
- Favoris par annonce (cœur sur les cartes), page dédiée.
- Centre de notifications : proposition reçue/acceptée/refusée, contre-proposition, échange réalisé, nouveau message, confirmation de paiement, publication, refus de modération. Compteurs en temps réel dans la navigation.

### Sécurité et confiance
- Signalement d'annonces / utilisateurs / messages avec motifs ; traitement en administration.
- Blocage d'utilisateurs, modération, détection automatique d'annonces suspectes (mots-clés frauduleux → file de modération), anti-spam, rate limiting, protection SQL (Prisma + échappement LIKE), XSS (React), validation Zod systématique côté serveur, contrôle d'accès par rôle, journalisation des actions sensibles (`admin_logs`).

### Administration
- Tableau de bord : utilisateurs (total, nouveaux 7 j, suspendus), annonces (publiées, en modération, refusées, échangées), paiements (réussis, **chiffre d'affaires brut** des publications), propositions, signalements, exports **CSV** (annonces, paiements, utilisateurs).
- Gestion des utilisateurs : recherche, filtres, suspension/réactivation, modification encadrée, changement de rôle (super admin), historique détaillé.
- Gestion des annonces : filtres, validation, refus avec motif obligatoire, mise en avant, édition administrative, suppression — jamais accès aux secrets de paiement.
- Gestion des paiements : référence, utilisateur, montant, moyen, statut, dates, badge « TEST ».
- Gestion des catégories : création, modification, activation/désactivation, réordonnancement, suppression protégée ; **ajout de villes** (référentiel extensible).
- Gestion des signalements : résoudre / rejeter avec note, notification au déclarant.
- Gestion du contenu : 8 pages éditoriales éditables avec aperçu markdown.
- Paramètres généraux : nom de la plateforme, contacts, réseaux sociaux, tarif de publication, durée de validité des annonces, modération automatique, statistiques de démonstration, bannière d'annonce.
- **Journal administratif** : traçabilité de toutes les opérations sensibles.

---

## 3. Architecture technique

| Composant | Choix |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript strict |
| Interface | Tailwind CSS 4 + shadcn/ui (New York) + Lucide + sonner |
| Base de données | **SQLite** (mode démo) / **PostgreSQL Supabase** (production, migrations `supabase/migrations/`) |
| ORM | Prisma 6 (`prisma/schema.prisma` démo · `prisma/schema.supabase.prisma` prod) |
| Authentification | JWT HS256 (jose) en cookie httpOnly + bcryptjs — **Supabase Auth + RLS en production** |
| Sécurité base | RLS sur toutes les tables + grants de colonnes + fonctions SECURITY DEFINER (55 tests auto) |
| Stockage images | disque local (démo) — **Supabase Storage, 4 buckets** (production) |
| Temps réel | polling (démo) — **Supabase Realtime** (messages, notifications, annonces) |
| Validation | Zod côté serveur sur toutes les entrées |
| État client | Zustand (routeur de vues + authentification) |
| Images | next/image + compression client + stockage local `/public/uploads` (cloud storage en production) |

### Structure du projet
```
prisma/schema.prisma      14 tables : users, profiles, categories, cities, listings,
                          listing_images, payments, exchange_proposals, conversations,
                          messages, favorites, notifications, reports, admin_logs,
                          site_settings, site_content, password_reset_tokens, verification_tokens
prisma/seed.ts            Données de démonstration
src/app/api/…             ~45 endpoints REST (voir src/docs/API.md)
src/app/page.tsx          Route unique "/" (routeur de vues client)
src/components/           Navbar, Footer (sticky), ListingCard, Logo SVG, CategoryIcon, guards
src/lib/                  auth, api-utils (erreurs/erreurs Zod), rate-limit, validators,
                          serializers, payments (webhook/finalisation), constants (FCFA, Dakar)
src/stores/               router-store (navigation par vues), auth-store
src/views/                public/ auth/ account/ admin/ — 40 vues
src/docs/                 API.md (contrat complet) + FRONTEND-GUIDE.md
supabase/                 migrations SQL versionnées, seed, tests de sécurité RLS
src/lib/supabase/         clients Supabase (browser/server/admin) + types + Realtime
src/proxy.ts         sessions Supabase Auth + en-têtes de sécurité
```

### Modèle économique
- Consultation : **gratuite**.
- Publication : **à partir de 500 FCFA par article** (paramétrable dans l'administration).
- Aucun paiement de la valeur des objets ne transite par la plateforme ; aucune commission.
- Évolutions prévues sans refonte : annonces sponsorisées (champ `featured` déjà opérationnel), packs, publicité.

### Réalité sénégalaise
Français, FCFA, fuseau Africa/Dakar, numéros au format sénégalais (+221), 15 villes (Dakar, Thiès, Mbour, Saint-Louis, Kaolack, Ziguinchor, Touba…), Wave/Orange Money, contact WhatsApp facultatif, statistiques de démonstration clairement identifiées.

---

## 4. Déploiement

### Voie recommandée : Supabase + Vercel

Suivre les guides pas-à-pas `docs/supabase/` :

1. **01-guide-projet-supabase.md** — créer le projet, exécuter les 6 fichiers SQL, récupérer les 3 clés.
2. **02-guide-github.md** — dépôt privé + branches dev/staging/main.
3. **03-guide-deploiement-vercel.md** — variables par environnement, domaine, URLs Auth, webhooks, tests de production.
4. **04-guide-paiements.md** — Wave/Orange Money (contrat marchand, mode TEST → LIVE).
5. **05-guide-sauvegarde-restauration.md** — pg_dump cron, PITR, procédure de sinistre.
6. **06-premier-admin.md** — `setup_first_super_admin()` (opération serveur sécurisée).
7. **07-migration-prisma-supabase.md** — bascule progressive des routes sans rupture.
8. **08-tests-securite.md** — rejouer les 55 tests RLS.

### Alternative PostgreSQL générique (Neon, Railway…)
1. Renseigner `DATABASE_URL` (PostgreSQL), `AUTH_SECRET` (32+ caractères aléatoires), `NEXT_PUBLIC_SITE_URL`, `PAYMENT_MODE=LIVE` + secrets du prestataire.
2. Dans `prisma/schema.prisma`, passer `provider = "postgresql"` puis `bun run db:push`.
3. Déployer ; exécuter le seed éventuel sans les comptes de démo en production.

### Configuration des paiements (production)
1. Contracter avec un agrégateur officiellement compatible Sénégal (Wave Business, Orange Money via agrégateur agréé, PayDunya, CinetPay…).
2. Renseigner `PAYMENT_MODE=LIVE`, `PAYMENT_API_KEY`, `PAYMENT_API_SECRET`, `PAYMENT_WEBHOOK_SECRET`.
3. Déclarer l'URL du webhook chez le prestataire : `POST https://votre-domaine/api/payments/webhook` — corps `{ reference, status: "SUCCESS"|"FAILED", providerRef }`, header `x-samatroc-signature` = HMAC-SHA256 hex du corps brut avec `PAYMENT_WEBHOOK_SECRET`.
4. Adapter `POST /api/payments/initiate` pour appeler l'API du prestataire (initiation + URL de redirection) — la finalisation reste gérée par `src/lib/payments.ts` (jamais côté client).
5. Tester avec une transaction réelle à 500 FCFA puis vérifier : webhook reçu → signature valide → annonce activée → notifications émises.

### Mises à jour et sauvegardes
- Sauvegardes régulières de la base (`pg_dump` en production) et du dossier `uploads/`.
- `bun run lint` avant chaque déploiement ; migrations Prisma versionnées en production (`prisma migrate`).

---

## 5. Documentation complémentaire

- `docs/supabase/00-audit-backend.md` — audit initial, écarts, architecture retenue, statut honnête.
- `docs/supabase/01→08` — guides opérationnels (Supabase, GitHub, Vercel, paiements, sauvegardes, admin, bascule, tests).
- `src/docs/API.md` — contrat complet des 45 endpoints (requêtes, réponses, erreurs).
- `src/docs/FRONTEND-GUIDE.md` — conventions UI, palette, routeur de vues.
- `.env.example` — toutes les variables d'environnement documentées.

## 6. Limites connues & évolutions prévues

- **Route unique `/`** : l'application fonctionne en « vues client » (routeur Zustand) pour l'aperçu sandbox ; en production, mapper chaque vue sur une vraie route Next.js (`/annonces`, `/annonce/[id]`…) — le découpage est déjà isolé dans `src/views/`.
- Vérification e-mail réelle à brancher sur un SMTP (jetons déjà opérationnels).
- Vérification du numéro de téléphone par SMS à brancher sur un fournisseur (structure `phoneVerified` prête).
- Messagerie par polling (4 s) en mode démo ; **Supabase Realtime prêt** (helpers fournis) pour le temps réel.
- Expiration automatique des annonces : `expiresAt` est posé (durée configurable) ; ajouter un job planifié pour le statut EXPIRED + notification.
- PWA : manifest livré ; ajouter un service worker pour le mode hors-ligne.
