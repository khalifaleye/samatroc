# SamaTroc 🇸🇳

**Plateforme sénégalaise d'échange d'objets entre particuliers.**
Slogan : Échangez • Économisez • Donnez une seconde vie.

SamaTroc permet aux particuliers de publier des objets dont ils n'ont plus besoin et de les proposer à l'échange contre d'autres articles. La plateforme est un **service de mise en relation** : elle ne rachète pas les objets, ne fixe pas leur valeur, ne gère ni la livraison ni l'échange physique. Les utilisateurs organisent librement leurs échanges.

---

## 1. Démarrage rapide

```bash
# 1. Installer les dépendances
bun install

# 2. Configurer l'environnement
cp .env.example .env
# (en dev, les valeurs par défaut suffisent)

# 3. Créer la base de données et pousser le schéma
bun run db:push

# 4. Charger les données de démonstration
bun prisma/seed.ts

# 5. Lancer le serveur de développement
bun run dev
```

L'application est servie sur la route `/` (port 3000).

### Comptes de démonstration

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Super administrateur | `admin@samatroc.sn` | `admin1234` |
| Utilisateur (membre) | `moussa@demo.sn` | `demo1234` |
| Autres membres démo | `fatou@demo.sn`, `ousmane@demo.sn`, `awa@demo.sn`, `cheikh@demo.sn`, `mariama@demo.sn`, `ibrahima@demo.sn` | `demo1234` |

> Les comptes de démonstration sont distincts des futurs comptes de production (flag `isDemo` en base). Le jeu de données démo comprend 8 utilisateurs, 24 annonces variées avec photos, 5 propositions d'échange, 4 conversations, 13 paiements de test clairement identifiés et 3 signalements.

---

## 2. Périmètre fonctionnel livré

### Pages publiques
- **Accueil** fidèle à la maquette : bannière photographique, carte des 3 étapes (mention « À partir de 500 FCFA par article »), 9 catégories cliquables, dernières annonces (base de données), encart promotionnel, statistiques communautaires **clairement identifiées comme données de démonstration**, pied de page complet (réseaux sociaux, drapeau Sénégal, liens légaux).
- **Explorateur d'annonces** : recherche par mots-clés (titre, description, objet recherché), filtres catégorie / ville / état / type d'article recherché, tri (récence, pertinence, popularité), pagination, vue grille ou liste.
- **Détail d'annonce** : galerie photos, état, localisation, objet recherché, profil public du propriétaire (numéro jamais exposé sans son accord), boutons « Proposer un échange », « Contacter via la messagerie », WhatsApp (si autorisé), « Signaler », annonces similaires.
- **Toutes les catégories**, **À propos**, **Comment ça marche ?**, **FAQ**, **Contact & assistance** (formulaire → notification aux admins), **Conseils de sécurité**, **CGU**, **Politique de confidentialité**, **Politique de modération**, **Page 404**.
- Contenus éditoriaux stockés en base et modifiables depuis l'administration.

