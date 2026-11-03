-- ============================================================================
-- SAMATROC 🇸🇳 — MIGRATION 0001 : SCHÉMA INITIAL POSTGRESQL
-- Plateforme sénégalaise d'échange d'objets entre particuliers
-- ----------------------------------------------------------------------------
-- Exécutable via :
--   supabase db push            (Supabase CLI)
--   Dashboard Supabase > SQL Editor
--   psql "$DATABASE_URL" -f supabase/migrations/20260101000001_init.sql
--
-- Contenu :
--   • Extensions
--   • Types énumérés (statuts contrôlés en base)
--   • Les 14 tables du cahier des charges (+ 2 tables référentiels : cities,
--     site_contents — documentées comme ajout applicatif)
--   • Clés étrangères, index, contraintes (CHECK / UNIQUE)
--   • Contrainte d'intégrité paiement : un seul paiement RÉUSSI par annonce
--     (index partiel unique) → empêche les activations multiples.
--
-- Colonnes additionnelles par rapport au cahier des charges (justifiées par
-- l'interface existante, maintenues pour compatibilité) :
--   listings.reference        : référence publique ST-ANN-XXXXXX affichée à l'écran
--   listings.subcategory_id   : sous-catégorie (l'app gère 2 niveaux)
--   listings.desired_multiple : « plusieurs articles recherchés » (wizard)
--   listings.featured         : mise en avant payante/admin
--   listings.moderation_note / rejection_reason : traçabilité modération
--   profiles.show_phone       : contrôle d'affichage du téléphone (UI existante)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid(), digest()
create extension if not exists pg_trgm;    -- recherche plein-texte légère (titres)

-- ---------------------------------------------------------------------------
-- TYPES ÉNUMÉRÉS
-- ---------------------------------------------------------------------------
create type public.user_role         as enum ('USER', 'ADMIN', 'SUPER_ADMIN');
create type public.account_status    as enum ('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');
create type public.item_condition    as enum ('NEUF', 'TRES_BON', 'BON', 'SATISFAISANT');
create type public.listing_status    as enum (
  'DRAFT', 'PENDING_PAYMENT', 'PENDING_REVIEW', 'PUBLISHED',
  'REJECTED', 'INACTIVE', 'EXCHANGED', 'DELETED'
);
create type public.payment_status    as enum (
  'PENDING', 'PROCESSING', 'SUCCESSFUL', 'FAILED', 'CANCELLED', 'REFUNDED'
);
create type public.payment_provider  as enum ('WAVE', 'ORANGE_MONEY', 'TEST');
create type public.proposal_status   as enum (
  'PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'CANCELLED', 'COMPLETED'
);
create type public.report_status     as enum ('PENDING', 'RESOLVED', 'DISMISSED');

-- ---------------------------------------------------------------------------
-- TABLE 1 : profiles — profil applicatif relié à auth.users (Supabase Auth)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text not null check (char_length(full_name) between 2 and 120),
  username       text not null unique check (username ~ '^[a-z0-9_\.]{3,30}$'),
  email          text not null unique check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone          text check (phone is null or phone ~ '^\+?[0-9[:space:]\-]{7,20}$'),
  avatar_url     text,
  city           text,
  region         text,
  neighborhood   text,
  role           public.user_role      not null default 'USER',
  account_status public.account_status not null default 'ACTIVE',
  phone_verified boolean               not null default false,
  show_phone     boolean               not null default false,
  created_at     timestamptz           not null default now(),
  updated_at     timestamptz           not null default now()
);
comment on table public.profiles is
  'Profils utilisateurs. RÔLE ET STATUT CONTRÔLÉS SERVEUR UNIQUEMENT : aucune mise à jour client possible (voir grants de la migration RLS).';

create index profiles_city_idx   on public.profiles (city);
create index profiles_role_idx   on public.profiles (role);
create index profiles_status_idx on public.profiles (account_status);

-- ---------------------------------------------------------------------------
-- TABLE 2 : categories — arborescence (catégorie → sous-catégorie)
-- ---------------------------------------------------------------------------
create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 2 and 80),
  slug          text not null unique check (slug ~ '^[a-z0-9\-]{2,80}$'),
  description   text,
  icon          text default 'package',
  image_url     text,
  parent_id     uuid references public.categories (id) on delete cascade,
  is_active     boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at    timestamptz not null default now()
);

