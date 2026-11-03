import { NextRequest } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";
import { rateLimit } from "@/lib/rate-limit";
import { randomBytes } from "crypto";
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_TYPES_SUPPORT = [...ALLOWED_TYPES, "application/pdf"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo
const MAX_SIZE_AVATAR = 2 * 1024 * 1024; // 2 Mo (bucket avatars)
const MAX_FILES = 6;

/** Buckets Supabase autorisés (cf. migration 0004_storage.sql) */
const BUCKETS = {
  "listing-images": { public: true, maxSize: MAX_SIZE, types: ALLOWED_TYPES },
  "profile-avatars": { public: true, maxSize: MAX_SIZE_AVATAR, types: ALLOWED_TYPES },
  "exchange-images": { public: false, maxSize: MAX_SIZE, types: ALLOWED_TYPES },
  "support-attachments": { public: false, maxSize: MAX_SIZE, types: ALLOWED_TYPES_SUPPORT },
} as const;

type BucketId = keyof typeof BUCKETS;

/** Magic bytes de validation (protection contre fichiers déguisés) */
function checkMagicBytes(buf: Buffer, mimeType: string): boolean {
  if (mimeType === "application/pdf") {
    return buf.length > 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  // JPEG : FF D8 FF
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG : 89 50 4E 47
  if (
    buf.length > 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  )
    return true;
  // WEBP : RIFF....WEBP
  if (
    buf.length > 12 &&
    buf.slice(0, 4).toString("ascii") === "RIFF" &&
    buf.slice(8, 12).toString("ascii") === "WEBP"
  )
    return true;
  return false;
}

function fileExtension(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "application/pdf") return "pdf";
  return "webp";
}

/**
 * Téléversement sécurisé de photos :
 * - authentification requise, limitation de débit
 * - types, tailles et magic bytes vérifiés (aucun exécutable possible)
 * - nom de fichier aléatoire (pas de path traversal)
 *
 * DOUBLE MODE :
 * - Supabase configuré  → Supabase Storage (bucket {userId}/{uuid}.{ext})
 * - Sinon (mode démo)   → disque local /public/uploads (comportement historique)
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Connexion requise");
    if (!rateLimit(`upload:${session.id}`, 30, 60 * 1000)) {
      throw new ApiError(429, "Trop de téléversements. Patientez un instant.");
    }

    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);

    if (files.length === 0) throw new ApiError(400, "Aucun fichier reçu");
    if (files.length > MAX_FILES) throw new ApiError(400, `Maximum ${MAX_FILES} fichiers à la fois`);

    // Bucket demandé (listing-images par défaut)
    const requestedBucket = (form.get("bucket") as string | null) ?? "listing-images";
    if (!(requestedBucket in BUCKETS)) {
      throw new ApiError(400, "Bucket de destination inconnu.");
    }
    const bucket = BUCKETS[requestedBucket as BucketId];

    const urls: string[] = [];

    // ------------------------------------------------------------------
    // MODE SUPABASE STORAGE
    // ------------------------------------------------------------------
    if (isSupabaseAdminConfigured()) {
      const supabase = getSupabaseAdminClient()!;
      for (const file of files) {
        if (!bucket.types.includes(file.type as never)) {
          throw new ApiError(
            400,
            `Format non autorisé pour ${requestedBucket}. Formats acceptés : ${bucket.types.join(", ")}.`
          );
        }
        if (file.size > bucket.maxSize) {
          throw new ApiError(400, `Chaque fichier ne peut dépasser ${Math.round(bucket.maxSize / 1024 / 1024)} Mo.`);
        }
        const buf = Buffer.from(await file.arrayBuffer());
        if (!checkMagicBytes(buf, file.type)) {
          throw new ApiError(400, "Fichier image invalide ou corrompu.");
        }

        // Convention imposée par les politiques Storage : {user_id}/{uuid}.{ext}
        const name = `${session.id}/${randomBytes(12).toString("hex")}.${fileExtension(file.type)}`;

        const { error } = await supabase.storage
          .from(requestedBucket)
          .upload(name, buf, {
            contentType: file.type,
            cacheControl: "31536000",
            upsert: false,
          });
        if (error) throw new ApiError(500, `Téléversement impossible : ${error.message}`);

        if (bucket.public) {
          const { data } = supabase.storage.from(requestedBucket).getPublicUrl(name);
          urls.push(data.publicUrl);
        } else {
          // Buckets privés : URL signée d'une heure (le backend reste l'autorité)
          const { data, error: signError } = await supabase.storage
            .from(requestedBucket)
            .createSignedUrl(name, 3600);
          if (signError || !data) throw new ApiError(500, "Génération de l'URL signée impossible.");
          urls.push(data.signedUrl);
        }
      }
      return jsonOk({ urls, storage: "supabase" }, 201);
    }

    // ------------------------------------------------------------------
    // MODE DÉMO — disque local (comportement historique inchangé)
    // ------------------------------------------------------------------
    if (requestedBucket !== "listing-images") {
      throw new ApiError(400, "Ce bucket nécessite la configuration Supabase Storage.");
    }
    const now = new Date();
    const subDir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", subDir);
    await mkdir(uploadDir, { recursive: true });

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new ApiError(400, "Format non autorisé. Formats acceptés : JPEG, PNG, WebP.");
      }
      if (file.size > MAX_SIZE) {
        throw new ApiError(400, "Chaque photo ne peut dépasser 5 Mo.");
      }
      const buf = Buffer.from(await file.arrayBuffer());
      if (!checkMagicBytes(buf, file.type)) {
        throw new ApiError(400, "Fichier image invalide ou corrompu.");
      }

      const name = `${randomBytes(12).toString("hex")}.${fileExtension(file.type)}`;
      await writeFile(path.join(uploadDir, name), buf);
      urls.push(`/uploads/${subDir}/${name}`);
    }

    return jsonOk({ urls, storage: "local" }, 201);
  });
}