### Authentification et comptes
- Inscription (acceptation des conditions obligatoire), connexion, déconnexion, mot de passe oublié, réinitialisation sécurisée (jeton haché SHA-256, expiration 1 h, usage unique), changement de mot de passe, vérification e-mail (jeton ; en mode démo le lien est fourni dans l'interface, en production brancher un SMTP).
- Mots de passe hachés **bcrypt**, sessions **JWT HS256** en cookie **httpOnly**.
- Rôles : Visiteur / Utilisateur / Administrateur / Super administrateur — contrôlés **côté serveur** sur chaque endpoint.
- Limitation des tentatives de connexion (5 / 15 min), anti-spam inscription/contact/signalements.

### Espace personnel
- Menu latéral complet : Vue d'ensemble, Mon profil, Mes annonces, Publier un article, Mes propositions, Mes échanges, Mes favoris, Ma messagerie, Mes paiements, Notifications, Paramètres, Déconnexion.
- Indicateurs : annonces actives, en attente, propositions reçues/envoyées, échanges réalisés.
- Gestion des annonces : modifier (selon statut), désactiver/réactiver, marquer « échangée », supprimer.

### Publication d'annonce (4 étapes + paiement)
1. **Informations** : titre, description, catégorie/sous-catégorie, état (neuf → état satisfaisant), ville, quartier.
2. **Photos** : téléversement multiple (max 6, JPEG/PNG/WebP, 5 Mo), compression automatique côté client, aperçu, choix de la photo principale, suppression ; validation serveur (types, tailles, magic bytes, noms aléatoires anti-path-traversal).
3. **Ce que je recherche** : objet recherché, catégorie souhaitée, plusieurs types acceptés.
4. **Publication** : récapitulatif + encart « Frais de publication : 500 FCFA par article » (jamais confondu avec le prix de l'objet) + brouillon ou paiement.
- **Statuts d'annonce** : Brouillon, En attente de paiement, Paiement en cours, En attente de modération, Publiée, Refusée (avec motif), Désactivée, Échangée.

### Paiement mobile (mode test clairement identifié)
- Choix du prestataire : **Wave** ou **Orange Money** (architecture prête pour tout agrégateur compatible Sénégal).
- Référence de transaction unique (`ST-PAY-XXXXXXXX`), écran d'attente avec polling du statut, gestion succès/échec/expiration, **prévention des doubles paiements**, historique complet.
- **Confirmation serveur obligatoire** via webhook signé **HMAC-SHA256** (`x-samatroc-signature`) — l'annonce n'est JAMAIS activée sur la seule base d'une redirection navigateur.
- Aucun code PIN Mobile Money n'est demandé ni stocké. Clés et secrets en variables d'environnement uniquement.
- Tant que `PAYMENT_API_KEY` / `PAYMENT_WEBHOOK_SECRET` ne sont pas configurés, la plateforme reste en `PAYMENT_MODE=TEST` avec un bouton explicite « Simuler la confirmation (mode test) ». **Aucun paiement réel n'est simulé comme réussi.**
- Remboursements : statut `REFUNDED` prévu, conforme aux conditions.

### Propositions d'échange
- « Proposer un échange » : sélection d'une annonce personnelle OU description d'un objet avec photos, message facultatif.
- Réponses du propriétaire : accepter, refuser, demander des précisions, contre-proposition ; annulation par le proposant ; « échange réalisé » par les deux parties (l'annonce passe alors en Échangée).
- Statuts : En attente, Acceptée, Refusée, En discussion, Annulée, Échange réalisé.
- Conversation créée automatiquement à l'envoi ; notifications à chaque étape.

### Messagerie interne
- Conversations privées rattachées aux annonces, messages texte, messages système, date/heure (fuseau Africa/Dakar), indicateur de non-lus, polling temps quasi-réel.
- Accès strictement réservé aux participants (contrôle serveur).
- Blocage et signalement depuis la conversation ; WhatsApp/appel uniquement si le propriétaire a choisi d'afficher son numéro.

### Favoris & notifications
- Favoris par annonce (cœur sur les cartes), page dédiée.
- Centre de notifications : proposition reçue/acceptée/refusée, contre-proposition, échange réalisé, nouveau message, confirmation de paiement, publication, refus de modération. Compteurs en temps réel dans la navigation.

### Sécurité et confiance
- Signalement d'annonces / utilisateurs / messages avec motifs ; traitement en administration.
- Blocage d'utilisateurs, modération, détection automatique d'annonces suspectes (mots-clés frauduleux → file de modération), anti-spam, rate limiting, protection SQL (Prisma + échappement LIKE), XSS (React), validation Zod systématique côté serveur, contrôle d'accès par rôle, journalisation des actions sensibles (`admin_logs`).

### Administration
- Tableau de bord : utilisateurs (total, nouveaux 7 j, suspendus), annonces (publiées, en modération, refusées, échangées), paiements (réussis, **chiffre d'affaires brut** des publications), propositions, signalements, exports **CSV** (annonces, paiements, utilisateurs).
- Gestion des utilisateurs : recherche, filtres, suspension/réactivation, modification encadrée, changement de rôle (super admin), historique détaillé.
- Gestion des annonces : filtres, validation, refus avec motif obligatoire, mise en avant, édition administrative, suppression — jamais accès aux secrets de paiement.
- Gestion des paiements : référence, utilisateur, montant, moyen, statut, dates, badge « TEST ».
- Gestion des catégories : création, modification, activation/désactivation, réordonnancement, suppression protégée ; **ajout de villes** (référentiel extensible).
- Gestion des signalements : résoudre / rejeter avec note, notification au déclarant.
- Gestion du contenu : 8 pages éditoriales éditables avec aperçu markdown.
- Paramètres généraux : nom de la plateforme, contacts, réseaux sociaux, tarif de publication, durée de validité des annonces, modération automatique, statistiques de démonstration, bannière d'annonce.
- **Journal administratif** : traçabilité de toutes les opérations sensibles.

---

## 3. Architecture technique

| Composant | Choix |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript strict |
| Interface | Tailwind CSS 4 + shadcn/ui (New York) + Lucide + sonner |
| Base de données | **SQLite** (développement) — schéma Prisma portable vers **PostgreSQL** en production |
| ORM | Prisma 6 (`prisma/schema.prisma`) |
| Authentification | JWT HS256 (jose) en cookie httpOnly + bcryptjs |
| Validation | Zod côté serveur sur toutes les entrées |
| État client | Zustand (routeur de vues + authentification) |
| Images | next/image + compression client + stockage local `/public/uploads` (cloud storage en production) |

### Structure du projet
```
prisma/schema.prisma      14 tables : users, profiles, categories, cities, listings,
                          listing_images, payments, exchange_proposals, conversations,
                          messages, favorites, notifications, reports, admin_logs,
                          site_settings, site_content, password_reset_tokens, verification_tokens
prisma/seed.ts            Données de démonstration
src/app/api/…             ~45 endpoints REST (voir src/docs/API.md)
src/app/page.tsx          Route unique "/" (routeur de vues client)
src/components/           Navbar, Footer (sticky), ListingCard, Logo SVG, CategoryIcon, guards
src/lib/                  auth, api-utils (erreurs/erreurs Zod), rate-limit, validators,
                          serializers, payments (webhook/finalisation), constants (FCFA, Dakar)
src/stores/               router-store (navigation par vues), auth-store
src/views/                public/ auth/ account/ admin/ — 40 vues
src/docs/                 API.md (contrat complet) + FRONTEND-GUIDE.md
```

### Modèle économique
- Consultation : **gratuite**.
- Publication : **à partir de 500 FCFA par article** (paramétrable dans l'administration).
- Aucun paiement de la valeur des objets ne transite par la plateforme ; aucune commission.
- Évolutions prévues sans refonte : annonces sponsorisées (champ `featured` déjà opérationnel), packs, publicité.

### Réalité sénégalaise
Français, FCFA, fuseau Africa/Dakar, numéros au format sénégalais (+221), 15 villes (Dakar, Thiès, Mbour, Saint-Louis, Kaolack, Ziguinchor, Touba…), Wave/Orange Money, contact WhatsApp facultatif, statistiques de démonstration clairement identifiées.

---

## 4. Déploiement

### Vercel (recommandé) ou équivalent
1. Créer une base **PostgreSQL** (Neon, Supabase, Railway…).
2. Renseigner les variables d'environnement (voir `.env.example`) : `DATABASE_URL`, `AUTH_SECRET` (32+ caractères aléatoires), `NEXT_PUBLIC_SITE_URL`, `PAYMENT_MODE=LIVE` + secrets du prestataire.
3. Dans `prisma/schema.prisma`, passer `provider = "postgresql"` puis `bun run db:push`.
4. Déployer ; exécuter le seed éventuel sans les comptes de démo en production.
5. **Stockage des photos** : remplacer `/api/upload` par un bucket cloud (S3/Supabase Storage) et servir via CDN.

### Configuration des paiements (production)
1. Contracter avec un agrégateur officiellement compatible Sénégal (Wave Business, Orange Money via agrégateur agréé, PayDunya, CinetPay…).
2. Renseigner `PAYMENT_MODE=LIVE`, `PAYMENT_API_KEY`, `PAYMENT_API_SECRET`, `PAYMENT_WEBHOOK_SECRET`.
3. Déclarer l'URL du webhook chez le prestataire : `POST https://votre-domaine/api/payments/webhook` — corps `{ reference, status: "SUCCESS"|"FAILED", providerRef }`, header `x-samatroc-signature` = HMAC-SHA256 hex du corps brut avec `PAYMENT_WEBHOOK_SECRET`.
4. Adapter `POST /api/payments/initiate` pour appeler l'API du prestataire (initiation + URL de redirection) — la finalisation reste gérée par `src/lib/payments.ts` (jamais côté client).
5. Tester avec une transaction réelle à 500 FCFA puis vérifier : webhook reçu → signature valide → annonce activée → notifications émises.

### Mises à jour et sauvegardes
- Sauvegardes régulières de la base (`pg_dump` en production) et du dossier `uploads/`.
- `bun run lint` avant chaque déploiement ; migrations Prisma versionnées en production (`prisma migrate`).

---

## 5. Documentation complémentaire

- `src/docs/API.md` — contrat complet des 45 endpoints (requêtes, réponses, erreurs).
- `src/docs/FRONTEND-GUIDE.md` — conventions UI, palette, routeur de vues.
- `.env.example` — toutes les variables d'environnement documentées.

## 6. Limites connues & évolutions prévues

- **Route unique `/`** : l'application fonctionne en « vues client » (routeur Zustand) pour l'aperçu sandbox ; en production, mapper chaque vue sur une vraie route Next.js (`/annonces`, `/annonce/[id]`…) — le découpage est déjà isolé dans `src/views/`.
- Vérification e-mail réelle à brancher sur un SMTP (jetons déjà opérationnels).
- Vérification du numéro de téléphone par SMS à brancher sur un fournisseur (structure `phoneVerified` prête).
- Messagerie par polling (4 s) ; évolution possible vers WebSocket pour le temps réel.
- Expiration automatique des annonces : `expiresAt` est posé (durée configurable) ; ajouter un job planifié pour le statut EXPIRED + notification.
- PWA : manifest livré ; ajouter un service worker pour le mode hors-ligne.