create index categories_parent_idx on public.categories (parent_id);
create index categories_order_idx  on public.categories (display_order);
create index categories_active_idx on public.categories (is_active);

-- ---------------------------------------------------------------------------
-- TABLE 3 : listings — annonces
-- ---------------------------------------------------------------------------
create table public.listings (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  category_id         uuid not null references public.categories (id),
  subcategory_id      uuid references public.categories (id),
  title               text not null check (char_length(title) between 3 and 150),
  slug                text not null unique check (slug ~ '^[a-z0-9\-]{3,200}$'),
  reference           text not null unique default ('ST-ANN-' || upper(substr(md5(random()::text), 1, 6))),
  description         text not null check (char_length(description) between 10 and 10000),
  condition           public.item_condition not null default 'BON',
  city                text not null,
  region              text,
  neighborhood        text,
  desired_item        text not null,
  desired_category_id uuid references public.categories (id) on delete set null,
  desired_multiple    boolean not null default false,
  status              public.listing_status not null default 'DRAFT',
  publication_fee     integer not null default 500 check (publication_fee >= 500), -- tarif minimum 500 FCFA
  payment_id          uuid,           -- FK ajoutée après la table payments (dépendance circulaire)
  moderation_note     text,
  rejection_reason    text,
  featured            boolean not null default false,
  views_count         integer not null default 0 check (views_count >= 0),
  published_at        timestamptz,
  expires_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index listings_status_idx        on public.listings (status);
create index listings_user_idx          on public.listings (user_id);
create index listings_category_idx      on public.listings (category_id);
create index listings_city_idx          on public.listings (city);
create index listings_published_idx     on public.listings (published_at desc);
create index listings_title_trgm_idx    on public.listings using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- TABLE 4 : listing_images — plusieurs photos par annonce
-- ---------------------------------------------------------------------------
create table public.listing_images (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings (id) on delete cascade,
  image_url     text not null,
  storage_path  text,                       -- chemin dans le bucket (suppression sécurisée)
  is_primary    boolean not null default false,
  display_order integer not null default 0 check (display_order >= 0),
  created_at    timestamptz not null default now()
);

create index listing_images_listing_idx on public.listing_images (listing_id);
-- Une seule image principale par annonce :
create unique index listing_images_one_primary_idx
  on public.listing_images (listing_id) where is_primary;

-- ---------------------------------------------------------------------------
-- TABLE 5 : payments — frais de publication (Wave / Orange Money)
-- ---------------------------------------------------------------------------
create table public.payments (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles (id) on delete cascade,
  listing_id              uuid references public.listings (id) on delete set null,
  amount                  integer not null check (amount >= 500),   -- minimum 500 FCFA
  currency                text    not null default 'XOF' check (currency in ('XOF')),
  payment_provider        public.payment_provider not null,
  transaction_reference   text    not null unique default ('ST-PAY-' || upper(substr(md5(random()::text), 1, 8))),
  provider_transaction_id text,                              -- id fourni par le prestataire (webhook)
  status                  public.payment_status not null default 'PENDING',
  payment_method          text,                              -- ex : wave_sn, om_sn, test
  confirmed_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index payments_user_idx     on public.payments (user_id);
create index payments_status_idx   on public.payments (status);
create index payments_listing_idx  on public.payments (listing_id);

-- IDEMPOTENCE / ANTI-DOUBLE-ACTIVATION :
-- un seul paiement RÉUSSI possible par annonce.
create unique index payments_one_successful_per_listing_idx
  on public.payments (listing_id)
  where status = 'SUCCESSFUL' and listing_id is not null;

-- Idempotence webhook : un id prestataire ne peut être confirmé deux fois.
create unique index payments_provider_txn_unique_idx
  on public.payments (provider_transaction_id)
  where provider_transaction_id is not null;

-- FK différée listings.payment_id → payments.id
alter table public.listings
  add constraint listings_payment_fk
  foreign key (payment_id) references public.payments (id) on delete set null;

-- ---------------------------------------------------------------------------
-- TABLE 6 : exchange_proposals — propositions d'échange
-- ---------------------------------------------------------------------------
create table public.exchange_proposals (
  id                   uuid primary key default gen_random_uuid(),
  listing_id           uuid not null references public.listings (id) on delete cascade,
  proposer_id          uuid not null references public.profiles (id) on delete cascade,
  owner_id             uuid not null references public.profiles (id) on delete cascade, -- copie du propriétaire (politiques RLS)
  proposed_listing_id  uuid references public.listings (id) on delete set null,
  proposed_description text,
  proposed_images      jsonb not null default '[]' check (jsonb_typeof(proposed_images) = 'array'),
  message              text check (message is null or char_length(message) <= 2000),
  status               public.proposal_status not null default 'PENDING',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint exchange_proposals_not_self check (proposer_id <> owner_id)
);

create index exchange_proposals_listing_idx  on public.exchange_proposals (listing_id);
create index exchange_proposals_proposer_idx on public.exchange_proposals (proposer_id);
create index exchange_proposals_owner_idx    on public.exchange_proposals (owner_id);
create index exchange_proposals_status_idx   on public.exchange_proposals (status);

-- ---------------------------------------------------------------------------
-- TABLES 7 & 8 : conversations + conversation_participants
-- ---------------------------------------------------------------------------
create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_participants (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  joined_at       timestamptz not null default now(),
  constraint conversation_participants_unique unique (conversation_id, user_id)
);

create index conversation_participants_user_idx on public.conversation_participants (user_id);

-- ---------------------------------------------------------------------------
-- TABLE 9 : messages
-- ---------------------------------------------------------------------------
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  content         text not null check (char_length(content) between 1 and 5000),
  attachment_url  text,
  is_read         boolean not null default false,
  created_at      timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_sender_idx       on public.messages (sender_id);
create index messages_unread_idx       on public.messages (conversation_id) where is_read = false;

-- ---------------------------------------------------------------------------
-- TABLE 10 : favorites — contrainte unique (user_id, listing_id)
-- ---------------------------------------------------------------------------
create table public.favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_unique_user_listing unique (user_id, listing_id)
);

create index favorites_user_idx on public.favorites (user_id);

-- ---------------------------------------------------------------------------
-- TABLE 11 : notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,   -- PROPOSAL_RECEIVED, PROPOSAL_ACCEPTED, MESSAGE, PAYMENT_CONFIRMED, LISTING_PUBLISHED, …
  title      text not null,
  message    text not null,
  related_id uuid,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx on public.notifications (user_id, is_read);
create index notifications_user_recent_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- TABLE 12 : reports — signalements
-- ---------------------------------------------------------------------------
create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles (id) on delete cascade,
  listing_id       uuid references public.listings (id) on delete set null,
  reported_user_id uuid references public.profiles (id) on delete set null,
  reason           text not null check (char_length(reason) between 2 and 120),
  description      text check (description is null or char_length(description) <= 3000),
  status           public.report_status not null default 'PENDING',
  admin_notes      text,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

create index reports_status_idx    on public.reports (status);
create index reports_reporter_idx  on public.reports (reporter_id);

-- ---------------------------------------------------------------------------
-- TABLE 13 : admin_logs — journal d'administration (lecture admin uniquement)
-- ---------------------------------------------------------------------------
create table public.admin_logs (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.profiles (id) on delete cascade,
  action      text not null,
  target_type text,
  target_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index admin_logs_admin_idx    on public.admin_logs (admin_id);
create index admin_logs_created_idx  on public.admin_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- TABLE 14 : site_settings — paramètres du site (clé/valeur)
-- ---------------------------------------------------------------------------
create table public.site_settings (
  id            uuid primary key default gen_random_uuid(),
  setting_key   text not null unique,
  setting_value text not null,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RÉFÉRENTIELS ADDITIONNELS (ajout applicatif documenté)
-- ---------------------------------------------------------------------------
create table public.cities (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  region    text,
  is_active boolean not null default true
);

create table public.site_contents (
  page       text primary key,   -- ABOUT | HOW_IT_WORKS | FAQ | SAFETY | CGU | PRIVACY | MODERATION | CONTACT
  title      text not null,
  body       text not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- FIN MIGRATION 0001
-- ---------------------------------------------------------------------------
