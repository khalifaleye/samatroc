# SamaTroc — Audit backend initial & architecture retenue

> Date : novembre 2026 — mission « CONSTRUIRE LE BACKEND COMPLET DE SAMATROC »

## 1. État du projet avant mission (audit)

| Composant | Technologie | État |
|---|---|---|
| Frontend | Next.js 16 + TypeScript + Tailwind + shadcn/ui | ✅ Complet (22 vues) |
| Base de données | SQLite via Prisma ORM (`db/custom.db`) | ✅ Opérationnelle |
| Modèle de données | 17 modèles Prisma (User, Profile, Category, City, Listing, ListingImage, Payment, ExchangeProposal, Conversation, Message, Favorite, Notification, Report, Block, AdminLog, SiteSetting, SiteContent + tokens) | ✅ |
| Authentification | Maison : bcrypt + JWT HS256 en cookie httpOnly, rôles USER/ADMIN/SUPER_ADMIN vérifiés côté serveur, rate-limiting | ✅ |
| API | 30+ Route Handlers (listings, payments, conversations, admin…) | ✅ |
| Paiements | Référence unique ST-PAY-…, webhook HMAC-SHA256 (`x-samatroc-signature`), modes TEST/LIVE, `finalizePayment` idempotent applicatif | ✅ |
| Téléversement | Validation MIME + magic bytes + 5 Mo max + noms aléatoires → disque local | ✅ |
| Temps réel | socket.io (exemple), l'app utilise du polling | ⚠️ à basculer |
| Sécurité DB | Aucune (SQLite n'a pas de RLS) | ❌ |

## 2. Écarts entre l'existant et le cahier des charges Supabase

| Exigence § | Cahier des charges | Avant | Solution retenue |
|---|---|---|---|
| 1-3 | PostgreSQL Supabase, 14 tables UUID, migrations versionnées | SQLite/cuid | ✅ 5 migrations SQL (`supabase/migrations/`) |
| 4 | RLS sur toutes les tables | Absente | ✅ Politiques complètes + tests automatisés (55/55) |
| 5 | Supabase Auth + profil auto | Auth maison | ✅ Trigger `handle_new_user` + clients fournis ; bascule documentée (guide 07) |
| 6 | 4 buckets Storage | Disque local | ✅ Migration 0004 + adaptateur dual-mode dans `/api/upload` |
| 7 | Fonctions backend | Logique dans les routes | ✅ Fonctions SQL SECURITY DEFINER (17 fonctions) |
| 8 | Paiement idempotent, jamais côté navigateur | Idempotent applicatif | ✅ Idempotence **en base** (index partiel unique + `verify_payment` service_role) |
| 9 | Realtime | Polling | ✅ Publication + helpers `src/lib/supabase/realtime.ts` |
| 10 | Statistiques depuis la base | Requêtes Prisma | ✅ `admin_stats()` SQL |
| 11 | Seed (catégories, villes, 500 FCFA) | Prisma seed | ✅ `supabase/seed.sql` (aucun faux compte admin) |
| 12-14 | Vercel/GitHub/docs | — | ✅ Guides 01→08 |

## 3. Architecture cible

```
┌──────────────┐   HTTPS    ┌───────────────────────────────┐
│  Navigateur  │───────────▶│  Vercel (Next.js 16, Edge MW) │
└──────────────┘            │  • middleware session refresh │
        │                   │  • Route Handlers /api/*      │
        │ anon key (RLS)    └──────┬───────────────┬────────┘
        ▼                          │ service_role  │ Prisma (bascule, guide 07)
┌──────────────────────────────────▼───────────────▼────────┐
│                     SUPABASE (PostgreSQL 15)               │
│  auth.users ──▶ profiles (RLS)                             │
│  categories ▸ listings ▸ listing_images ▸ payments (RLS)   │
│  conversations ▸ participants ▸ messages (RLS, Realtime)   │
│  favorites / notifications / reports / admin_logs / settings│
│  Storage: listing-images, profile-avatars,                  │
│           exchange-images, support-attachments              │
│  Realtime: messages, notifications, proposals, listings     │
└────────────────────────────────────────────────────────────┘
```

**Deux modes d'exécution coexistent sans se casser :**

| Mode | Déclencheur | Base | Auth | Upload |
|---|---|---|---|---|
| **Démo** (actuel) | variables Supabase vides | SQLite/Prisma | JWT maison | disque local |
| **Supabase** (prod) | `NEXT_PUBLIC_SUPABASE_URL` + clés renseignées | Supabase Postgres | Supabase Auth | Supabase Storage |

## 4. Validation réalisée (faits, pas promesses)

Les migrations ont été **réellement exécutées** sur un PostgreSQL 18 local avec
l'environnement Supabase simulé (schémas `auth`/`storage`, rôles
anon/authenticated/service_role, `auth.uid()`) :

