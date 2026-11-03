import { NextRequest } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getSessionUser } from "@/lib/auth";
import { handleRoute, ApiError, jsonOk } from "@/lib/api-utils";
import { rateLimit } from "@/lib/rate-limit";
import { randomBytes } from "crypto";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo
const MAX_FILES = 6;

/** Magic bytes de validation (protection contre fichiers déguisés) */
function checkMagicBytes(buf: Buffer): boolean {
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

/**
 * Téléversement sécurisé de photos :
 * - authentification requise
 * - types et tailles limités, magic bytes vérifiés
 * - nom de fichier aléatoire (pas de path traversal)
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

    const urls: string[] = [];
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
      if (!checkMagicBytes(buf)) {
        throw new ApiError(400, "Fichier image invalide ou corrompu.");
      }

      const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
      const name = `${randomBytes(12).toString("hex")}.${ext}`;
      await writeFile(path.join(uploadDir, name), buf);
      urls.push(`/uploads/${subDir}/${name}`);
    }

    return jsonOk({ urls }, 201);
  });
}
