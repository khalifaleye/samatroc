import { PrismaClient } from '@prisma/client'

/**
 * Garde-fou d'environnement
 * ----------------------------------------------------------------------------
 * L'environnement d'exécution du bac à sable (et certains shells) exporte une
 * variable DATABASE_URL pointant vers la base SQLite locale de démonstration
 * (`file:...`). Les variables d'environnement réelles ont priorité sur le
 * fichier .env pour Prisma → sans ce garde-fou, le client (schéma PostgreSQL
 * Supabase) essaierait de se connecter à SQLite.
 *
 * Tant que le schéma est en PostgreSQL et que la variable effective est une
 * URL `file:` (ou absente), on recharge la valeur depuis le .env du projet.
 */
if (!process.env.DATABASE_URL?.startsWith('postgres')) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require('node:fs') as typeof import('node:fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('node:path') as typeof import('node:path')
    const raw = readFileSync(join(process.cwd(), '.env'), 'utf8')
    const match = raw.match(/^DATABASE_URL="?([^"\r\n]+)"?\s*$/m)
    if (match) process.env.DATABASE_URL = match[1]
  } catch {
    // .env absent : Prisma produira sa propre erreur explicite au besoin
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
