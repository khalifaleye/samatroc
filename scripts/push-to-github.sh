#!/usr/bin/env bash
# =============================================================================
# SAMATROC 🇸🇳 — Publier le code sur GitHub
# -----------------------------------------------------------------------------
# Pré-requis :
#   1. Créer le dépôt vide sur https://github.com/new
#      (nom : samatroc · visibilité : Private recommandée · SANS README initial)
#   2. Disposer d'un accès Git authentifié :
#      • HTTPS  : gh auth login  (GitHub CLI)  — ou
#      • HTTPS  : git config credential.helper store + token PAT à la demande
#      • SSH    : clé SSH ajoutée sur GitHub (Settings → SSH keys)
#
# Utilisation :
#   bash scripts/push-to-github.sh git@github.com:<org>/samatroc.git
#   bash scripts/push-to-github.sh https://github.com/<org>/samatroc.git
#
# Le script :
#   • lie le dépôt distant (origin),
#   • pousse main,
#   • crée et pousse les branches d'environnement develop et staging
#     (cahier des charges §12 : 3 environnements Vercel).
# =============================================================================
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage : bash scripts/push-to-github.sh <url-du-depot-git>"
  echo "Ex.   : bash scripts/push-to-github.sh git@github.com:mon-org/samatroc.git"
  exit 1
fi

REMOTE_URL="$1"

# Vérifier que aucun secret n'est suivi par git
if git ls-files | grep -qE "^\.env$|\.env\.local$"; then
  echo "❌ .env est suivi par git ! Corriger .gitignore avant de pousser."
  exit 1
fi

git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE_URL"
git branch -M main
git push -u origin main

# Branches d'environnement (production = main · preview stable = staging · dev = develop)
git branch develop 2>/dev/null || true
git branch staging 2>/dev/null || true
git push -u origin develop || true
git push -u origin staging || true

echo ""
echo "✅ Code publié sur $REMOTE_URL"
echo "   → main      : production Vercel"
echo "   → staging   : préproduction"
echo "   → develop   : développement"
echo "Étape suivante : https://vercel.com/new → Importer « samatroc » (guide 03)."
