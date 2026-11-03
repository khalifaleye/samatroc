#!/usr/bin/env bash
# =============================================================================
# SAMATROC 🇸🇳 — Régénération du fichier bootstrap-all-in-one.sql
# -----------------------------------------------------------------------------
# Concatène, DANS L'ORDRE, les migrations versionnées + le seed en un seul
# fichier destiné au copier-coller dans le SQL Editor du Dashboard Supabase.
#
# Utilisation :  bash supabase/build-bootstrap.sh
# À relire après chaque ajout de migration dans supabase/migrations/.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="supabase/bootstrap-all-in-one.sql"
FILES=(supabase/migrations/*.sql supabase/seed.sql)

{
  echo "-- ============================================================================="
  echo "-- SAMATROC 🇸🇳 — BOOTSTRAP ALL-IN-ONE (généré automatiquement)"
  echo "-- -----------------------------------------------------------------------------"
  echo "-- CE FICHIER CONTIENT, DANS L'ORDRE :"
  local_i=1
  for f in "${FILES[@]}"; do
    echo "--   ${local_i}. $f"
    local_i=$((local_i + 1))
  done
  echo "--"
  echo "-- UTILISATION : Dashboard Supabase → SQL Editor → New query → coller CE fichier"
  echo "-- en entier → Run (une seule exécution suffit)."
  echo "--"
  echo "-- ⚠️  NE PAS exécuter deux fois sans réinitialisation (create table non idempotent)."
  echo "--     Pour les mises à jour ultérieures, utiliser les migrations individuelles"
  echo "--     via la Supabase CLI (supabase db push)."
  echo "--"
  echo "-- Régénérer ce fichier : supabase/build-bootstrap.sh"
  echo "-- ============================================================================="
  for f in "${FILES[@]}"; do
    echo ""
    echo "-- ╔═══════════════════════════════════════════════════════════════════════════╗"
    echo "-- ║ FICHIER : $f"
    echo "-- ╚═══════════════════════════════════════════════════════════════════════════╝"
    echo ""
    cat "$f"
  done
} > "$OUT"

echo "✅ $OUT régénéré ($(wc -l < "$OUT") lignes, $(echo "${#FILES[@]}") fichiers SQL fusionnés)."
