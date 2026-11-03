# Guide 05 — Sauvegarde et restauration

## 1. Ce qu'il faut sauvegarder

| Donnée | Emplacement | Méthode |
|---|---|---|
| Base PostgreSQL | Supabase | `pg_dump` / Backups Supabase |
| Fichiers Storage | 4 buckets | script de synchronisation |
| Configuration (Auth, RLS…) | migrations SQL | git (source de vérité) |

## 2. Sauvegarde de la base (pg_dump)

Récupérer la chaîne de connexion **directe** (non poolée) :
*Project Settings → Database → Connection string → URI* (port `5432`,
session pooler : `6543`).

```bash
# Sauvegarde complète (schéma + données), horodatée
pg_dump "$SUPABASE_DB_URL" \
  --no-owner --no-privileges \
  -F c -f "backups/samatroc-$(date +%Y%m%d-%H%M%S).dump"

# Vérifier la taille du fichier (doit être > 0)
ls -lh backups/
```

### Cron quotidien (serveur ou GitHub Actions)

```yaml
# .github/workflows/backup.yml (Secrets : SUPABASE_DB_URL)
name: backup-db
on:
  schedule: [{ cron: "0 2 * * *" }]   # 02:00 UTC = 02:00 Dakar
  workflow_dispatch:
jobs:
  dump:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: sudo apt-get update && sudo apt-get install -y postgresql-client
      - run: |
          mkdir -p backups
          pg_dump "${{ secrets.SUPABASE_DB_URL }}" --no-owner --no-privileges \
            -F c -f "backups/samatroc-$(date +%Y%m%d-%H%M%S).dump"
      - uses: actions/upload-artifact@v4
        with:
          name: db-backup
          path: backups/
          retention-days: 90
```

### Sauvegardes gérées Supabase (plan Pro)

*Database → Backups* : sauvegardes quotidiennes + **PITR** (restauration à la
seconde) recommandées dès l'ouverture au public.

## 3. Sauvegarde du Storage

```bash
# Téléverser une copie locale des 4 buckets (supabase CLI)
npx supabase storage download listing-images -o backups/storage/listing-images
npx supabase storage download profile-avatars -o backups/storage/profile-avatars
npx supabase storage download exchange-images -o backups/storage/exchange-images
npx supabase storage download support-attachments -o backups/storage/support-attachments
```

## 4. Restauration

### 4.1 Base — vers le même projet

```bash
# ⚠️ opération destructive : prévenir les utilisateurs, passer en maintenance
# (site_settings : maintenance=true) puis :
pg_restore --clean --if-exists --no-owner \
  -d "$SUPABASE_DB_URL" "backups/samatroc-20261103-020000.dump"
```

⚠️ **Ne pas restaurer le schéma `auth`** depuis un dump d'un autre projet
(les UUID auth.users doivent correspondre). Restaurer uniquement `public` :
extraire `pg_restore --list` et filtrer les objets `public.*`.

### 4.2 Base — vers un nouveau projet (sinistre)

1. Créer le projet Supabase neuf (guide 01, étapes 1-2).
2. Exécuter les 6 fichiers SQL de migrations + seed (guide 01, étape 4).
3. `pg_restore --data-only` des tables `public.*` du dump.
4. Re-téléverser les fichiers Storage si besoin.
5. Basculer les variables Vercel vers le nouveau projet → *Redeploy*.

### 4.3 Vérifications post-restauration

```bash
bun supabase/tests/run-tests.mjs     # si l'environnement de test pointe dessus
```

- [ ] Un compte de test se connecte
- [ ] Une annonce publiée s'affiche avec ses images
- [ ] `select count(*) from payments where status='SUCCESSFUL';` cohérent
- [ ] RLS : tentative d'accès croisé refusée

## 5. Rétention recommandée

| Sauvegarde | Fréquence | Conservation |
|---|---|---|
| Complète | quotidienne | 30 jours |
| Hebdomadaire | lundi | 3 mois |
| Mensuelle | 1er du mois | 1 an (hors site) |
| PITR Supabase | continu | selon plan |
