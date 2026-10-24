import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { uploadDir } from "@liksha/product-store";

/**
 * Admin se product photos ka upload.
 *
 * Files repo ke bahar (`DATA_DIR/uploads`, default `.data/uploads`) me jaati hain,
 * kyunki build ke andar likhna deploy par udd jaata hai. URL `/api/uploads/<file>`
 * hota hai — wahi route admin aur storefront dono me hai, isliye preview me bhi
 * image dikhti hai.
 *
 * Rules: JPG / PNG / WEBP / AVIF, max 8 MB per file, ek product par max 12 photos.
 */

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 12;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

function looksLikeImage(buffer: Buffer, ext: string): boolean {
  if (ext === ".jpg") return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (ext === ".png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === ".webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (ext === ".avif") return buffer.subarray(4, 12).toString("ascii").includes("ftyp");
  return false;
}

/** Ek File ko disk par likho aur public URL do. */
export async function saveUploadedImage(file: File): Promise<UploadResult> {
  if (!file || typeof file === "string") return { ok: false, error: "File nahi mili." };
  const type = (file.type || "").toLowerCase();
  const ext = EXT_BY_TYPE[type] ?? path.extname(file.name).toLowerCase();
  if (!EXT_BY_TYPE[type] && !Object.values(EXT_BY_TYPE).includes(ext)) {
    return { ok: false, error: "Sirf JPG, PNG, WEBP ya AVIF photo chalegi." };
  }
  if (file.size <= 0) return { ok: false, error: "Photo khaali hai — dobara choose kariye." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Photo 8 MB se chhoti honi chahiye." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeExt = Object.values(EXT_BY_TYPE).includes(ext) ? ext : ".jpg";
  if (!looksLikeImage(buffer, safeExt)) {
    return { ok: false, error: "File photo jaisi nahi lag rahi — asli JPG/PNG daaliye." };
  }

  const name = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}${safeExt}`;
  fs.writeFileSync(path.join(uploadDir(), name), buffer);
  return { ok: true, url: `/api/uploads/${name}` };
}

/** FormData se saari photos (multiple files). */
export async function saveUploadedImages(files: File[]): Promise<{ urls: string[]; errors: string[] }> {
  const urls: string[] = [];
  const errors: string[] = [];
  for (const file of files.slice(0, MAX_IMAGES_PER_PRODUCT)) {
    if (!file || file.size === 0) continue;
    const result = await saveUploadedImage(file);
    if (result.ok) urls.push(result.url);
    else errors.push(result.error);
  }
  return { urls, errors };
}
