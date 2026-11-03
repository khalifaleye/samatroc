-- ============================================================================
-- SAMATROC — BOOTSTRAP DE TEST LOCAL (NE JAMAIS EXÉCUTER SUR SUPABASE !)
-- ----------------------------------------------------------------------------
-- Simule le minimum de l'environnement Supabase (schémas `auth` et `storage`,
-- rôles anon/authenticated/service_role, fonction auth.uid()) pour pouvoir
-- exécuter et tester les migrations sur un PostgreSQL local.
--
-- Sur un vrai projet Supabase, tout ceci existe déjà → NE PAS exécuter ce
-- fichier (voir docs/01-guide-projet-supabase.md).
-- ============================================================================

-- Rôles HTTP Supabase
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- Privilèges par défaut : sur un projet Supabase, chaque nouvelle table/fonction
-- reçoit automatiquement ces grants (la sécurité est assurée par RLS ensuite).
-- On émule ce comportement pour que les tests locaux soient fidèles.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Schéma auth minimal (auth.users + auth.uid())
-- ---------------------------------------------------------------------------
create schema if not exists auth;

create table if not exists auth.users (
  id                uuid primary key default gen_random_uuid(),
  email             text unique not null,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  -- nullif(..., '') : après SET LOCAL + ROLLBACK, current_setting peut
  -- renvoyer une chaîne vide au lieu de NULL (quirk PostgreSQL) — on neutralise.
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on table auth.users to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Schéma storage minimal (buckets + objects + foldername)
-- ---------------------------------------------------------------------------
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text,
  name       text,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1 : array_length(_parts, 1) - 1];
end;
$$;

grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema storage to service_role;
grant select on table storage.buckets to anon, authenticated;
grant select, insert, update, delete on table storage.objects to authenticated;

-- ---------------------------------------------------------------------------
-- FIN BOOTSTRAP
-- ---------------------------------------------------------------------------
