/**
 * Limitation de débit en mémoire (anti-spam / anti-force brute)
 * Adaptée au déploiement mono-instance ; utiliser Redis en production multi-instances.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Nettoyage périodique des buckets expirés
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

/**
 * Vérifie une limite de débit.
 * @returns true si l'action est autorisée, false si la limite est atteinte
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  cleanup();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

/** Secondes restantes avant réinitialisation (pour le message d'erreur) */
export function retryAfter(key: string): number {
  const bucket = buckets.get(key);
  if (!bucket) return 0;
  return Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000));
}
