# Guide 08 — Tests de sécurité (exécution et couverture)

## Exécuter la suite

Prérequis : un PostgreSQL local (ou Docker) disponible. Le runner simule
l'environnement Supabase (schémas `auth`/`storage`, rôles
anon/authenticated/service_role, `auth.uid()`) **uniquement pour les tests** —
`local_bootstrap.sql` ne doit jamais être exécuté sur un projet Supabase réel.

```bash
# PostgreSQL local (exemple : cluster embarqué déjà utilisé en validation)
TEST_DATABASE_URL="postgres://postgres@127.0.0.1:54329/postgres" \
  bun supabase/tests/run-tests.mjs
```

Sortie attendue (base remise à zéro à chaque exécution) :

```
══════════ RÉSULTAT : 55 PASS / 0 FAIL ══════════
```

> Sur un projet Supabase réel, préférer : `supabase test db` avec les mêmes
> sondes, ou rejouer la matrice depuis le SQL Editor avec
> `set local role authenticated; set local request.jwt.claims='{"sub":"…"}';`

## Matrice couverte (55 vérifications)

| Domaine | Vérifications clés |
|---|---|
| Annonces (8) | création propriétaire, insertion directe `PUBLISHED` refusée, anonyme ne voit que le publié, tiers invisible, auto-publication refusée, désactivation owner OK, modification tiers sans effet |
| Paiements (12) | `create_payment` propriétaire, lecture privée, insertion client refusée, **confirmation client impossible**, `verify_payment` réservée service_role, activation après confirmation, montant/devise vérifiés, annonce non activée si montant invalide, **idempotence**, un seul `SUCCESSFUL` par annonce |
| Messagerie (5) | dédoublonnage conversation, envoi participant, **usurpation d'expéditeur refusée**, participant lit, non-participant ne lit rien |
| Favoris/propositions/notifications (9) | favoris idempotents et privés, proposition créée, invisible aux tiers, tiers ne peut accepter, proposant ne peut s'auto-accepter, seul destinataire décide, notifications privées |
| Profils (5) | édition de ses champs OK, **auto-promotion admin impossible**, compte tiers protégé, vue publique sans email/téléphone, compte suspendu bloqué |
| Administration (8) | modération refusée aux utilisateurs, admin publie, `admin_logs` invisible/visible/inscriptible, `admin_stats` correcte et réservée, second super admin refusé |
| Signalements/paramètres (4) | création OK, privés entre utilisateurs, paramètres publics/protégés |
| Infrastructure (4) | 4 buckets, publication Realtime (4 tables), seed complet (36 catégories, 16 villes), `publication_fee=500` |

## Ajouter un test

Dans `supabase/tests/run-tests.mjs`, réutiliser le pattern :

```js
// Sonde positive : l'action doit réussir
await asUser("authenticated", userId, (tx) => tx`…`);

// Sonde négative : l'action doit être refusée (erreur OU 0 ligne)
let denied = false;
const res = await asUser("authenticated", userId, (tx) =>
  tx`… returning id`.catch(() => { denied = true; }));
report("RLS-XX Description", denied || res.length === 0);
```

> ⚠️ Piège RLS : un `UPDATE`/`DELETE` sur des lignes invisibles ne renvoie
> **pas d'erreur** — il affecte 0 ligne. Toujours utiliser `returning id` pour
> les sondes négatives d'écriture.
