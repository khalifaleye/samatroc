# Guide 04 — Configuration des paiements (Wave / Orange Money)

## 1. Modèle économique (rappel cahier des charges §18)

- **Consultation gratuite**, publication d'annonce **à partir de 500 FCFA**
  (frais de publication, jamais le prix de l'objet).
- Contrainte base de données : `amount >= 500` (CHECK) et
  `publication_fee >= 500` (CHECK).
- Un seul paiement `SUCCESSFUL` par annonce (index partiel unique) →
  activation double **physiquement impossible**.

## 2. Parcours complet (implémenté)

```
1. create_listing()          → annonce DRAFT / PENDING_PAYMENT
2. create_payment()          → transaction ST-PAY-XXXXXXXX (statut PENDING)
3. Initialisation prestataire (Wave/OM) via PAYMENT_API_KEY
4. Webhook prestataire       → POST /api/payments/webhook
5. Vérification signature HMAC-SHA256 (x-samatroc-signature, corps BRUT)
6. verify_payment() [service_role] : référence + montant + devise
7. Enregistrement transactionnel (statut + confirmed_at)
8. publish_listing() → PUBLISHED + expires_at = now() + 90 jours
9. Notification utilisateur (PAYMENT_CONFIRMED)
```

Idempotence garantie à trois niveaux :
- `payments_one_successful_per_listing_idx` (base) ;
- garde `status in ('PENDING','PROCESSING')` dans `verify_payment` (base) ;
- `provider_transaction_id` unique (base) — un webhook rejoué ne fait rien.

## 3. Obtenir les accès prestataires (action humaine)

| Prestataire | Démarche | Délai habituel |
|---|---|---|
| **Wave Business** | https://business.wave.com — création compte marchand sénégalais, pièce d'identité + REGISTRE DE COMMERCE, activation API dans le tableau de bord | 1 à 2 semaines |
| **Orange Money** | Via l'agence Orange Digital Center / partenariat Orange Money Web Senegal (contrat marchand) ou un **agrégateur** | 2 à 4 semaines |
| **Agrégateur (recommandé)** | PayDunya, Bictorys, CinetPay : un seul contrat → Wave + OM + Free Money, webhook unique, sandbox immédiat | 48 h à 1 semaine |

Après signature, récupérer : `PAYMENT_API_KEY`, `PAYMENT_API_SECRET`,
l'URL du sandbox et le secret de signature webhook.

## 4. Renseigner la configuration

```bash
# .env (et Vercel — jamais committé)
PAYMENT_MODE="TEST"              # TEST → LIVE après vérification
PAYMENT_WEBHOOK_SECRET="<secret-fourni-par-le-prestataire>"
PAYMENT_API_KEY="<clé publique>"
PAYMENT_API_SECRET="<secret>"
```

> Si `PAYMENT_MODE=TEST` ou clés vides : la plateforme reste en **mode test
> clairement identifié** (badge dans l'interface de paiement, transactions
> `payment_provider = 'TEST'`). Aucun débit réel. En `LIVE`, le endpoint
> d'initiation appelle l'API du prestataire avec les clés serveur uniquement.

## 5. Signature et sécurité du webhook

Le endpoint `/api/payments/webhook` :

1. lit le **corps brut** (jamais `req.json()` avant vérification) ;
2. calcule `HMAC-SHA256(corps, PAYMENT_WEBHOOK_SECRET)` et compare (timing-safe)
   à l'en-tête `x-samatroc-signature` ;
3. refuse tout statut transmis par le navigateur (le client ne peut pas
   confirmer un paiement — testé : `RLS-12`) ;
4. transmet référence + id prestataire + montant + devise à
   `verify_payment()` qui fait autorité.

Configurer chez le prestataire : URL = `https://samatroc.sn/api/payments/webhook`,
événements = `payment.succeeded`, `payment.failed`.

## 6. Procédure de test (mode TEST)

1. Créer une annonce → l'état passe à *En attente de paiement*.
2. Régler 500 FCFA via l'écran de paiement TEST.
3. Vérifier : transaction `SUCCESSFUL`, annonce `PUBLISHED`, notification
   reçue, et **rejouer le webhook** → `ALREADY_CONFIRMED` (aucun effet).
4. Envoyer un webhook avec montant `400` → `AMOUNT_MISMATCH`, annonce NON
   activée (testé : `RLS-16`/`RLS-17`).

## 7. Remboursements & litiges

- Statut `REFUNDED` prévu dans l'enum ; le remboursement s'effectue depuis la
  console du prestataire, puis l'administrateur met à jour le paiement via le
  back-office (service_role) et désactive l'annonce si nécessaire
  (`moderate_listing` action `DEACTIVATE`).
- Journaliser chaque action (table `admin_logs` — automatique via fonctions).
