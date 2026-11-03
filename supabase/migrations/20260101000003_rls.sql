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
