"use client";

/**
 * Client API SamaTroc (navigateur)
 * Wrapper fetch avec gestion des erreurs normalisée.
 * Toutes les requêtes utilisent des chemins relatifs.
 */

export class ApiClientError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isForm = false
): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: "same-origin",
    headers: {} as Record<string, string>,
  };

  if (body !== undefined) {
    if (isForm) {
      init.body = body as FormData;
    } else {
      (init.headers as Record<string, string>)["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
  }

  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiClientError(0, "Impossible de contacter le serveur. Vérifiez votre connexion.");
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // réponse sans corps
  }

  if (!res.ok) {
    const err = (data ?? {}) as { error?: string; fields?: Record<string, string> };
    throw new ApiClientError(
      res.status,
      err.error || `Erreur ${res.status}`,
      err.fields
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, form, true),
};

/**
 * Compresse une image côté client avant téléversement (max 1400px, JPEG qualité 0.82).
 * Retourne un File prêt pour FormData.
 */
export async function compressImage(file: File, maxSize = 1400, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
