/**
 * SAMATROC — Orchestrateur de validation des migrations Supabase
 * ---------------------------------------------------------------
 * Exécute sur un PostgreSQL local (environnement Supabase simulé) :
 *   1. bootstrap de test (schémas auth/storage, rôles)
 *   2. les 5 migrations SQL versionnées
 *   3. le seed (catégories, villes, paramètres)
 *   4. la matrice de tests RLS (46 vérifications de sécurité)
 *
 * Usage :  bun supabase/tests/run-tests.mjs
 * Sortie :  rapport PASS/FAIL détaillé + code de sortie 1 en cas d'échec.
 */
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONNECTION = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/postgres";

const sql = postgres(CONNECTION, { max: 1, onnotice: () => {} });

let pass = 0;
let fail = 0;
const failures = [];

function report(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ✅ PASS  ${name}`);
  } else {
    fail++;
    failures.push({ name, detail });
    console.log(`  ❌ FAIL  ${name} ${detail ? "— " + detail : ""}`);
  }
}

async function runFile(file) {
  const content = fs.readFileSync(file, "utf8");
  await sql.unsafe(content);
  console.log(`📄 Exécuté : ${path.basename(file)}`);
}

/**
 * Exécute une sonde RLS sous un rôle + identité JWT simulés.
 * La transaction est COMMITTÉE (les actions de mise en place persistent).
 * Si une requête échoue (sonde négative), PostgreSQL annule la transaction
 * entière — le COMMIT final se comporte alors en ROLLBACK.
 */
async function asUser(role, sub, fn) {
  const conn = await sql.reserve();
  try {
    await conn.unsafe("begin");
    if (role) {
      await conn.unsafe(`set local role ${role}`);
      if (sub) {
        await conn.unsafe(`set local request.jwt.claims = '${JSON.stringify({ sub })}'`);
      }
    }
    return await fn(conn);
  } finally {
    try {
      await conn.unsafe("commit");
    } catch {
      /* transaction en échec → COMMIT = ROLLBACK */
    }
    conn.release();
  }
}

const UUID = () => sql`select gen_random_uuid() as id`.then((r) => r[0].id);

async function main() {
  console.log(`\n🧪 Validation SamaTroc sur ${CONNECTION}\n`);
  const t = path.join.bind(path, __dirname);
  const m = (n) => t("..", "migrations", n);

  // 0. Remise à zéro (les runs sont reproductibles)
  await sql.unsafe(`
    drop schema if exists public cascade;
    drop schema if exists auth cascade;
    drop schema if exists storage cascade;
    drop publication if exists supabase_realtime;
    create schema public;
  `);
  console.log("🧹 Schémas remis à zéro");

  // 1-3. Bootstrap + migrations + seed
  await runFile(t("local_bootstrap.sql"));
  for (const f of [
    m("20260101000001_init.sql"),
    m("20260101000002_functions.sql"),
    m("20260101000003_rls.sql"),
    m("20260101000004_storage.sql"),
    m("20260101000005_realtime.sql"),
    t("..", "seed.sql"),
  ]) {
    await runFile(f);
  }

  // ------------------------------------------------------------------
  // Données de test : 3 comptes (A utilisateur, B utilisateur, C admin)
  // ------------------------------------------------------------------
  const userA = await UUID();
  const userB = await UUID();
  const userC = await UUID();
  const userD = await UUID();

  await sql`insert into auth.users (id, email, raw_user_meta_data) values
    (${userA}::uuid, 'awa@test.sn', ${JSON.stringify({ full_name: "Awa Diop" })}::jsonb),
    (${userB}::uuid, 'moussa@test.sn', ${JSON.stringify({ full_name: "Moussa Ndiaye" })}::jsonb),
    (${userC}::uuid, 'admin@test.sn', ${JSON.stringify({ full_name: "Admin SamaTroc" })}::jsonb),
    (${userD}::uuid, 'suspendu@test.sn', ${JSON.stringify({ full_name: "Compte Suspendu" })}::jsonb)`;

  // C = administrateur, D = suspendu
  await sql`update public.profiles set role = 'SUPER_ADMIN' where id = ${userC}::uuid`;
  await sql`update public.profiles set account_status = 'SUSPENDED' where id = ${userD}::uuid`;

  const cat = (await sql`select id from public.categories where parent_id is null order by display_order limit 1`)[0].id;

  console.log("\n━━━ ANNONCES : création, visibilité, transitions sensibles ━━━");

  // 1. A crée son annonce en attente de paiement (insert direct autorisé)
  const listingA = await UUID();
  await asUser("authenticated", userA, (tx) =>
    tx`insert into public.listings (id, user_id, category_id, title, slug, description, city, desired_item, status)
       values (${listingA}::uuid, ${userA}::uuid, ${cat}::uuid, 'Vélo VTT 26 pouces', 'velo-vtt-26-test',
       'VTT révisé, pneus neufs, parfait pour Dakar.', 'Dakar', 'casque de vélo', 'PENDING_PAYMENT')`
  );
  report("RLS-01 Propriétaire crée son annonce (PENDING_PAYMENT)", true);

  // 2. Insertion directe en PUBLISHED par le client → refusée
  const fraudeId = await UUID();
  let denied = false;
  await asUser("authenticated", userA, (tx) =>
    tx`insert into public.listings (id, user_id, category_id, title, slug, description, city, desired_item, status)
       values (${fraudeId}::uuid, ${userA}::uuid, ${cat}::uuid, 'Fraude', 'fraude-test',
       'Tentative de publication sans paiement.', 'Dakar', 'rien', 'PUBLISHED')`.catch(() => { denied = true; })
  );
  report("RLS-02 Insertion directe en PUBLISHED refusée (paiement obligatoire)", denied);

  // 3. Un anonyme ne voit que les annonces publiées
  const anonVisible = await asUser("anon", null, (tx) => tx`select count(*)::int as c from public.listings`);
  report("RLS-03 Anonyme ne voit aucune annonce non publiée", anonVisible[0].c === 0, `vu=${anonVisible[0].c}`);

  // 4. B ne voit pas l'annonce de A (non publiée)
  const bSeesA = await asUser("authenticated", userB, (tx) =>
    tx`select count(*)::int as c from public.listings where id = ${listingA}::uuid`);
  report("RLS-04 Autre utilisateur ne voit pas l'annonce non publiée", bSeesA[0].c === 0);

  // 5. A ne peut PAS se publier lui-même (transition sensible réservée serveur)
  denied = false;
  await asUser("authenticated", userA, (tx) =>
    tx`update public.listings set status = 'PUBLISHED' where id = ${listingA}::uuid`.catch(() => { denied = true; })
  );
  report("RLS-05 Auto-publication par le propriétaire refusée", denied);

  // 6. A peut désactiver puis réactiver sa propre annonce (statuts non sensibles)
  await asUser("authenticated", userA, async (tx) => {
    await tx`update public.listings set status = 'INACTIVE' where id = ${listingA}::uuid`;
    await tx`update public.listings set status = 'PENDING_PAYMENT' where id = ${listingA}::uuid`;
  });
  report("RLS-06 Propriétaire peut désactiver/réactiver (INACTIVE)", true);

  // 7. B ne peut pas modifier l'annonce de A (ligne invisible → 0 ligne modifiée)
  const pirated = await asUser("authenticated", userB, (tx) =>
    tx`update public.listings set title = 'piraté' where id = ${listingA}::uuid returning id`);
  report("RLS-07 Modification par un tiers sans effet (0 ligne)", pirated.length === 0);

  console.log("\n━━━ PAIEMENTS : lecture privée, confirmation serveur, idempotence ━━━");

  // 8. Création de paiement via la fonction serveur (propriétaire)
  const payment = await asUser("authenticated", userA, (tx) =>
    tx`select * from public.create_payment(${listingA}::uuid, 'TEST', 'test')`);
  report("RLS-08 create_payment par le propriétaire (fonction serveur)", !!payment[0]?.id);

  // 9. Lecture : A voit son paiement
  const ownPayments = await asUser("authenticated", userA, (tx) =>
    tx`select count(*)::int as c from public.payments where user_id = ${userA}::uuid`);
  report("RLS-09 Propriétaire voit ses paiements", ownPayments[0].c === 1);

  // 10. B ne voit pas les paiements de A
  const bSeesPayments = await asUser("authenticated", userB, (tx) =>
    tx`select count(*)::int as c from public.payments where user_id = ${userA}::uuid`);
  report("RLS-10 Tiers ne voit pas les paiements d'autrui", bSeesPayments[0].c === 0);

  // 11. A ne peut pas insérer/modifier un paiement directement
  denied = false;
  await asUser("authenticated", userA, (tx) =>
    tx`insert into public.payments (user_id, listing_id, amount, payment_provider)
       values (${userA}::uuid, ${listingA}::uuid, 500, 'TEST')`.catch(() => { denied = true; })
  );
  report("RLS-11 Insertion directe de paiement par le client refusée", denied);

  denied = false;
  const hackPayment = await asUser("authenticated", userA, (tx) =>
    tx`update public.payments set status = 'SUCCESSFUL' where id = ${payment[0].id}::uuid returning id`
      .catch(() => { denied = true; })
  );
  report("RLS-12 Le client ne peut JAMAIS confirmer un paiement", denied || hackPayment.length === 0);

  // 12. verify_payment interdite à authenticated (réservée service_role)
  denied = false;
  await asUser("authenticated", userA, (tx) =>
    tx`select public.verify_payment(${payment[0].transaction_reference}, 'TXN-FAKE-1', true, 500, 'XOF')`
      .catch(() => { denied = true; })
  );
  report("RLS-13 verify_payment interdite au rôle authenticated", denied);

  // 13. Confirmation par le backend (service_role) → annonce publiée
  let result = await asUser("service_role", null, (tx) =>
    tx`select public.verify_payment(${payment[0].transaction_reference}, 'TXN-OM-001', true, 500, 'XOF') as r`);
  report("RLS-14 service_role confirme le paiement (montant/devise vérifiés)", result[0].r === "CONFIRMED", `→ ${result[0].r}`);

  const listingStatus = (await sql`select status from public.listings where id = ${listingA}::uuid`)[0].status;
  report("RLS-15 Annonce activée après confirmation serveur", listingStatus === "PUBLISHED");

  // 14. Mauvais montant → paiement rejeté
  const listingB = await UUID();
  await asUser("authenticated", userB, (tx) =>
    tx`insert into public.listings (id, user_id, category_id, title, slug, description, city, desired_item, status)
       values (${listingB}::uuid, ${userB}::uuid, ${cat}::uuid, 'Manette PS4', 'manette-ps4-test',
       'Manette DualShock blanche testée.', 'Dakar', 'jeu PS4', 'PENDING_PAYMENT')`);
  const payment3 = await asUser("authenticated", userB, (tx) =>
    tx`select * from public.create_payment(${listingB}::uuid, 'TEST', 'test')`);
  result = await asUser("service_role", null, (tx) =>
    tx`select public.verify_payment(${payment3[0].transaction_reference}, 'TXN-OM-002', true, 400, 'XOF') as r`);
  report("RLS-16 Montant insuffisant/mismatch → refus", result[0].r === "AMOUNT_MISMATCH", `→ ${result[0].r}`);
  const statusB = (await sql`select status from public.listings where id = ${listingB}::uuid`)[0].status;
  report("RLS-17 Annonce NON activée après montant invalide", statusB === "PENDING_PAYMENT");

  // 15. Idempotence : re-confirmer le même paiement ne réactive rien et renvoie ALREADY_CONFIRMED
  result = await asUser("service_role", null, (tx) =>
    tx`select public.verify_payment(${payment[0].transaction_reference}, 'TXN-OM-001', true, 500, 'XOF') as r`);
  report("RLS-18 Idempotence : re-confirmation → ALREADY_CONFIRMED", result[0].r === "ALREADY_CONFIRMED", `→ ${result[0].r}`);
  const successCount = (await sql`select count(*)::int as c from public.payments where listing_id = ${listingA}::uuid and status = 'SUCCESSFUL'`)[0].c;
  report("RLS-19 Un seul paiement SUCCESSFUL pour l'annonce (index partiel)", successCount === 1);

  console.log("\n━━━ MESSAGERIE : participants uniquement, usurpation impossible ━━━");

  // 16. B ouvre une conversation avec A au sujet de l'annonce de A
  const conv = await asUser("authenticated", userB, (tx) =>
    tx`select public.create_conversation(${listingA}::uuid, ${userA}::uuid) as id`);
  const convId = conv[0].id;
  report("RLS-20 create_conversation (dédupe)", !!convId);

  // 17. B envoie un message (sender forcé)
  await asUser("authenticated", userB, (tx) =>
    tx`select public.send_message(${convId}::uuid, 'Salam, le vélo est toujours disponible ?')`);
  report("RLS-21 send_message par un participant", true);

  // 18. Usurpation d'expéditeur refusée (B prétend être A)
  denied = false;
  await asUser("authenticated", userB, (tx) =>
    tx`insert into public.messages (conversation_id, sender_id, content)
       values (${convId}::uuid, ${userA}::uuid, 'je fais semblant d''être A')`.catch(() => { denied = true; })
  );
  report("RLS-22 Usurpation d'expéditeur refusée", denied);

  // 19. A (participant) lit les messages ; D (non-participant suspendu) ne lit rien
  const aSees = await asUser("authenticated", userA, (tx) =>
    tx`select count(*)::int as c from public.messages where conversation_id = ${convId}::uuid`);
  report("RLS-23 Participant lit les messages", aSees[0].c === 1);

  const dSees = await asUser("authenticated", userD, (tx) =>
    tx`select count(*)::int as c from public.messages where conversation_id = ${convId}::uuid`);
  report("RLS-24 Non-participant ne lit rien", dSees[0].c === 0);

  console.log("\n━━━ FAVORIS, NOTIFICATIONS, PROPOSITIONS ━━━");

  // 20. Favoris : les siens uniquement
  await asUser("authenticated", userB, (tx) => tx`select public.add_favorite(${listingA}::uuid)`);
  await asUser("authenticated", userB, (tx) => tx`select public.add_favorite(${listingA}::uuid)`); // idempotent
  const bFavs = await asUser("authenticated", userB, (tx) =>
    tx`select count(*)::int as c from public.favorites where user_id = ${userB}::uuid`);
  report("RLS-25 add_favorite idempotent (unique user+listing)", bFavs[0].c === 1);

  const aSeesBFavs = await asUser("authenticated", userA, (tx) =>
    tx`select count(*)::int as c from public.favorites where user_id = ${userB}::uuid`);
  report("RLS-26 Favoris privés (A ne voit pas ceux de B)", aSeesBFavs[0].c === 0);

  // 21. Proposition d'échange : B propose sur l'annonce publiée de A
  const proposal = await asUser("authenticated", userB, (tx) =>
    tx`select * from public.create_exchange_proposal(${listingA}::uuid, ${listingB}::uuid, 'Ma manette PS4', 'Échange contre ton vélo ?')`);
  report("RLS-27 create_exchange_proposal", !!proposal[0]?.id);

  // 28. tiers (suspendu) ne voit pas la proposition — et tentative de piratage sans effet
  const dSeesProposal = await asUser("authenticated", userD, (tx) =>
    tx`select count(*)::int as c from public.exchange_proposals where id = ${proposal[0].id}::uuid`);
  report("RLS-28 Proposition invisible pour un tiers", dSeesProposal[0].c === 0);
  const hack = await asUser("authenticated", userD, (tx) =>
    tx`update public.exchange_proposals set status = 'ACCEPTED' where id = ${proposal[0].id}::uuid returning id`);
  report("RLS-28b Un tiers ne peut pas accepter une proposition", hack.length === 0);

  // 23. Le proposant (B) ne peut pas ACCEPTER sa propre proposition
  denied = false;
  await asUser("authenticated", userB, (tx) =>
    tx`update public.exchange_proposals set status = 'ACCEPTED' where id = ${proposal[0].id}::uuid`.catch(() => { denied = true; })
  );
  report("RLS-24b Le proposant ne peut pas s'auto-accepter", denied);

  // 24. Seul le destinataire (A, propriétaire) accepte
  await asUser("authenticated", userA, (tx) =>
    tx`select public.respond_to_exchange(${proposal[0].id}::uuid, 'ACCEPTED')`);
  const propStatus = (await sql`select status from public.exchange_proposals where id = ${proposal[0].id}::uuid`)[0].status;
  report("RLS-29 Seul le destinataire accepte la proposition", propStatus === "ACCEPTED");

  // 25. Notifications : les siennes uniquement
  const bNotifs = await asUser("authenticated", userB, (tx) =>
    tx`select count(*)::int as c from public.notifications where user_id = ${userB}::uuid`);
  report("RLS-30 B reçoit ses notifications", bNotifs[0].c >= 1, `total=${bNotifs[0].c}`);
  const aSeesBNotifs = await asUser("authenticated", userA, (tx) =>
    tx`select count(*)::int as c from public.notifications where user_id = ${userB}::uuid`);
  report("RLS-31 Notifications privées", aSeesBNotifs[0].c === 0);

  console.log("\n━━━ PROFILS : rôle et statut intouchables par le client ━━━");

  // 26. A modifie son profil (colonnes autorisées)
  await asUser("authenticated", userA, (tx) =>
    tx`update public.profiles set full_name = 'Awa Diop', city = 'Thiès' where id = ${userA}::uuid`);
  report("RLS-32 Modification de ses propres infos OK", true);

  // 27. A tente de se promouvoir admin → refus (colonne non accordable)
  denied = false;
  await asUser("authenticated", userA, (tx) =>
    tx`update public.profiles set role = 'SUPER_ADMIN' where id = ${userA}::uuid`.catch(() => { denied = true; })
  );
  report("RLS-33 Auto-promotion en admin IMPOSSIBLE", denied);

  denied = false;
  await asUser("authenticated", userA, (tx) =>
    tx`update public.profiles set account_status = 'ACTIVE' where id = ${userD}::uuid`.catch(() => { denied = true; })
  );
  report("RLS-34 Modification du compte d'un tiers refusée", denied);

  // 28. Vue publique : pas de téléphone / e-mail exposé
  const publicCols = (await sql`select column_name from information_schema.columns where table_name = 'profiles_public'`)
    .map((r) => r.column_name);
  report(
    "RLS-35 Vue publique sans email ni téléphone",
    !publicCols.includes("email") && !publicCols.includes("phone") && publicCols.includes("username")
  );

  // 29. Compte suspendu : pas de création d'annonce ni de message
  const suspendedListing = await UUID();
  denied = false;
  await asUser("authenticated", userD, (tx) =>
    tx`insert into public.listings (id, user_id, category_id, title, slug, description, city, desired_item, status)
       values (${suspendedListing}::uuid, ${userD}::uuid, ${cat}::uuid, 'Test', 'test-suspendu',
       'Description assez longue pour passer.', 'Dakar', 'rien', 'DRAFT')`.catch(() => { denied = true; })
  );
  report("RLS-36 Compte suspendu ne peut pas publier", denied);

  console.log("\n━━━ ADMINISTRATION : permissions et journalisation ━━━");

  // 30. A (utilisateur) ne peut pas modérer
  denied = false;
  await asUser("authenticated", userA, (tx) =>
    tx`select public.moderate_listing(${listingB}::uuid, 'REJECT', 'test')`.catch(() => { denied = true; })
  );
  report("RLS-37 Modération refusée à un utilisateur standard", denied);

  // 31. L'admin (C) modère + journal
  await asUser("authenticated", userC, (tx) =>
    tx`select public.moderate_listing(${listingB}::uuid, 'PUBLISH')`);
  const statusB2 = (await sql`select status from public.listings where id = ${listingB}::uuid`)[0].status;
  report("RLS-38 Admin peut publier une annonce", statusB2 === "PUBLISHED");

  // 32. admin_logs : l'utilisateur standard n'y accède pas
  const aLogs = await asUser("authenticated", userA, (tx) =>
    tx`select count(*)::int as c from public.admin_logs`);
  report("RLS-39 admin_logs invisible pour un utilisateur standard", aLogs[0].c === 0);
  const cLogs = await asUser("authenticated", userC, (tx) =>
    tx`select count(*)::int as c from public.admin_logs`);
  report("RLS-40 admin_logs visible par l'admin", cLogs[0].c >= 1, `total=${cLogs[0].c}`);

  denied = false;
  await asUser("authenticated", userA, (tx) =>
    tx`insert into public.admin_logs (admin_id, action) values (${userA}::uuid, 'pirate')`.catch(() => { denied = true; })
  );
  report("RLS-41 Écriture client sur admin_logs refusée", denied);

  // 33. Statistiques admin
  const stats = await asUser("authenticated", userC, (tx) => tx`select * from public.admin_stats()`);
  report(
    "RLS-42 admin_stats (users/listings/revenue)",
    String(stats[0].users_total) === "4" && String(stats[0].revenue_total) === "500",
    JSON.stringify(stats[0])
  );
  denied = false;
  await asUser("authenticated", userA, (tx) =>
    tx`select * from public.admin_stats()`.catch(() => { denied = true; })
  );
  report("RLS-43 admin_stats réservée aux admins", denied);

  // 34. setup_first_super_admin : refusé si un super admin existe déjà
  const setupAgain = await sql`select public.setup_first_super_admin('nouveau@test.sn') as r`;
  report("RLS-44 Second super admin refusé", setupAgain[0].r === "SUPER_ADMIN_DEJA_EXISTANT", `→ ${setupAgain[0].r}`);

  console.log("\n━━━ SIGNALEMENTS & PARAMÈTRES ━━━");

  // 35. A signale une annonce ; B ne peut pas lire le signalement de A
  await asUser("authenticated", userB, (tx) =>
    tx`select public.report_listing(${listingA}::uuid, 'ARNAQUE', 'objet douteux')`);
  const bReports = await asUser("authenticated", userB, (tx) =>
    tx`select count(*)::int as c from public.reports where reporter_id = ${userB}::uuid`);
  report("RLS-45 Signalement créé", bReports[0].c === 1);
  const aSeesBReports = await asUser("authenticated", userA, (tx) =>
    tx`select count(*)::int as c from public.reports where reporter_id = ${userB}::uuid`);
  report("RLS-46 Signalements privés entre utilisateurs", aSeesBReports[0].c === 0);

  // 37. site_settings lisibles par tous, modifiables par admin uniquement
  const settings = await asUser("anon", null, (tx) => tx`select count(*)::int as c from public.site_settings`);
  report("RLS-47 Paramètres lisibles publiquement", settings[0].c >= 8);
  denied = false;
  const hackRows = await asUser("authenticated", userA, (tx) =>
    tx`update public.site_settings set setting_value = '0' where setting_key = 'publication_fee' returning setting_key`
      .catch(() => { denied = true; })
  );
  const feeAfterHack = (await sql`select setting_value from public.site_settings where setting_key = 'publication_fee'`)[0];
  report("RLS-48 Paramètres modifiables par admin uniquement", (denied || hackRows.length === 0) && feeAfterHack?.setting_value === "500");

  // 37. Storage : buckets créés
  const buckets = await sql`select id from storage.buckets order by id`;
  report(
    "STORAGE-01 4 buckets configurés (formats/taille limités)",
    buckets.length === 4 && buckets.map((b) => b.id).join(",") === "exchange-images,listing-images,profile-avatars,support-attachments"
  );

  // 38. Realtime : publication configurée
  const pub = (await sql`select count(*)::int as c from pg_publication_tables where pubname = 'supabase_realtime'`)[0].c;
  report("REALTIME-01 4 tables dans la publication supabase_realtime", pub === 4, `tables=${pub}`);

  // 39. Seed : catégories + villes
  const cats = (await sql`select count(*)::int as c from public.categories`)[0].c;
  const cities = (await sql`select count(*)::int as c from public.cities`)[0].c;
  const fee = (await sql`select setting_value from public.site_settings where setting_key = 'publication_fee'`)[0];
  report("SEED-01 Catégories + sous-catégories insérées", cats >= 30, `total=${cats}`);
  report("SEED-02 Villes du Sénégal insérées (16)", cities === 16, `total=${cities}`);
  report("SEED-03 Tarif de publication = 500 FCFA", fee?.setting_value === "500");

  // ------------------------------------------------------------------
  console.log(`\n══════════ RÉSULTAT : ${pass} PASS / ${fail} FAIL ══════════`);
  if (fail > 0) {
    console.table(failures);
    process.exitCode = 1;
  }
  await sql.end();
}

main().catch((e) => {
  console.error("💥 Erreur fatale du runner :", e.message);
  console.error(e.stack?.split("\n").slice(0, 8).join("\n"));
  process.exit(1);
});
