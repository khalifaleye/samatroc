# Guide 06 — Création du premier super administrateur

> Règle du cahier des charges §5 : le premier super administrateur est créé
> par une **opération sécurisée côté serveur**. Aucun utilisateur ne peut
> devenir administrateur en modifiant une requête ou un champ de profil
> (garanti par les grants de colonnes — testé : `RLS-33`).

## Principe de sécurité

1. La fonction `setup_first_super_admin(email)` est :
   - **SECURITY DEFINER**, réservée à `service_role` et à la console SQL
     (`revoke … from anon, authenticated`) ;
   - **refusée si un SUPER_ADMIN existe déjà** (elle ne peut servir qu'une
     seule fois) ;
   - **journalisée** dans `admin_logs`.
2. Le rôle d'un profil n'est modifiable ni par son propriétaire ni par quiconque
   via l'API HTTP : seuls le backend (service_role) et cette fonction le peuvent.

## Procédure (5 minutes)

### Étape 1 — Créer le compte normalement

S'inscrire via l'application (email + mot de passe) avec l'adresse qui doit
devenir administrateur, par exemple `admin@samatroc.sn`, et confirmer l'e-mail.
Le trigger `handle_new_user` a créé le profil associé (rôle `USER`).

### Étape 2 — Exécuter l'opération sécurisée

**Dashboard Supabase → SQL Editor → New query** :

```sql
select public.setup_first_super_admin('admin@samatroc.sn');
```

Réponses possibles :

| Résultat | Signification |
|---|---|
| `SUPER_ADMIN_CREE` | ✅ succès |
| `SUPER_ADMIN_DEJA_EXISTANT` | un super admin existe déjà — refusé |
| `PROFIL_INTROUVABLE_INSCRIVEZ_DABORD` | l'utilisateur ne s'est pas encore inscrit |
| erreur `OPERATION_RESERVEE_AU_SERVEUR` | tentative depuis un rôle HTTP (normal) |

### Étape 3 — Vérifier

```sql
select full_name, email, role, account_status
  from public.profiles
 where role in ('ADMIN', 'SUPER_ADMIN');
```

Puis se connecter à l'application : le menu **Administration** apparaît
(l'accès est de toute façon revérifié côté serveur sur chaque route `/api/admin/*`
— un bouton d'interface n'est jamais une protection, cf. cahier des charges §4).

### Étape 4 — Créer les administrateurs suivants

Une fois connecté en super administrateur, l'interface d'administration
permet de promouvoir un utilisateur existant (l'action passe par le backend
`service_role`, jamais par une requête client, et est journalisée).

## En cas de perte d'accès administrateur

1. Se connecter au Dashboard Supabase (accès propriétaire du projet).
2. Vérifier qu'aucun SUPER_ADMIN n'est actif :
   ```sql
   select * from public.profiles where role = 'SUPER_ADMIN';
   ```
3. Si le compte existe mais est bloqué (2FA perdue…) : suspendre puis
   réactiver via SQL, ou créer un second compte et relancer la procédure
   **uniquement si aucun SUPER_ADMIN actif n'existe** (garde automatique).

## Journalisation

Chaque opération d'administration est tracée :

```sql
select created_at, action, target_type, details
  from public.admin_logs
 order by created_at desc
 limit 20;
```
