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
