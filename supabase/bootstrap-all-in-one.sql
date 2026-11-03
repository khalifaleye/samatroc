-- =============================================================================
-- SAMATROC 🇸🇳 — BOOTSTRAP ALL-IN-ONE (généré automatiquement)
-- -----------------------------------------------------------------------------
-- CE FICHIER CONTIENT, DANS L'ORDRE :
--   1. supabase/migrations/20260101000001_init.sql
--   2. supabase/migrations/20260101000002_functions.sql
--   3. supabase/migrations/20260101000003_rls.sql
--   4. supabase/migrations/20260101000004_storage.sql
--   5. supabase/migrations/20260101000005_realtime.sql
--   6. supabase/seed.sql
--
-- UTILISATION : Dashboard Supabase → SQL Editor → New query → coller CE fichier
-- en entier → Run (une seule exécution suffit).
--
-- ⚠️  NE PAS exécuter deux fois sans réinitialisation (create table non idempotent).
--     Pour les mises à jour ultérieures, utiliser les migrations individuelles
--     via la Supabase CLI (supabase db push).
--
-- Régénérer ce fichier : supabase/build-bootstrap.sh
-- =============================================================================

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ FICHIER : supabase/migrations/20260101000001_init.sql
-- ╚═══════════════════════════════════════════════════════════════════════════╝

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

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ FICHIER : supabase/migrations/20260101000002_functions.sql
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ============================================================================
-- SAMATROC 🇸🇳 — MIGRATION 0002 : FONCTIONS BACKEND SÉCURISÉES
-- ----------------------------------------------------------------------------
-- Toutes les fonctions sensibles sont SECURITY DEFINER avec search_path verrouillé
-- et des droits d'exécution restreints (principe du moindre privilège).
--
-- La logique métier critique (confirmation de paiement, publication d'annonce,
-- modération) n'est JAMAIS exécutable par le navigateur : uniquement via
-- service_role (backend) ou les fonctions exposées explicitement.
-- ============================================================================

-- ===========================================================================
-- 1. HELPERS
-- ===========================================================================

-- Génère un slug URL à partir d'un titre (accents français inclus)
create or replace function public.slugify(p_text text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  v := lower(p_text);
  v := translate(v, 'àâäéèêëîïôöùûüçñ', 'aaaeeeeiioouuucn');
  v := regexp_replace(v, '[^a-z0-9]+', '-', 'g');
  v := trim(both '-' from v);
  return substr(v, 1, 80);
end;
$$;

-- L'utilisateur courant est-il un administrateur actif ?
-- SECURITY DEFINER → évite la récursion RLS sur profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('ADMIN', 'SUPER_ADMIN')
      and account_status = 'ACTIVE'
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'SUPER_ADMIN'
      and account_status = 'ACTIVE'
  );
$$;

-- L'utilisateur courant est-il actif (non suspendu) ?
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and account_status = 'ACTIVE'
  );
$$;

-- L'utilisateur donné (par défaut : courant) participe-t-il à la conversation ?
-- SECURITY DEFINER → contourne la RLS de conversation_participants (évite la
-- récursion infinie dans les politiques qui s'y réfèrent).
create or replace function public.is_conversation_participant(
  p_conversation_id uuid,
  p_user_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id = coalesce(p_user_id, auth.uid())
  );
$$;

-- Trigger générique : met à jour updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ===========================================================================
-- 2. CRÉATION AUTOMATIQUE DU PROFIL À L'INSCRIPTION (Supabase Auth)
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base   text;
  v_username text;
  v_counter int := 0;
begin
  -- Nom d'utilisateur dérivé de l'e-mail, rendu unique si besoin
  v_base := split_part(lower(new.email), '@', 1);
  v_base := regexp_replace(v_base, '[^a-z0-9_]', '', 'g');
  if char_length(v_base) < 3 then
    v_base := 'utilisateur';
  end if;
  v_username := substr(v_base, 1, 24);

  while exists (select 1 from public.profiles where username = v_username) loop
    v_counter := v_counter + 1;
    v_username := substr(v_base, 1, 20) || '_' || substr(md5(random()::text), 1, 4);
    exit when v_counter > 20;
  end loop;

  insert into public.profiles (id, full_name, username, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'Utilisateur SamaTroc'),
    v_username,
    lower(new.email)
  );
  return new;
end;
$$;

-- Déclencheur : INSERT sur auth.users → création du profil associé
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger updated_at sur toutes les tables concernées
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists listings_updated_at on public.listings;
create trigger listings_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

drop trigger if exists proposals_updated_at on public.exchange_proposals;
create trigger proposals_updated_at before update on public.exchange_proposals
  for each row execute function public.set_updated_at();

drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 3. ANNONCES
-- ===========================================================================

-- create_listing : création validée côté serveur (statut DRAFT ou PENDING_PAYMENT)
create or replace function public.create_listing(
  p_title            text,
  p_description      text,
  p_category_id      uuid,
  p_city             text,
  p_desired_item     text,
  p_condition        public.item_condition default 'BON',
  p_subcategory_id   uuid default null,
  p_region           text default null,
  p_neighborhood     text default null,
  p_desired_category_id uuid default null,
  p_desired_multiple boolean default false,
  p_submit_now       boolean default true   -- true → PENDING_PAYMENT ; false → DRAFT
)
returns public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   public.profiles%rowtype;
  v_listing public.listings%rowtype;
  v_slug   text;
  v_suffix text;
begin
  select * into v_user from public.profiles where id = auth.uid();
  if not found then
    raise exception 'PROFIL_INTROUVABLE';
  end if;
  if v_user.account_status <> 'ACTIVE' then
    raise exception 'COMPTE_NON_ACTIF';
  end if;
  if p_submit_now and (p_desired_item is null or char_length(coalesce(p_desired_item, '')) < 3) then
    -- La contrepartie d'échange est obligatoire à la soumission
    raise exception 'CONTREPARTIE_REQUISE';
  end if;

  v_suffix := upper(substr(md5(random()::text), 1, 4));
  v_slug   := substr(public.slugify(p_title), 1, 70) || '-' || lower(v_suffix);

  insert into public.listings (
    user_id, category_id, subcategory_id, title, slug, description,
    condition, city, region, neighborhood, desired_item,
    desired_category_id, desired_multiple, status
  ) values (
    v_user.id, p_category_id, p_subcategory_id, p_title, v_slug, p_description,
    coalesce(p_condition, 'BON'), p_city, p_region, p_neighborhood, p_desired_item,
    p_desired_category_id, coalesce(p_desired_multiple, false),
    case when p_submit_now then 'PENDING_PAYMENT'::public.listing_status else 'DRAFT'::public.listing_status end
  )
  returning * into v_listing;

  return v_listing;
