# Guide 07 — Bascule progressive de l'application vers Supabase

> Principe (cahier des charges) : **progressivement, sans casser les
> fonctionnalités déjà opérationnelles.** L'application fonctionne aujourd'hui
> en mode démo (SQLite + auth maison + disque) ; ce guide décrit la bascule.

## Vue d'ensemble des deux modes

| | Mode démo (actuel) | Mode Supabase (cible) |
|---|---|---|
| Variables | Supabase vides | URL + anon + service_role renseignées |
| Base | SQLite / Prisma | PostgreSQL Supabase |
| Auth | JWT maison (cookie `samatroc_session`) | Supabase Auth (cookies @supabase/ssr) |
| Upload | `/public/uploads` | bucket `listing-images`… |
| Temps réel | polling | canaux Supabase Realtime |

Dès que les variables Supabase sont renseignées, **l'upload bascule
automatiquement** (adaptateur dans `/api/upload`) et le middleware rafraîchit
les sessions Auth. Le reste se bascule route par route.

## Étape A — La base : Prisma sur le PostgreSQL Supabase

Les tables sont créées par les migrations SQL (source de vérité). Prisma se
branche dessus **sans `db push`** :

```bash
cp prisma/schema.prisma prisma/schema.sqlite-backup.prisma
cp prisma/schema.supabase.prisma prisma/schema.prisma

# .env
DATABASE_URL="postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:5432/postgres"

bunx prisma generate        # génère le client typé — NE PAS lancer db push
```

⚠️ Prisma se connecte avec le rôle `postgres` (backend de confiance) : il
contourne la RLS **par design** — c'est le rôle serveur. Les politiques RLS
continuent de protéger les accès directs (clé anon, Realtime, PostgREST).

## Étape B — Renommages à appliquer dans les routes (mécanique)

Le schéma de production renomme les modèles et quelques colonnes. Checklist
(par ordre de fréquence) :

| Avant (démo) | Après (Supabase) | Notes |
|---|---|---|
| `db.user` | `db.profile` | table `profiles` |
| `user.firstName`, `lastName` | `profile.fullName` | |
| `user.status` | `profile.accountStatus` | enum `AccountStatus` |
| `user.passwordHash` | *(supprimé)* | auth via Supabase Auth |
| `user.isDemo` | *(supprimé)* | marquage démo géré par seed |
| `profile.bio/quartier/showPhone/whatsappEnabled` | `profile.neighborhood/showPhone` (+ `show_phone`) | |
| `listing.wantedText` | `listing.desiredItem` | |
| `listing.wantedCategory` | `listing.desiredCategoryId` (uuid) | |
| `listing.wantedMultiple` | `listing.desiredMultiple` | |
| `listing.moderationNote/refusalReason` | identiques | extras documentés |
| `payment.reference` | `payment.transactionReference` | |
| `payment.provider` | `payment.paymentProvider` | enum |
| `payment.status "SUCCESS"` | `payment.status "SUCCESSFUL"` | enum |
| `proposal.offeredListingId` | `proposal.proposedListingId` | |
| `proposal.offeredText` | `proposal.proposedDescription` | |
| `proposal.status "DISCUSSING"` | `"COUNTERED"` | enum spec |
| conversation `userAId/userBId` | `conversation_participants` | voir étape C |
| `message.readAt` | `message.isRead` | booléen spec |
| `notification.body/linkView/linkParams` | `notification.message/relatedId` | |
| `report.targetType/targetId` | `report.listingId/reportedUserId` | |
| `report.handledById/resolution` | `report.adminNotes/status` | |
| `siteSetting.key/value` | `settingKey/settingValue` | |

**Conversations** : le modèle démo utilise `userAId/userBId` ; la spec utilise
`conversations` + `conversation_participants`. Adapter `/api/conversations`
avec `db.conversationParticipant.findMany({ where: { userId } })` puis charger
les conversations ; l'unicité (paire + annonce) se vérifie applicativement
(ou via la fonction SQL `create_conversation`).

## Étape C — Authentification

`src/lib/auth.ts` (JWT maison) est remplacé par :

```ts
import { getSupabaseServerClient, getSupabaseUser } from "@/lib/supabase/server";

// getSessionUser() équivalent :
const user = await getSupabaseUser();          // null si non connecté
const { data: profile } = await (await getSupabaseServerClient())!
  .from("profiles").select("*").eq("id", user!.id).single();
// profile.accountStatus === "SUSPENDED" → traiter comme non connecté
```

- Inscription : `supabase.auth.signUp({ email, password, options.data: { full_name } })`
  → le trigger SQL crée automatiquement le profil (`handle_new_user`).
- Connexion : `supabase.auth.signInWithPassword`
- Déconnexion : `supabase.auth.signOut()`
- Oubli de mot de passe : `supabase.auth.resetPasswordForEmail(email)`
- Refresh de session : déjà géré par `src/proxy.ts`.

Les pages de connexion/inscription (vues React existantes) gardent leur
identité visuelle : seuls les appels `fetch('/api/auth/…')` deviennent des
appels SDK — ou mieux, les routes `/api/auth/*` sont réécrites pour déléguer
au SDK (l'UI ne change pas).

## Étape D — Ordre de bascule recommandé (par lot, testable)

1. **Lecture publique** : `/api/listings`, `/api/categories`, `/api/cities`,
   `/api/stats` — requêtes simples, faible risque.
2. **Auth** : `/api/auth/*` + middleware + guards client.
3. **Annonces** : création/modification/suppression + `/api/upload` (déjà
   dual-mode) — tester le flux 4 étapes complet.
4. **Paiements** : `/api/payments/*` → créer les transactions via
   `create_payment()` SQL et confirmer via `verifyPaymentServerSide()`
   (webhook inchangé).
5. **Échanges & messagerie** : propositions via `create_exchange_proposal()` /
   `respond_to_exchange()` ; conversations via `create_conversation()` +
   `send_message()` ; activer les souscriptions Realtime
   (`src/lib/supabase/realtime.ts`) dans les vues messages/notifications.
6. **Administration** : `admin_stats()` + `moderate_listing()` +
   `resolve_report()` — le back-office existant appelle ces RPC.

Après chaque lot : `bun run lint`, parcours manuel sur l'aperçu, puis commit
vers `develop` → preview Vercel.

## Étape E — Jeu de démonstration

Ne JAMAIS mélanger démo et production :

- **Démo/dev** : `samatroc-dev`, comptes fictifs marqués (aucun admin factice
  créé par le seed — voir seed.sql § en-tête).
- **Prod** : uniquement des données réelles ; le flag
  `site_settings.demo_data = 'false'` est fourni par le seed.
