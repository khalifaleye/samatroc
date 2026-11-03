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