end;
$$;

-- update_listing : le propriétaire modifie son annonce (hors statuts sensibles)
create or replace function public.update_listing(
  p_listing_id      uuid,
  p_title           text default null,
  p_description     text default null,
  p_condition       public.item_condition default null,
  p_city            text default null,
  p_region          text default null,
  p_neighborhood    text default null,
  p_desired_item    text default null,
  p_category_id     uuid default null,
  p_subcategory_id  uuid default null,
  p_desired_category_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.listings%rowtype;
begin
  select * into v from public.listings where id = p_listing_id for update;
  if not found then raise exception 'ANNONCE_INTROUVABLE'; end if;
  if v.user_id <> auth.uid() then raise exception 'PAS_PROPRIETAIRE'; end if;
  if v.status in ('PUBLISHED', 'EXCHANGED', 'DELETED') then
    raise exception 'MODIFICATION_NON_AUTORISEE_APRES_PUBLICATION';
  end if;

  update public.listings set
    title            = coalesce(p_title, title),
    slug             = case when p_title is not null
                            then substr(public.slugify(p_title), 1, 70) || '-' || lower(upper(substr(md5(random()::text), 1, 4)))
                            else slug end,
    description      = coalesce(p_description, description),
    condition        = coalesce(p_condition, condition),
    city             = coalesce(p_city, city),
    region           = coalesce(p_region, region),
    neighborhood     = coalesce(p_neighborhood, neighborhood),
    desired_item     = coalesce(p_desired_item, desired_item),
    category_id      = coalesce(p_category_id, category_id),
    subcategory_id   = p_subcategory_id,
    desired_category_id = p_desired_category_id
  where id = p_listing_id;
end;
$$;

-- delete_listing : suppression logique (propriétaire ou admin)
create or replace function public.delete_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.listings%rowtype;
begin
  select * into v from public.listings where id = p_listing_id for update;
  if not found then raise exception 'ANNONCE_INTROUVABLE'; end if;
  if v.user_id <> auth.uid() and not public.is_admin() then
    raise exception 'PAS_PROPRIETAIRE';
  end if;
  update public.listings set status = 'DELETED' where id = p_listing_id;
end;
$$;

-- publish_listing : appelée UNIQUEMENT après confirmation serveur du paiement
create or replace function public.publish_listing(p_listing_id uuid, p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.listings%rowtype;
  v_payment public.payments%rowtype;
begin
  select * into v_listing from public.listings where id = p_listing_id for update;
  if not found then raise exception 'ANNONCE_INTROUVABLE'; end if;
  if v_listing.status <> 'PENDING_PAYMENT' then
    raise exception 'ANNONCE_PAS_EN_ATTENTE_DE_PAIEMENT';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception 'PAIEMENT_INTROUVABLE'; end if;
  if v_payment.user_id <> v_listing.user_id then raise exception 'PAIEMENT_NON_CORRESPONDANT'; end if;
  if v_payment.status <> 'SUCCESSFUL' then
    raise exception 'PAIEMENT_NON_CONFIRME';  -- JAMAIS de publication sans paiement confirmé serveur
  end if;
  if v_payment.amount < v_listing.publication_fee then
    raise exception 'MONTANT_INSUFFISANT';
  end if;

  update public.listings
     set status = 'PUBLISHED',
         payment_id = p_payment_id,
         published_at = now(),
         expires_at = now() + interval '90 days'
   where id = p_listing_id and status = 'PENDING_PAYMENT';  -- garde idempotence

  insert into public.notifications (user_id, type, title, message, related_id)
  values (v_listing.user_id, 'LISTING_PUBLISHED', 'Annonce publiée',
          'Votre annonce « ' || v_listing.title || ' » est en ligne.', v_listing.id);
end;
$$;

-- ===========================================================================
-- 4. PAIEMENTS
-- ===========================================================================

-- create_payment : le propriétaire initie une transaction (statut PENDING)
create or replace function public.create_payment(
  p_listing_id uuid,
  p_provider   public.payment_provider,
  p_method     text default null
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.listings%rowtype;
  v_existing public.payments%rowtype;
  v_payment public.payments%rowtype;
begin
  select * into v_listing from public.listings where id = p_listing_id;
  if not found then raise exception 'ANNONCE_INTROUVABLE'; end if;
  if v_listing.user_id <> auth.uid() then raise exception 'PAS_PROPRIETAIRE'; end if;

  -- Anti double-paiement : si un paiement réussi existe déjà, refuser.
  select * into v_existing from public.payments
   where listing_id = p_listing_id and status = 'SUCCESSFUL'
   limit 1;
  if found then
    raise exception 'ANNONCE_DEJA_PAYEE';
  end if;

  insert into public.payments (user_id, listing_id, amount, payment_provider, payment_method)
  values (auth.uid(), p_listing_id, v_listing.publication_fee, p_provider, coalesce(p_method, 'test'))
  returning * into v_payment;

  update public.listings set status = 'PENDING_PAYMENT' where id = p_listing_id and status = 'DRAFT';

  return v_payment;
end;
$$;

-- verify_payment : CONFIRMATION SERVEUR UNIQUEMENT (webhook / back-office).
--   • idempotent : re-confirmer un paiement déjà confirmé ne ré-active rien
--   • vérifie référence, montant, devise transmises par le prestataire
--   • n'accepte JAMAIS un statut transmis par le navigateur
create or replace function public.verify_payment(
  p_transaction_reference   text,
  p_provider_transaction_id text default null,
  p_success                 boolean default true,
  p_amount_received         bigint default null,
  p_currency                text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment  public.payments%rowtype;
begin
  select * into v_payment from public.payments
   where transaction_reference = p_transaction_reference
   for update;
  if not found then
    return 'PAYMENT_NOT_FOUND';
  end if;

  -- IDEMPOTENCE : déjà confirmé → ne rien refaire
  if v_payment.status = 'SUCCESSFUL' then
    return 'ALREADY_CONFIRMED';
  end if;
  if v_payment.status not in ('PENDING', 'PROCESSING') then
    return 'NOT_CONFIRMABLE';
  end if;

  -- Échec transmis par le prestataire
  if not p_success then
    update public.payments
       set status = 'FAILED',
           provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id)
     where id = v_payment.id;
    insert into public.notifications (user_id, type, title, message, related_id)
    values (v_payment.user_id, 'PAYMENT_FAILED', 'Paiement non abouti',
            'Le paiement ' || v_payment.transaction_reference || ' n''a pas abouti. Vous pouvez réessayer.',
            v_payment.listing_id);
    return 'PAYMENT_FAILED';
  end if;

  -- Vérification du montant (si le prestataire le transmet)
  if p_amount_received is not null and p_amount_received <> v_payment.amount::bigint then
    update public.payments set status = 'FAILED' where id = v_payment.id;
    return 'AMOUNT_MISMATCH';
  end if;

  -- Vérification de la devise
  if p_currency is not null and upper(p_currency) <> v_payment.currency then
    update public.payments set status = 'FAILED' where id = v_payment.id;
    return 'CURRENCY_MISMATCH';
  end if;

  -- Confirmation atomique (garde sur le statut → idempotence même en concurrence)
  update public.payments
     set status = 'SUCCESSFUL',
         provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id),
         confirmed_at = now()
   where id = v_payment.id
     and status in ('PENDING', 'PROCESSING');
  if not found then
    return 'ALREADY_CONFIRMED';
  end if;

  -- Activation de l'annonce (une seule fois)
  if v_payment.listing_id is not null then
    perform public.publish_listing(v_payment.listing_id, v_payment.id);
  end if;

  return 'CONFIRMED';
end;
$$;

-- Confidentialité : confirmation réservée au backend (service_role)
revoke all on function public.verify_payment(text, text, boolean, bigint, text) from public, anon, authenticated;
grant execute on function public.verify_payment(text, text, boolean, bigint, text) to service_role;

-- ===========================================================================
-- 5. PROPOSITIONS D'ÉCHANGE
-- ===========================================================================

create or replace function public.create_exchange_proposal(
  p_listing_id          uuid,
  p_proposed_listing_id uuid default null,
  p_proposed_description text default null,
  p_message             text default null
)
returns public.exchange_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target  public.listings%rowtype;
  v_proposer public.profiles%rowtype;
  v_offer   public.listings%rowtype;
  v_proposal public.exchange_proposals%rowtype;
begin
  if auth.uid() is null then raise exception 'CONNEXION_REQUISE'; end if;
  select * into v_proposer from public.profiles where id = auth.uid();
  if v_proposer.account_status <> 'ACTIVE' then raise exception 'COMPTE_NON_ACTIF'; end if;

  select * into v_target from public.listings where id = p_listing_id;
  if not found then raise exception 'ANNONCE_INTROUVABLE'; end if;
  if v_target.status <> 'PUBLISHED' then raise exception 'ANNONCE_NON_DISPONIBLE'; end if;
  if v_target.user_id = auth.uid() then raise exception 'PROPOSITION_SUR_SOI_MEME'; end if;

  if p_proposed_listing_id is not null then
    select * into v_offer from public.listings where id = p_proposed_listing_id;
    if not found or v_offer.user_id <> auth.uid() then
      raise exception 'ANNONCE_PROPOSEE_INVALIDE';
    end if;
  end if;

  insert into public.exchange_proposals (
    listing_id, proposer_id, owner_id, proposed_listing_id,
    proposed_description, message
  ) values (
    p_listing_id, auth.uid(), v_target.user_id, p_proposed_listing_id,
    p_proposed_description, p_message
  ) returning * into v_proposal;

  insert into public.notifications (user_id, type, title, message, related_id)
  values (v_target.user_id, 'PROPOSAL_RECEIVED', 'Nouvelle proposition d''échange',
          'Une proposition a été reçue pour « ' || v_target.title || ' ».', v_proposal.id);

  return v_proposal;
end;
$$;

-- respond_to_exchange : le PROPRIÉTAIRE décide ; le proposant peut annuler ;
-- « COMPLETED » (échange réalisé) déclarable par l'un ou l'autre.
create or replace function public.respond_to_exchange(
  p_proposal_id uuid,
  p_action      text,            -- ACCEPTED | REJECTED | COUNTERED | CANCELLED | COMPLETED
  p_message     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.exchange_proposals%rowtype;
begin
  select * into v from public.exchange_proposals where id = p_proposal_id for update;
  if not found then raise exception 'PROPOSITION_INTROUVABLE'; end if;

  if p_action not in ('ACCEPTED', 'REJECTED', 'COUNTERED', 'CANCELLED', 'COMPLETED') then
    raise exception 'ACTION_INVALIDE';
  end if;

  -- Autorisations
  if p_action = 'CANCELLED' then
    if v.proposer_id <> auth.uid() then raise exception 'PAS_AUTEUR_PROPOSITION'; end if;
    if v.status <> 'PENDING' then raise exception 'PROPOSITION_DEJA_TRAITEE'; end if;
  elsif p_action = 'COMPLETED' then
    if v.proposer_id <> auth.uid() and v.owner_id <> auth.uid() then
      raise exception 'PAS_PARTIE_PRENANTE';
    end if;
    if v.status <> 'ACCEPTED' then raise exception 'ECHANGE_PAS_ACCEPTE'; end if;
  else  -- ACCEPTED / REJECTED / COUNTERED : réservés au destinataire (propriétaire)
    if v.owner_id <> auth.uid() then raise exception 'PAS_DESTINATAIRE'; end if;
    if v.status <> 'PENDING' and p_action <> 'COUNTERED' then
      raise exception 'PROPOSITION_DEJA_TRAITEE';
    end if;
  end if;

  update public.exchange_proposals
     set status = p_action::public.proposal_status
   where id = p_proposal_id;

  -- À l'acceptation : l'annonce ciblée passe en EXCHANGED
  if p_action = 'ACCEPTED' then
    update public.listings set status = 'EXCHANGED' where id = v.listing_id and status = 'PUBLISHED';
    perform public.create_conversation(v.listing_id, v.proposer_id);
  end if;

  if p_action = 'COMPLETED' then
    update public.listings set status = 'EXCHANGED' where id = v.listing_id and status <> 'DELETED';
    if v.proposed_listing_id is not null then
      update public.listings set status = 'EXCHANGED' where id = v.proposed_listing_id and status <> 'DELETED';
    end if;
  end if;

  insert into public.notifications (user_id, type, title, message, related_id)
  values (
    case when auth.uid() = v.owner_id then v.proposer_id else v.owner_id end,
    'PROPOSAL_' || p_action,
    'Proposition d''échange',
    'Votre proposition est passée au statut : ' || p_action || '.',
    v.id
  );
end;
$$;

-- ===========================================================================
-- 6. MESSAGERIE
-- ===========================================================================

-- create_conversation : dédoublonnée (même paire + même annonce)
create or replace function public.create_conversation(
  p_listing_id uuid,
  p_other_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'CONNEXION_REQUISE'; end if;
  if p_other_user_id = v_me then raise exception 'CONVERSATION_AVEC_SOI_MEME'; end if;
  if not exists (select 1 from public.profiles where id = p_other_user_id and account_status = 'ACTIVE') then
    raise exception 'UTILISATEUR_INDISPONIBLE';
  end if;

  select cp1.conversation_id into v_conversation_id
    from public.conversation_participants cp1
    join public.conversation_participants cp2
      on cp2.conversation_id = cp1.conversation_id
   where cp1.user_id = v_me and cp2.user_id = p_other_user_id
   limit 1;

  if v_conversation_id is null then
    insert into public.conversations (listing_id) values (p_listing_id)
    returning id into v_conversation_id;
    insert into public.conversation_participants (conversation_id, user_id)
    values (v_conversation_id, v_me), (v_conversation_id, p_other_user_id);
  end if;

  return v_conversation_id;
end;
$$;

-- send_message : réservé aux participants ; sender_id forcé = auth.uid()
-- (un utilisateur ne peut JAMAIS usurper l'identité d'un autre expéditeur)
create or replace function public.send_message(
  p_conversation_id uuid,
  p_content text,
  p_attachment_url text default null
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.messages%rowtype;
  v_other uuid;
begin
  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  ) then
    raise exception 'PAS_PARTICIPANT';
  end if;

  insert into public.messages (conversation_id, sender_id, content, attachment_url)
  values (p_conversation_id, auth.uid(), p_content, p_attachment_url)
  returning * into v_message;

  update public.conversations set updated_at = now() where id = p_conversation_id;

  select user_id into v_other from public.conversation_participants
   where conversation_id = p_conversation_id and user_id <> auth.uid();

  insert into public.notifications (user_id, type, title, message, related_id)
  values (v_other, 'MESSAGE', 'Nouveau message',
          'Vous avez reçu un nouveau message.', v_message.id);

  return v_message;
end;
$$;

-- Marquer les messages d'une conversation comme lus (par le destinataire)
create or replace function public.mark_messages_read(p_conversation_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.messages
     set is_read = true
   where conversation_id = p_conversation_id
     and sender_id <> auth.uid()
     and is_read = false;
$$;

-- ===========================================================================
-- 7. FAVORIS & NOTIFICATIONS
-- ===========================================================================

create or replace function public.add_favorite(p_listing_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.favorites (user_id, listing_id)
  values (auth.uid(), p_listing_id)
  on conflict (user_id, listing_id) do nothing;
$$;

create or replace function public.remove_favorite(p_listing_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.favorites
   where user_id = auth.uid() and listing_id = p_listing_id;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
     set is_read = true
   where id = p_notification_id and user_id = auth.uid();
$$;

-- ===========================================================================
-- 8. SIGNALEMENTS
-- ===========================================================================

create or replace function public.report_listing(
  p_listing_id uuid,
  p_reason text,
  p_description text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.listings where id = p_listing_id;
  insert into public.reports (reporter_id, listing_id, reported_user_id, reason, description)
  values (auth.uid(), p_listing_id, v_owner, p_reason, p_description);
end;
$$;

-- Traitement d'un signalement : ADMIN uniquement
create or replace function public.resolve_report(
  p_report_id uuid,
  p_status text,               -- RESOLVED | DISMISSED
  p_admin_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.reports%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIS'; end if;
  if p_status not in ('RESOLVED', 'DISMISSED') then raise exception 'STATUT_INVALIDE'; end if;

  update public.reports
     set status = p_status::public.report_status,
         admin_notes = coalesce(p_admin_notes, admin_notes),
         resolved_at = now()
   where id = p_report_id
   returning * into v;

  if found and v.reporter_id is not null then
    insert into public.notifications (user_id, type, title, message, related_id)
    values (v.reporter_id, 'REPORT_UPDATE', 'Signalement traité',
            'Votre signalement a été ' || case when p_status = 'RESOLVED' then 'traité' else 'clôturé' end || '.', v.id);
  end if;

  insert into public.admin_logs (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'REPORT_' || p_status, 'report', p_report_id::text,
          jsonb_build_object('admin_notes', p_admin_notes));
end;
$$;

-- ===========================================================================
-- 9. MODÉRATION (ADMIN)
-- ===========================================================================

create or replace function public.moderate_listing(
  p_listing_id uuid,
  p_action text,               -- PUBLISH | REJECT | DEACTIVATE | ACTIVATE
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.listings%rowtype;
  v_new_status public.listing_status;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIS'; end if;

  select * into v from public.listings where id = p_listing_id for update;
  if not found then raise exception 'ANNONCE_INTROUVABLE'; end if;

  case p_action
    when 'PUBLISH'    then v_new_status := 'PUBLISHED';
    when 'REJECT'     then v_new_status := 'REJECTED';
    when 'DEACTIVATE' then v_new_status := 'INACTIVE';
    when 'ACTIVATE'   then v_new_status := 'PUBLISHED';
    else raise exception 'ACTION_INVALIDE';
  end case;

  update public.listings
     set status = v_new_status,
         rejection_reason = case when p_action = 'REJECT' then p_reason else rejection_reason end,
         moderation_note  = p_reason,
         published_at = case when p_action in ('PUBLISH','ACTIVATE') and published_at is null then now() else published_at end
   where id = p_listing_id;

  insert into public.admin_logs (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'LISTING_' || p_action, 'listing', p_listing_id::text,
          jsonb_build_object('reason', p_reason));

  insert into public.notifications (user_id, type, title, message, related_id)
  values (v.user_id, 'LISTING_' || p_action, 'Modération de votre annonce',
          'Votre annonce « ' || v.title || ' » : ' || p_action ||
          coalesce(' — ' || p_reason, '') || '.', v.id);
end;
$$;

-- ===========================================================================
-- 10. STATISTIQUES ADMINISTRATION (proviennent de la base de données)
-- ===========================================================================

create or replace function public.admin_stats()
returns table (
  users_total            bigint,
  users_active           bigint,
  listings_total         bigint,
  listings_pending       bigint,   -- en attente (paiement ou modération)
  listings_published     bigint,
  payments_successful    bigint,
  revenue_total          bigint,   -- recettes brutes en FCFA
  proposals_total        bigint,
  exchanges_completed    bigint,
  reports_pending        bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Double protection : grant d'exécution + vérification interne du rôle
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIS';
  end if;
  return query select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles where account_status = 'ACTIVE'),
    (select count(*) from public.listings where status <> 'DELETED'),
    (select count(*) from public.listings where status in ('PENDING_PAYMENT', 'PENDING_REVIEW')),
    (select count(*) from public.listings where status = 'PUBLISHED'),
    (select count(*) from public.payments where status = 'SUCCESSFUL'),
    (select coalesce(sum(amount), 0) from public.payments where status = 'SUCCESSFUL'),
    (select count(*) from public.exchange_proposals),
    (select count(*) from public.exchange_proposals where status = 'COMPLETED'),
    (select count(*) from public.reports where status = 'PENDING');
end;
$$;

revoke all on function public.admin_stats() from public, anon, authenticated;
grant execute on function public.admin_stats() to authenticated, service_role;

-- ===========================================================================
-- 11. PREMIER SUPER ADMINISTRATEUR (procédure sécurisée côté serveur)
-- ----------------------------------------------------------------------------
-- À exécuter UNE SEULE FOIS depuis le SQL Editor Supabase (ou psql avec le
-- rôle postgres) APRÈS que le premier compte utilisateur se soit inscrit.
-- Refuse de s'exécuter si un SUPER_ADMIN existe déjà.
-- Voir docs/06-premier-admin.md
-- ===========================================================================

create or replace function public.setup_first_super_admin(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  -- Garde : exécutable uniquement par postgres / service_role (jamais par les rôles HTTP)
  if current_user in ('anon', 'authenticated') then
    raise exception 'OPERATION_RESERVEE_AU_SERVEUR';
  end if;

  if exists (select 1 from public.profiles where role = 'SUPER_ADMIN') then
    return 'SUPER_ADMIN_DEJA_EXISTANT';
  end if;

  select * into v_profile from public.profiles where lower(email) = lower(p_email);
  if not found then
    return 'PROFIL_INTROUVABLE_INSCRIVEZ_DABORD';
  end if;

  update public.profiles set role = 'SUPER_ADMIN' where id = v_profile.id;

  insert into public.admin_logs (admin_id, action, target_type, target_id, details)
  values (v_profile.id, 'SETUP_FIRST_SUPER_ADMIN', 'profile', v_profile.id::text,
          jsonb_build_object('email', v_profile.email));

  return 'SUPER_ADMIN_CREE';
end;
$$;

revoke all on function public.setup_first_super_admin(text) from public, anon, authenticated;
grant execute on function public.setup_first_super_admin(text) to service_role;

-- ===========================================================================
-- FIN MIGRATION 0002
-- ===========================================================================

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ FICHIER : supabase/migrations/20260101000003_rls.sql
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ============================================================================
-- SAMATROC 🇸🇳 — MIGRATION 0003 : ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
-- Principes appliqués (cahier des charges §4) :
--   • RLS ACTIVÉ sur toutes les tables exposées — sans politique = accès refusé
--   • Le rôle est contrôlé serveur : un utilisateur ne peut JAMAIS modifier
--     son rôle / statut (grants de colonnes + absence de politique d'écriture)
--   • Paiements : lecture de ses propres transactions, aucune écriture client
--   • Messagerie : participants uniquement, usurpation d'expéditeur impossible
--   • Favoris : uniquement les siens
--   • Propositions : visibles par le proposant + le propriétaire ; seul le
--     destinataire accepte/refuse
--   • Signalements : création oui, consultation des autres non
--   • admin_logs : consultation admin uniquement
--   • Les fonctions SECURITY DEFINER (migration 0002) contournent RLS pour le
--     backend de confiance ; les accès directs passent par ces politiques.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Fonction utilitaire : réactivation par le propriétaire (paiement déjà réglé)
-- ---------------------------------------------------------------------------
create or replace function public.reactivate_own_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.listings%rowtype;
begin
  select * into v from public.listings where id = p_listing_id for update;
  if not found then raise exception 'ANNONCE_INTROUVABLE'; end if;
  if v.user_id <> auth.uid() then raise exception 'PAS_PROPRIETAIRE'; end if;
  if v.status <> 'INACTIVE' then raise exception 'ANNONCE_NON_DESACTIVEE'; end if;

  -- Une annonce déjà payée une fois (paiement SUCCESSFUL) peut être remise en ligne
  if exists (select 1 from public.payments where listing_id = p_listing_id and status = 'SUCCESSFUL') then
    update public.listings set status = 'PUBLISHED', expires_at = now() + interval '90 days'
     where id = p_listing_id;
  else
    update public.listings set status = 'PENDING_PAYMENT' where id = p_listing_id;
  end if;
end;
$$;

-- ===========================================================================
-- 1. profiles
-- ===========================================================================
alter table public.profiles enable row level security;

-- Lecture : son propre profil (+ administrateurs). Les autres profils sont
-- exposés via la vue publique profiles_public (colonnes publiques uniquement).
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Mise à jour : uniquement son propre profil, et JAMAIS les colonnes sensibles
-- (role, account_status, phone_verified, email) → grants de colonnes ci-dessous.
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update to authenticated
  using (id = auth.uid() and account_status = 'ACTIVE')
  with check (id = auth.uid());

-- Aucune politique INSERT / DELETE pour les rôles HTTP : refusé.

-- Grants colonnes : un utilisateur ne peut modifier que les champs de profil
revoke update, delete on table public.profiles from anon, authenticated;
grant update (full_name, username, phone, avatar_url, city, region, neighborhood, show_phone)
  on table public.profiles to authenticated;
grant select on table public.profiles to authenticated;  -- filtré par la politique RLS

-- Vue publique (annuaire) : colonnes non sensibles uniquement
create or replace view public.profiles_public as
  select id, full_name, username, avatar_url, city, region, neighborhood, show_phone, created_at
    from public.profiles
   where account_status = 'ACTIVE';
grant select on public.profiles_public to anon, authenticated;

-- ===========================================================================
-- 2. categories
-- ===========================================================================
alter table public.categories enable row level security;

drop policy if exists "categories_select_active" on public.categories;
create policy "categories_select_active"
  on public.categories for select
  using (is_active or public.is_admin());

drop policy if exists "categories_write_admin" on public.categories;
create policy "categories_write_admin"
  on public.categories for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===========================================================================
-- 3. listings
-- ===========================================================================
alter table public.listings enable row level security;

-- Lecture : annonces publiées (tout le monde) + ses propres annonces + admin
drop policy if exists "listings_select" on public.listings;
create policy "listings_select"
  on public.listings for select
  using (
    status = 'PUBLISHED'
    or (auth.uid() is not null and user_id = auth.uid())
    or public.is_admin()
  );

-- Création : l'utilisateur crée SES annonces, en brouillon ou en attente de paiement.
-- La publication (PUBLISHED) n'est JAMAIS fixée directement par le client.
drop policy if exists "listings_insert_own" on public.listings;
create policy "listings_insert_own"
  on public.listings for insert to authenticated
  with check (
    user_id = auth.uid()
    and status in ('DRAFT', 'PENDING_PAYMENT')
    and public.is_active_user()
  );

-- Mise à jour : propriétaire (hors transitions sensibles) ou administrateur.
drop policy if exists "listings_update_own_or_admin" on public.listings;
create policy "listings_update_own_or_admin"
  on public.listings for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (user_id = auth.uid() and status in ('DRAFT', 'PENDING_PAYMENT', 'INACTIVE'))
  );

-- Suppression : propriétaire ou administrateur
drop policy if exists "listings_delete_own_or_admin" on public.listings;
create policy "listings_delete_own_or_admin"
  on public.listings for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ===========================================================================
-- 4. listing_images
-- ===========================================================================
alter table public.listing_images enable row level security;

drop policy if exists "listing_images_select" on public.listing_images;
create policy "listing_images_select"
  on public.listing_images for select
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id
        and (l.status = 'PUBLISHED' or l.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "listing_images_write_owner" on public.listing_images;
create policy "listing_images_write_owner"
  on public.listing_images for all to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and (l.user_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and (l.user_id = auth.uid() or public.is_admin())
    )
  );

-- ===========================================================================
-- 5. payments — lecture de ses paiements ; AUCUNE écriture client possible
-- ===========================================================================
alter table public.payments enable row level security;

drop policy if exists "payments_select_own_or_admin" on public.payments;
create policy "payments_select_own_or_admin"
  on public.payments for select
  using (user_id = auth.uid() or public.is_admin());

-- Pas de politique INSERT / UPDATE / DELETE → refusés pour anon et authenticated.
-- Création : fonction create_payment (SECURITY DEFINER)
-- Confirmation : verify_payment réservée à service_role (backend vérifié)

-- ===========================================================================
-- 6. exchange_proposals
-- ===========================================================================
alter table public.exchange_proposals enable row level security;

drop policy if exists "exchange_proposals_select_parties" on public.exchange_proposals;
create policy "exchange_proposals_select_parties"
  on public.exchange_proposals for select
  using (proposer_id = auth.uid() or owner_id = auth.uid() or public.is_admin());

drop policy if exists "exchange_proposals_insert_proposer" on public.exchange_proposals;
create policy "exchange_proposals_insert_proposer"
  on public.exchange_proposals for insert to authenticated
  with check (
    proposer_id = auth.uid()
    and owner_id = (select l.user_id from public.listings l where l.id = listing_id)
    and public.is_active_user()
  );

-- Mise à jour : le destinataire (propriétaire) décide ; le proposant ne peut
-- que CANCELLED ; l'administrateur peut intervenir.
drop policy if exists "exchange_proposals_update_parties" on public.exchange_proposals;
create policy "exchange_proposals_update_parties"
  on public.exchange_proposals for update to authenticated
  using (proposer_id = auth.uid() or owner_id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (owner_id = auth.uid() and status in ('ACCEPTED', 'REJECTED', 'COUNTERED', 'COMPLETED'))
    or (proposer_id = auth.uid() and status = 'CANCELLED')
  );

-- Pas de DELETE client.

-- ===========================================================================
-- 7. conversations & participants
-- ===========================================================================
alter table public.conversations enable row level security;

drop policy if exists "conversations_select_participant" on public.conversations;
create policy "conversations_select_participant"
  on public.conversations for select to authenticated
  using (public.is_conversation_participant(id) or public.is_admin());

-- Création / mise à jour : via fonctions serveur uniquement
revoke update, delete on table public.conversations from anon, authenticated;

alter table public.conversation_participants enable row level security;

drop policy if exists "participants_select_shared" on public.conversation_participants;
create policy "participants_select_shared"
  on public.conversation_participants for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_conversation_participant(conversation_id)
    or public.is_admin()
  );

-- Ajout/retrait de participants : via create_conversation (SECURITY DEFINER)
revoke insert, update, delete on table public.conversation_participants from anon, authenticated;

-- ===========================================================================
-- 8. messages — participants uniquement ; usurpation impossible
-- ===========================================================================
alter table public.messages enable row level security;

drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant"
  on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id) or public.is_admin());

drop policy if exists "messages_insert_participant_self" on public.messages;
create policy "messages_insert_participant_self"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()                      -- pas d'usurpation d'expéditeur
    and public.is_active_user()
    and public.is_conversation_participant(conversation_id)
  );

-- Mise à jour : uniquement le flag is_read (grants de colonnes)
drop policy if exists "messages_update_mark_read" on public.messages;
create policy "messages_update_mark_read"
  on public.messages for update to authenticated
  using (public.is_conversation_participant(conversation_id))
  with check (true);

revoke update, delete on table public.messages from anon, authenticated;
grant update (is_read) on table public.messages to authenticated;

-- ===========================================================================
-- 9. favorites — chacun ne voit et ne modifie que les siens
-- ===========================================================================
alter table public.favorites enable row level security;

drop policy if exists "favorites_all_own" on public.favorites;
create policy "favorites_all_own"
  on public.favorites for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===========================================================================
-- 10. notifications — les siennes uniquement ; marquage lu uniquement
-- ===========================================================================
alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke update, delete on table public.notifications from anon, authenticated;
grant update (is_read) on table public.notifications to authenticated;

-- ===========================================================================
-- 11. reports — création oui, consultation des autres non, traitement admin
-- ===========================================================================
alter table public.reports enable row level security;

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_active_user());

drop policy if exists "reports_select_own_or_admin" on public.reports;
create policy "reports_select_own_or_admin"
  on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_update_admin"
  on public.reports for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke delete on table public.reports from anon, authenticated;

-- ===========================================================================
-- 12. admin_logs — consultation admin ; écriture via service_role uniquement
-- ===========================================================================
alter table public.admin_logs enable row level security;

drop policy if exists "admin_logs_select_admin" on public.admin_logs;
create policy "admin_logs_select_admin"
  on public.admin_logs for select to authenticated
  using (public.is_admin());

revoke insert, update, delete on table public.admin_logs from anon, authenticated;

-- ===========================================================================
-- 13. site_settings, site_contents, cities
-- ===========================================================================
alter table public.site_settings enable row level security;
drop policy if exists "site_settings_select_all" on public.site_settings;
create policy "site_settings_select_all"
  on public.site_settings for select
  using (true);
drop policy if exists "site_settings_write_admin" on public.site_settings;
create policy "site_settings_write_admin"
  on public.site_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.site_contents enable row level security;
drop policy if exists "site_contents_select_all" on public.site_contents;
create policy "site_contents_select_all"
  on public.site_contents for select
  using (true);
drop policy if exists "site_contents_write_admin" on public.site_contents;
create policy "site_contents_write_admin"
  on public.site_contents for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.cities enable row level security;
drop policy if exists "cities_select_all" on public.cities;
create policy "cities_select_all"
  on public.cities for select
  using (true);
drop policy if exists "cities_write_admin" on public.cities;
create policy "cities_write_admin"
  on public.cities for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===========================================================================
-- FIN MIGRATION 0003 — politiques testées dans supabase/tests/rls_tests.sql
-- ===========================================================================

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ FICHIER : supabase/migrations/20260101000004_storage.sql
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ============================================================================
-- SAMATROC 🇸🇳 — MIGRATION 0004 : SUPABASE STORAGE
-- ----------------------------------------------------------------------------
-- 4 buckets :
--   • listing-images       : PUBLIC   — photos des annonces publiées (5 Mo)
--   • profile-avatars      : PUBLIC   — avatars (2 Mo)
--   • exchange-images      : PRIVÉ    — photos jointes aux propositions (URLs signées)
--   • support-attachments  : PRIVÉ    — pièces jointes support (URLs signées)
--
-- Règles de sécurité :
--   • Formats limités : image/jpeg, image/png, image/webp (aucun exécutable)
--   • Nommage imposé : {user_id}/{uuid}.{ext} → fichiers uniques + périmètre
--     de propriété par dossier (impossible d'écraser le fichier d'un autre)
--   • Images des annonces : consultation publique (requis par l'explorateur)
--   • Buckets privés : accès via URLs signées générées par le backend
--   • La compression/optimisation est effectuée côté serveur (route /api/upload)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Buckets (idempotent : met à jour la configuration s'il existe déjà)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-images',      'listing-images',      true,  5242880,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('profile-avatars',     'profile-avatars',     true,  2097152,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('exchange-images',     'exchange-images',     false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('support-attachments', 'support-attachments', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Politiques storage.objects
-- Convention de chemin : {auth.uid()}/{nom-aléatoire}.{ext}
-- ---------------------------------------------------------------------------

-- ======= listing-images : lecture publique, écriture dans son dossier =======
drop policy if exists "samatroc_listing_images_public_read" on storage.objects;
create policy "samatroc_listing_images_public_read"
  on storage.objects for select
  using (bucket_id = 'listing-images');

drop policy if exists "samatroc_listing_images_own_insert" on storage.objects;
create policy "samatroc_listing_images_own_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "samatroc_listing_images_own_update" on storage.objects;
create policy "samatroc_listing_images_own_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "samatroc_listing_images_own_delete" on storage.objects;
create policy "samatroc_listing_images_own_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ======= profile-avatars : lecture publique, écriture dans son dossier =======
drop policy if exists "samatroc_avatars_public_read" on storage.objects;
create policy "samatroc_avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'profile-avatars');

drop policy if exists "samatroc_avatars_own_write" on storage.objects;
create policy "samatroc_avatars_own_write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "samatroc_avatars_own_delete" on storage.objects;
create policy "samatroc_avatars_own_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ======= exchange-images : PRIVÉ — lecture via URLs signées (backend) =======
drop policy if exists "samatroc_exchange_images_own" on storage.objects;
create policy "samatroc_exchange_images_own"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'exchange-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'exchange-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ======= support-attachments : PRIVÉ — URLs signées (backend) =======
drop policy if exists "samatroc_support_own" on storage.objects;
create policy "samatroc_support_own"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- FIN MIGRATION 0004
-- ---------------------------------------------------------------------------

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ FICHIER : supabase/migrations/20260101000005_realtime.sql
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ============================================================================
-- SAMATROC 🇸🇳 — MIGRATION 0005 : SUPABASE REALTIME
-- ----------------------------------------------------------------------------
-- Active la diffusion temps réel (respectant les politiques RLS des tables) :
--   • messages             → messagerie instantanée
--   • notifications        → badge et toasts en direct
--   • exchange_proposals   → propositions d'échange reçues/traitées
--   • listings             → changements de statut des annonces
--
-- replica identity full : permet au client de recevoir les anciennes valeurs
-- (utile pour les filtres et les mises à jour de statut).
--
-- Le bloc DO rend la migration robuste : sur un projet Supabase la publication
-- `supabase_realtime` existe déjà ; ailleurs (tests locaux) elle est créée.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter table public.messages           replica identity full;
alter table public.notifications      replica identity full;
alter table public.exchange_proposals replica identity full;
alter table public.listings           replica identity full;

do $$
declare
  t text;
begin
  foreach t in array array['messages', 'notifications', 'exchange_proposals', 'listings']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename  = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- FIN MIGRATION 0005
-- ---------------------------------------------------------------------------

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ FICHIER : supabase/seed.sql
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ============================================================================
-- SAMATROC 🇸🇳 — SEED : DONNÉES INITIALES
-- ----------------------------------------------------------------------------
-- Exécuté automatiquement par `supabase db reset` / `supabase db push`,
-- ou manuellement via le SQL Editor.
--
-- Contenu :
--   • 9 catégories principales + sous-catégories
--   • 14 régions et 15 villes du Sénégal
--   • Paramètres du site (tarif de publication : 500 FCFA minimum)
--   • Contenus légaux initialisés (CGU / confidentialité)
--
-- ⚠️  N'inscrit AUCUN faux compte administrateur.
-- ⚠️  Les annonces de démonstration éventuelles doivent être créées via un
--     script distinct clairement identifié (is_demo = true côté app).
-- Idempotent : réexécutable sans dupliquer les données.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- CATÉGORIES PRINCIPALES (display_order = ordre d'affichage accueil)
-- ---------------------------------------------------------------------------
insert into public.categories (name, slug, icon, description, display_order) values
  ('Vêtements & chaussures', 'vetements-chaussures', 'shirt',    'Prêts-à-porter, chaussures, accessoires textiles', 1),
  ('Électronique & téléphonie', 'electronique-telephonie', 'smartphone', 'Téléphones, ordinateurs, audio, gaming', 2),
  ('Maison & jardin', 'maison-jardin', 'home', 'Meubles, électroménager, outils, déco extérieure', 3),
  ('Beauté & santé', 'beaute-sante', 'flower', 'Cosmétiques, parfums, matériel de soin', 4),
  ('Sport & loisirs', 'sport-loisirs', 'trophy', 'Équipement sportif, musique, jeux', 5),
  ('Livres & papeterie', 'livres-papeterie', 'book-open', 'Manuels, romans, fournitures', 6),
  ('Enfants & bébés', 'enfants-bebes', 'baby', 'Vêtements enfants, jouets, puériculture', 7),
  ('Meubles & décoration', 'meubles-decoration', 'armchair', 'Salons, tables, rangements, décoration', 8),
  ('Autres', 'autres', 'grid', 'Tout le reste — échangez sans limite', 9)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- SOUS-CATÉGORIES
-- ---------------------------------------------------------------------------
with main as (
  select id, slug from public.categories where parent_id is null
)
insert into public.categories (name, slug, icon, parent_id, display_order)
select v.name, v.sub_slug, null::text, main.id, v.ord
from (values
  ('Chaussures femme',        'vetements-chaussures-chaussures-femme',      'vetements-chaussures',       1),
  ('Chaussures homme',        'vetements-chaussures-chaussures-homme',      'vetements-chaussures',       2),
  ('Prêts-à-porter femme',    'vetements-chaussures-pret-a-porter-femme',   'vetements-chaussures',       3),
  ('Prêts-à-porter homme',    'vetements-chaussures-pret-a-porter-homme',   'vetements-chaussures',       4),
  ('Pagnes & tissus',         'vetements-chaussures-pagnes-tissus',         'vetements-chaussures',       5),
  ('Téléphones',              'electronique-telephonie-telephones',         'electronique-telephonie',    1),
  ('Ordinateurs',             'electronique-telephonie-ordinateurs',        'electronique-telephonie',    2),
  ('Audio & son',             'electronique-telephonie-audio-son',          'electronique-telephonie',    3),
  ('Gaming',                  'electronique-telephonie-gaming',             'electronique-telephonie',    4),
  ('Électroménager',          'maison-jardin-electromenager',               'maison-jardin',              1),
  ('Ameublement',             'maison-jardin-ameublement',                  'maison-jardin',              2),
  ('Outils & bricolage',      'maison-jardin-outils-bricolage',             'maison-jardin',              3),
  ('Cosmétiques',             'beaute-sante-cosmetiques',                   'beaute-sante',               1),
  ('Parfums',                 'beaute-sante-parfums',                       'beaute-sante',               2),
  ('Matériel médical',        'beaute-sante-materiel-medical',              'beaute-sante',               3),
  ('Équipement sportif',      'sport-loisirs-equipement-sportif',           'sport-loisirs',              1),
  ('Instruments de musique',  'sport-loisirs-instruments-musique',          'sport-loisirs',              2),
  ('Jeux & jouets',           'sport-loisirs-jeux-jouets',                  'sport-loisirs',              3),
  ('Manuels scolaires',       'livres-papeterie-manuels-scolaires',         'livres-papeterie',           1),
  ('Romans & BD',             'livres-papeterie-romans-bd',                 'livres-papeterie',           2),
  ('Fournitures scolaires',   'livres-papeterie-fournitures-scolaires',     'livres-papeterie',           3),
  ('Vêtements enfants',       'enfants-bebes-vetements-enfants',            'enfants-bebes',              1),
  ('Puériculture',            'enfants-bebes-puericulture',                 'enfants-bebes',              2),
  ('Jouets éducatifs',        'enfants-bebes-jouets-educatifs',             'enfants-bebes',              3),
  ('Salons & canapés',        'meubles-decoration-salons-canapes',          'meubles-decoration',         1),
  ('Tables & chaises',        'meubles-decoration-tables-chaises',          'meubles-decoration',         2),
  ('Décoration',              'meubles-decoration-decoration',              'meubles-decoration',         3)
) as v(name, sub_slug, parent_slug, ord)
join main on main.slug = v.parent_slug
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- VILLES & RÉGIONS DU SÉNÉGAL (14 régions, 15 villes desservies)
-- ---------------------------------------------------------------------------
insert into public.cities (name, region) values
  ('Dakar',        'Dakar'),
  ('Thiès',        'Thiès'),
  ('Mbour',        'Thiès'),
  ('Touba',        'Diourbel'),
  ('Diourbel',     'Diourbel'),
  ('Saint-Louis',  'Saint-Louis'),
  ('Louga',        'Louga'),
  ('Fatick',       'Fatick'),
  ('Kaolack',      'Kaolack'),
  ('Kaffrine',     'Kaffrine'),
  ('Ziguinchor',   'Ziguinchor'),
  ('Sédhiou',      'Sédhiou'),
  ('Kolda',        'Kolda'),
  ('Tambacounda',  'Tambacounda'),
  ('Kédougou',     'Kédougou'),
  ('Matam',        'Matam')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- PARAMÈTRES DU SITE
-- ---------------------------------------------------------------------------
insert into public.site_settings (setting_key, setting_value) values
  ('publication_fee',        '500'),        -- FCFA — tarif minimum par annonce (cahier des charges §8)
  ('currency',               'XOF'),
  ('site_name',              'SamaTroc'),
  ('slogan',                 'Échangez • Économisez • Donnez une seconde vie'),
  ('contact_email',          'contact@samatroc.sn'),
  ('support_whatsapp',       '+221770000000'),
  ('listing_duration_days',  '90'),
  ('max_images_per_listing', '6'),
  ('moderation_enabled',     'true'),
  ('demo_data',              'false')       -- identifie explicitement l''absence de données de démo
on conflict (setting_key) do nothing;

-- ---------------------------------------------------------------------------
-- CONTENUS LÉGAUX INITIAUX (à compléter par l''administration)
-- ---------------------------------------------------------------------------
insert into public.site_contents (page, title, body) values
  ('CGU',      'Conditions générales d''utilisation',
   'SamaTroc est une plateforme de mise en relation entre particuliers pour l''échange d''objets. '
   'SamaTroc ne rachète pas les objets, ne fixe pas leur valeur et ne gère pas la livraison. '
   'La publication d''une annonce requiert le règlement des frais de publication (à partir de 500 FCFA). '
   'L''utilisation de la plateforme est réservée aux personnes majeures.'),
  ('PRIVACY',  'Politique de confidentialité',
   'Vos données personnelles sont utilisées uniquement pour le fonctionnement de la plateforme : '
   'authentification, mise en relation, notifications. Elles ne sont jamais revendues. '
   'Vous pouvez demander leur suppression à tout moment depuis vos paramètres.'),
  ('SAFETY',   'Conseils de sécurité',
   'Rencontrez-vous dans des lieux publics et fréquentés, de préférence en journée. '
   'Vérifiez l''objet avant l''échange. Ne partagez jamais vos codes Mobile Money. '
   'Signalez tout comportement suspect via le bouton Signaler.')
on conflict (page) do nothing;

-- ---------------------------------------------------------------------------
-- FIN SEED
-- ---------------------------------------------------------------------------
