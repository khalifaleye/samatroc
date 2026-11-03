# Guide 03 — Déploiement Vercel

## 1. Vérifier le fonctionnement local AVANT de déployer

```bash
bun install
bun run lint          # 0 erreur
bun run dev           # l'app répond sur http://localhost:3000
```

## 2. Importer le projet

1. https://vercel.com/new → **Import Git Repository** → sélectionner
   `<organisation>/samatroc` (autoriser l'accès GitHub si demandé).
2. *Framework Preset* : **Next.js** (auto-détecté) — commande de build par
   défaut conservée (`next build` ; `bun install` détecté automatiquement).
3. NE PAS déployer avant l'étape 3 (variables d'environnement).

## 3. Configurer les variables d'environnement

*Project Settings → Environment Variables* — renseigner pour les trois
environnements (**Production**, **Preview**, **Development**) :

| Variable | Production | Preview/Dev |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL projet `samatroc-prod` | URL projet `samatroc-dev` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon **prod** | anon **dev** |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role **prod** | service_role **dev** |
| `AUTH_SECRET` | chaîne aléatoire 32+ | différente de la prod |
| `NEXT_PUBLIC_SITE_URL` | `https://samatroc.sn` | URL de preview |
| `PAYMENT_MODE` | `LIVE` (après contrat Wave/OM) | `TEST` |
| `PAYMENT_WEBHOOK_SECRET` | secret HMAC **prod** | secret HMAC **test** |
| `PAYMENT_API_KEY` / `PAYMENT_API_SECRET` | clés live | clés test |
| `PUBLICATION_FEE` | `500` | `500` |

⚠️ **Jamais de clés de test en production** (cahier des charges §12).
Déployer (*Deploy*) puis vérifier que le site répond en HTTPS (actif par
défaut sur Vercel).

## 4. Configurer le domaine

*Project Settings → Domains → Add* : `samatroc.sn` + `www.samatroc.sn`.
Chez le registrar (OVH, Namecheap…) : créer les enregistrements indiqués par
Vercel (`A 76.76.21.21` ou `CNAME cname.vercel-dns.com`). Le certificat TLS
est émis automatiquement (Let's Encrypt).

## 5. URLs de redirection Supabase Auth

Pour chaque projet Supabase (prod et dev) :
*Authentication → URL Configuration* :
- Site URL = domaine de l'environnement correspondant
- Redirect URLs = `https://samatroc.sn/**`, `https://*-<equipe>.vercel.app/**`

## 6. Webhooks de paiement

Donner au prestataire (Wave / Orange Money / agrégateur) l'URL :

```
https://samatroc.sn/api/payments/webhook
```

Le endpoint vérifie la signature HMAC (`x-samatroc-signature`), idempotence
incluse. En préproduction, utiliser
`https://<preview>.vercel.app/api/payments/webhook` avec le secret de test.

## 7. Tests de production (avant ouverture au public)

- [ ] Inscription + e-mail de confirmation reçu
- [ ] Connexion / déconnexion / mot de passe oublié
- [ ] Création d'annonce + téléversement de photos (→ bucket Storage)
- [ ] Paiement en mode TEST puis LIVE sur une vraie transaction de 500 FCFA
- [ ] Confirmation webhook → annonce **PUBLISHED** (une seule fois)
- [ ] Proposition d'échange + messagerie temps réel
- [ ] Favoris, notifications, signalement
- [ ] Accès `/admin` avec un compte utilisateur standard → refusé
- [ ] Requête forgée (muter `role` via API) → refusée par RLS
- [ ] Lighthouse mobile > 90 / logs Vercel sans erreur

## 8. Environnements distincts — récapitulatif

| | Production | Préproduction | Développement |
|---|---|---|---|
| Branche | `main` | `staging` | `develop` / PR |
| Vercel | samatroc.sn | `*-staging.vercel.app` | previews |
| Supabase | samatroc-prod | samatroc-staging | samatroc-dev |
| Paiements | LIVE | TEST | TEST |
| Données | réelles | anonymisées | démo |