```
bun supabase/tests/run-tests.mjs
══════════ RÉSULTAT : 55 PASS / 0 FAIL ══════════
```

Couverture : création/visibilité annonces, transitions sensibles bloquées,
paiements (création propriétaire, lecture privée, confirmation service_role
uniquement, montant/devise vérifiés, **idempotence**), messagerie (participants,
**usurpation impossible**), favoris privés, propositions (seul destinataire
répond), notifications privées, profil (auto-promotion admin **impossible**),
modération + admin_logs + admin_stats réservés admins, signalements privés,
buckets, publication Realtime, seed.

⚠️ **Honnêteté (règle §15)** : le *projet Supabase réel* n'a pas encore été
créé — cela requiert une action humaine (compte supabase.com, création du
projet, récupération des clés). Tout est prêt pour que cette opération prenne
**moins de 30 minutes** : voir `docs/supabase/01-guide-projet-supabase.md`.

## 5. Arborescence livrée

```
supabase/
├── migrations/
│   ├── 20260101000001_init.sql        (14 tables + 2 référentiels, contraintes)
│   ├── 20260101000002_functions.sql   (17 fonctions SECURITY DEFINER + triggers)
│   ├── 20260101000003_rls.sql         (RLS + politiques + grants colonnes)
│   ├── 20260101000004_storage.sql     (4 buckets + politiques d'accès)
│   └── 20260101000005_realtime.sql    (publication temps réel)
├── seed.sql                           (catégories, villes, paramètres 500 FCFA)
└── tests/
    ├── local_bootstrap.sql            (simulation Supabase — TESTS SEULEMENT)
    └── run-tests.mjs                  (55 vérifications de sécurité)
prisma/schema.supabase.prisma          (schéma Prisma mappé sur les migrations)
src/lib/supabase/                      (clients browser/server/admin + types + realtime)
src/proxy.ts                      (sessions + en-têtes de sécurité)
docs/supabase/                         (guides 01 → 08)
.env.example                           (toutes variables documentées)
```

## 6. Choix d'architecture assumés

1. **RLS = garde-fou client, backend = autorité.** Les politiques RLS protègent
   les accès directs (PostgREST/Realtime avec la clé anon). Le serveur Next.js
   (service_role / Prisma) est le backend de confiance qui exécute
   `verify_payment`, la modération, etc. — jamais le navigateur.
2. **Spec littérale + extras documentés.** Les 14 tables respectent le cahier
   des charges au nom de colonne près ; les extras (`reference`,
   `subcategory_id`, `desired_multiple`, `featured`, `show_phone`, tables
   `cities`/`site_contents`) sont justifiés par l'UI existante et commentés
   dans les migrations.
3. **`payments_one_successful_per_listing_idx`** (index partiel unique) rend
   l'activation double **physiquement impossible** au niveau base, indépendamment
   du code applicatif.
4. **Roles PG intouchables par les colonnes** : `revoke update` + `grant
   update(colonnes sûres)` sur `profiles` — même une requête forgée ne peut
   pas écrire `role` ou `account_status`.
