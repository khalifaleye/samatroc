# Guide 01 — Création du projet Supabase (action humaine, ~30 min)

> ⚠️ Conformément à la règle §15 du cahier des charges : **aucun projet
> Supabase n'a été créé automatiquement** — cette étape nécessite un compte
> humain. Ce guide indique précisément où cliquer, quelle clé récupérer et où
> la renseigner.

## Étape 1 — Créer le compte et le projet

1. Aller sur **https://supabase.com** → *Sign in* (compte GitHub recommandé).
2. Cliquer **New project** :
   - *Name* : `samatroc-prod` (puis plus tard `samatroc-staging`, `samatroc-dev`)
   - *Database Password* : générer un mot de passe fort (**le sauvegarder**,
     il sert aux connexions Prisma/psql — il ne sera plus affiché)
   - *Region* : le plus proche du Sénégal — `eu-west-3` (Paris) ou `eu-west-2` (London)
   - Plan : *Free* suffit pour démarrer
3. Attendre ~2 min l'initialisation.

## Étape 2 — Récupérer les clés (où cliquer)

**Project Settings** (icône engrenage, barre latérale gauche) → **API** :

| Clé | Utilisation | Variable d'environnement |
|---|---|---|
| *Project URL* | Tous les clients | `NEXT_PUBLIC_SUPABASE_URL` |
| *anon / public* | Frontend + PostgREST (RLS actives) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| *service_role* ⚠️ | Backend serveur uniquement | `SUPABASE_SERVICE_ROLE_KEY` |

⚠️ La clé **service_role** contourne TOUTE la sécurité : ne jamais la committer,
ne jamais la mettre dans une variable `NEXT_PUBLIC_*`, ne jamais l'utiliser
côté navigateur.

## Étape 3 — Renseigner les clés

```bash
cd samaTroc
cp .env.example .env
# Ouvrir .env et renseigner :
# NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Sur Vercel : *Project Settings → Environment Variables* → ajouter les 3
variables pour **Production**, **Preview** et **Development** (guide 03).

## Étape 4 — Exécuter les migrations (deux méthodes)

### Méthode A — Dashboard (la plus simple)

1. Barre latérale → **SQL Editor** → *New query*
2. Copier-coller le contenu de chaque fichier **dans l'ordre** puis *Run* :
   1. `supabase/migrations/20260101000001_init.sql`
   2. `supabase/migrations/20260101000002_functions.sql`
   3. `supabase/migrations/20260101000003_rls.sql`
   4. `supabase/migrations/20260101000004_storage.sql`
   5. `supabase/migrations/20260101000005_realtime.sql`
   6. `supabase/seed.sql`
3. Vérifier : *Table Editor* doit afficher `profiles`, `categories` (36
   entrées), `cities` (16), `site_settings` (`publication_fee = 500`).

### Méthode B — Supabase CLI (recommandé en équipe)

```bash
# Installer la CLI : https://supabase.com/docs/guides/cli
supabase login                          # ouvre le navigateur
supabase link --project-ref <ref>       # ref = présent dans l'URL du projet
supabase db push                        # applique supabase/migrations/* dans l'ordre
supabase db reset                       # (local uniquement) migrations + seed.sql
```

## Étape 5 — Configurer Supabase Auth

**Authentication → Providers → Email** : activé par défaut. Puis :

1. **Authentication → URL Configuration**
   - *Site URL* : `https://samatroc.sn` (ou l'URL Vercel de préproduction)
   - *Redirect URLs* : ajouter
     - `http://localhost:3000/**`
     - `https://<votre-domaine>/**`
     - `https://*-<equipe>.vercel.app/**` (aperçus)
2. **Authentication → Email Templates** : personnaliser *Confirm signup* et
   *Reset password* (français, logo SamaTroc).
3. (Optionnel) **Emails** : par défaut Supabase envoie 2 e-mails/heure en
   dev ; brancher SMTP (*Project Settings → Auth → SMTP*) en production.

## Étape 6 — Vérifier Storage

**Storage** (barre latérale) : les 4 buckets
`listing-images`, `profile-avatars`, `exchange-images`, `support-attachments`
doivent exister avec leurs politiques (créés par la migration 0004).
Test rapide : téléverser une image dans `listing-images/<votre-user-id>/test.jpg`
→ l'URL publique doit répondre.

## Étape 7 — Vérifier Realtime

**Database → Replication → supabase_realtime** : les tables `messages`,
`notifications`, `exchange_proposals`, `listings` doivent être cochées
(migration 0005).

## Étape 8 — Créer le premier super administrateur

S'inscrire d'abord normalement via l'application, puis suivre le
**guide 06-premier-admin.md** (fonction SQL sécurisée `setup_first_super_admin`).

## Étape 9 — Activer les sauvegardes

Plan payant : *Database → Backups* (PITR). Plan gratuit : mettre en place le
cron `pg_dump` du **guide 05-sauvegarde-restauration.md**.

## Checklist finale

- [ ] Les 3 clés sont dans `.env` local et dans Vercel
- [ ] 6 fichiers SQL exécutés sans erreur
- [ ] Table Editor : 36 catégories, 16 villes, `publication_fee=500`
- [ ] Redirect URLs Auth configurées
- [ ] 4 buckets Storage présents
- [ ] Realtime : 4 tables cochées
- [ ] Premier super administrateur créé
- [ ] `bun run lint` + `bun run dev` : l'application fonctionne
