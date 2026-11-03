# Guide 02 — Connexion GitHub

## 1. Initialiser le dépôt

```bash
cd samaTroc
git init
# Vérifier que .gitignore couvre déjà : .env*, node_modules/, .next/, db/*.db
git add .
git commit -m "SamaTroc — plateforme d'échange sénégalaise (frontend + backend Supabase)"
```

> ⚠️ **Secrets** : `.env` est ignoré par git (vérifier avec `git status`).
> Ne JAMAIS committer `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`,
> `PAYMENT_API_SECRET` ou un mot de passe de base de données. En cas de fuite
> accidentelle : régénérer immédiatement la clé (Supabase → Settings → API →
> *Rotate keys*).

## 2. Créer le dépôt distant

1. Sur https://github.com/new — *Repository name* : `samatroc`
2. Visibilité : **Private** (code commercial + structure de sécurité)
3. Ne pas initialiser avec README (le projet en a déjà un)
4. Lier et pousser :

```bash
git remote add origin git@github.com:<organisation>/samatroc.git
git branch -M main
git push -u origin main
```

## 3. Branches d'environnement (cahier des charges §12)

| Branche | Environnement Vercel | Base Supabase |
|---|---|---|
| `main` | Production | `samatroc-prod` |
| `staging` | Preview (stable) | `samatroc-staging` |
| `develop` / PR | Preview (éphémère) | `samatroc-dev` |

```bash
git branch develop && git push -u origin develop
git branch staging && git push -u origin staging
```

Règles GitHub (Settings → Branches → *Add rule*) :
- `main` : *Require a pull request before merging* + 1 validation + statuts
  Vercel verts.
- Les clés des 3 environnements ne doivent **jamais** être partagées
  (clés de test en dev/staging, clés live uniquement en prod).

## 4. Protection supplémentaire

- Activer *Secret scanning* + *Push protection* (Settings → Code security).
- Ajouter `dependabot` (`.github/dependabot.yml`) pour les mises à jour de
  sécurité npm.
