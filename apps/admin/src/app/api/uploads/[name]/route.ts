import fs from "node:fs";
import path from "node:path";
import { uploadDir } from "@liksha/product-store";

/**
 * Admin ke andar uploaded product photos (preview ke liye).
 * Storefront par wahi file `/api/uploads/<name>` se aati hai.
 */

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const clean = path.basename(decoded);
  const ext = path.extname(clean).toLowerCase();
  if (clean !== decoded || !TYPES[ext]) return new Response("Not found", { status: 404 });

  const file = path.join(uploadDir(), clean);
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });

  const data = fs.readFileSync(file);
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": TYPES[ext]!,
      "cache-control": "public, max-age=31536000, immutable",
      "content-length": String(data.byteLength),
    },
  });
}
