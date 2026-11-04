/**
 * Seed SamaTroc — MODE PRODUCTION SUPABASE
 * ----------------------------------------------------------------------------
 * Les données de référence (36 catégories, 16 villes, site_settings, contenus)
 * sont créées par les migrations SQL Supabase (supabase/migrations + seed.sql),
 * qui sont la source de vérité.
 *
 * Ce seed ne crée AUCUNE donnée de démonstration (comptes fictifs, annonces
 * bidon) : cf. docs/supabase/07-migration-prisma-supabase.md — ne jamais
 * mélanger démo et production. Il se contente de :
 *   1. vérifier que les données de référence sont bien présentes ;
 *   2. garantir que le drapeau demo_data est à « false » ;
 *   3. afficher un rapport lisible.
 *
 * Exécution : bun prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Garde-fou : l'environnement du bac à sable exporte DATABASE_URL=file:... 
 * (SQLite démo) qui prend la priorité sur le .env. On recharge la valeur du
 * projet si la variable effective ne correspond pas au schéma PostgreSQL.
 */
if (!process.env.DATABASE_URL?.startsWith("postgres")) {
  try {
    const raw = readFileSync(join(__dirname, "..", ".env"), "utf8");
    const match = raw.match(/^DATABASE_URL="?([^"\r\n]+)"?\s*$/m);
    if (match) process.env.DATABASE_URL = match[1];
  } catch {
    // .env absent : Prisma produira sa propre erreur explicite
  }
}

const db = new PrismaClient();

async function main() {
  const [categories, cities, settings] = await Promise.all([
    db.category.count(),
    db.city.count(),
    db.siteSetting.count(),
  ]);

  // Garde-fou : les données de référence doivent venir des migrations SQL.
  if (categories === 0 || cities === 0) {
    throw new Error(
      "Données de référence absentes : exécutez d'abord les migrations SQL " +
        "Supabase (supabase/migrations + seed.sql) avant ce seed."
    );
  }

  // Le drapeau de démonstration est explicitement désactivé.
  await db.siteSetting.upsert({
    where: { settingKey: "demo_data" },
    update: { settingValue: "false" },
    create: { settingKey: "demo_data", settingValue: "false" },
  });

  const fee = await db.siteSetting.findUnique({
    where: { settingKey: "publication_fee" },
  });

  console.log("✅ Seed production vérifié :");
  console.log(`   • Catégories : ${categories}`);
  console.log(`   • Villes     : ${cities}`);
  console.log(`   • Réglages   : ${settings}`);
  console.log(`   • Frais de publication : ${fee?.settingValue ?? "500"} FCFA`);
  console.log(`   • demo_data : false`);
  console.log("   Aucune donnée de démonstration créée (mode Supabase).");
}

main()
  .catch((e) => {
    console.error("❌ Seed échoué :", e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
