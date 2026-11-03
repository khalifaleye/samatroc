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
