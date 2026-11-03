#!/usr/bin/env bash
# =============================================================================
# SAMATROC 🇸🇳 — Diagnostic de connexion Supabase
# -----------------------------------------------------------------------------
# Usage :
#   bash scripts/check-supabase.sh https://<ref>.supabase.co [clé_publishable]
#
# Si la clé n'est pas fournie en argument, celle du fichier .env est utilisée.
# Vérifie :
#   1. La connectivité REST (PostgREST répond-il ?)
#   2. Les tables du bootstrap (categories, cities, site_settings, profiles…)
#   3. Le contenu du seed (nb catégories, nb villes, tarif 500 FCFA)
#   4. L'endpoint Auth
# =============================================================================
set -uo pipefail

URL="${1:-}"
KEY="${2:-}"

if [ -z "$URL" ]; then
  echo "❌ Usage : bash scripts/check-supabase.sh https://<ref>.supabase.co [clé_publishable]"
  exit 1
fi

URL="${URL%/}"   # retirer le / final éventuel

if [ -z "$KEY" ]; then
  KEY="$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'")"
fi

if [ -z "$KEY" ]; then
  echo "❌ Aucune clé publishable trouvée (ni en argument, ni dans .env)"
  exit 1
fi

echo "🔍 Diagnostic Supabase — $URL"
echo "============================================================"

# 1. Connectivité REST
echo ""
echo "① Connectivité REST…"
HTTP_CODE=$(curl -s -o /tmp/sb_rest.json -w "%{http_code}" --max-time 10 \
  "$URL/rest/v1/" -H "apikey: $KEY")
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ PostgREST répond (HTTP $HTTP_CODE)"
else
  echo "   ❌ HTTP $HTTP_CODE — vérifiez l'URL du projet (voir /tmp/sb_rest.json)"
  cat /tmp/sb_rest.json 2>/dev/null | head -3
  exit 1
fi

# 2. Tables principales
echo ""
echo "② Vérification des tables du bootstrap…"
TABLES=(categories cities site_settings profiles listings listing_images payments exchange_proposals conversations messages favorites notifications reports admin_logs site_contents)
for t in "${TABLES[@]}"; do
  CODE=$(curl -s -o /tmp/sb_t.json -w "%{http_code}" --max-time 10 \
    "$URL/rest/v1/$t?select=*&limit=1" -H "apikey: $KEY")
  if [ "$CODE" = "200" ]; then
    echo "   ✅ $t"
  elif [ "$CODE" = "404" ]; then
    echo "   ❌ $t introuvable (table absente → bootstrap SQL non exécuté ?)"
  else
    echo "   ⚠️  $t → HTTP $CODE : $(head -c 120 /tmp/sb_t.json)"
  fi
done

# 3. Contenu du seed
echo ""
echo "③ Contenu du seed…"
N_CAT=$(curl -s --max-time 10 "$URL/rest/v1/categories?select=id&is_active=eq.true" -H "apikey: $KEY" | grep -o '"id"' | wc -l)
echo "   • Catégories actives : $N_CAT (attendu ≥ 9)"
N_CITY=$(curl -s --max-time 10 "$URL/rest/v1/cities?select=id" -H "apikey: $KEY" | grep -o '"id"' | wc -l)
echo "   • Villes : $N_CITY (attendu ≈ 15)"
FEE=$(curl -s --max-time 10 "$URL/rest/v1/site_settings?select=value&key=eq.publication_fee" -H "apikey: $KEY" | head -c 60)
echo "   • publication_fee : $FEE (attendu : {\"value\":\"500\"} ou similaire)"

# 4. Auth
echo ""
echo "④ Endpoint Auth…"
AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  "$URL/auth/v1/health" -H "apikey: $KEY")
[ "$AUTH_CODE" = "200" ] && echo "   ✅ Supabase Auth opérationnel (HTTP 200)" || echo "   ⚠️  Auth → HTTP $AUTH_CODE"

# 5. Storage
echo ""
echo "⑤ Buckets Storage…"
STOR=$(curl -s --max-time 10 "$URL/storage/v1/bucket" -H "apikey: $KEY")
for b in listing-images profile-avatars exchange-images support-attachments; do
  echo "$STOR" | grep -q "\"$b\"" && echo "   ✅ $b" || echo "   ❌ $b absent (migration 0004 non exécutée ?)"
done

echo ""
echo "============================================================"
echo "📋 Rapport terminé. Envoyer la sortie à l'assistant pour la suite."
