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
