/**
 * SAMATROC 🇸🇳 — Exécution du bootstrap SQL sur Supabase (Porte C)
 * -----------------------------------------------------------------
 * Usage :
 *   bun scripts/run-bootstrap-supabase.ts "<mot_de_passe_db>" [région]
 *
 * Régions testées automatiquement si non précisée :
 *   eu-west-3 (Paris), eu-west-1, eu-central-1, us-east-1, us-west-1,
 *   ap-southeast-1, ap-south-1, sa-east-1
 *
 * Connexion via le pooler IPv4 (session pooler, port 5432 → 6543 en transaction).
 * Exécute les 6 fichiers SQL DANS L'ORDRE puis vérifie les tables.
 */
import postgres from "postgres";
import { readFileSync } from "fs";
import path from "path";

const PASSWORD = process.argv[2];
const REGION_ARG = process.argv[3] ?? "";
const REF = "azscjkalcximegzwsupe";

if (!PASSWORD) {
  console.error("❌ Usage : bun scripts/run-bootstrap-supabase.ts <mot_de_passe_db> [région]");
  console.error("   Ex.   : bun scripts/run-bootstrap-supabase.ts 'MonMotDePasse123!' eu-west-3");
  process.exit(1);
}

const REGIONS = REGION_ARG
  ? [REGION_ARG]
  : ["eu-west-3", "eu-west-2", "eu-west-1", "eu-central-1", "us-east-1", "us-west-1", "ap-southeast-1", "ap-south-1", "sa-east-1"];

const FILES = [
  "supabase/migrations/20260101000001_init.sql",
  "supabase/migrations/20260101000002_functions.sql",
  "supabase/migrations/20260101000003_rls.sql",
  "supabase/migrations/20260101000004_storage.sql",
  "supabase/migrations/20260101000005_realtime.sql",
  "supabase/seed.sql",
];

interface PgLike {
  unsafe: (sql: string) => Promise<unknown[]>;
  end: () => Promise<void>;
}

async function tryConnect(region: string): Promise<PgLike | null> {
  const url = `postgresql://postgres.${REF}:${encodeURIComponent(PASSWORD!)}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
  const sql = postgres(url, {
    connect_timeout: 8,
    max: 1,
    prepare: false,
    ssl: { rejectUnauthorized: false },
    onnotice: () => {},
  });
  try {
    await sql`select 1`;
    console.log(`✅ Connexion réussie (région : ${region})`);
    return sql as unknown as PgLike;
  } catch {
    await sql.end().catch(() => {});
    return null;
  }
}

let client: PgLike | null = null;
let foundRegion = "";
for (const region of REGIONS) {
  console.log(`… tentative région ${region}…`);
  client = await tryConnect(region);
  if (client) {
    foundRegion = region;
    break;
  }
}
if (!client) {
  console.error("❌ Impossible de se connecter — vérifiez le mot de passe (ou indiquez la région en 2e argument).");
  process.exit(2);
}

// Vérifier si déjà exécuté
const existing = (await client.unsafe(
  `select table_name from information_schema.tables where table_schema='public' and table_name='categories'`
)) as { table_name: string }[];
if (existing.length > 0) {
  console.log("ℹ️  La table categories existe déjà — bootstrap probablement déjà exécuté. Arrêt sans modification.");
  await client.end();
  process.exit(0);
}

for (const file of FILES) {
  const full = path.resolve(process.cwd(), file);
  const content = readFileSync(full, "utf8");
  console.log(`▶ Exécution : ${file} (${(content.length / 1024).toFixed(0)} Ko)…`);
  try {
    await client.unsafe(content);
    console.log(`   ✅ OK`);
  } catch (err) {
    console.error(`   ❌ ERREUR :`, err instanceof Error ? err.message : err);
    console.error(`   → Arrêt à ${file}. Corrigez puis relancez (idempotence partielle : voir doc).`);
    await client.end();
    process.exit(3);
  }
}

// Vérification finale
const counts = (await client.unsafe(
  `select
     (select count(*) from public.categories) as categories,
     (select count(*) from public.cities) as cities,
     (select count(*) from public.profiles) as profiles`
)) as Record<string, number>[];
console.log("");
console.log("📊 Vérification finale :", JSON.stringify(counts[0]));
console.log(`🎉 BOOTSTRAP TERMINÉ avec succès (région ${foundRegion}) !`);
await client.end();
