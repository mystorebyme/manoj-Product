import fs from "node:fs";
import path from "node:path";
import { uploadDir } from "@/lib/product-db";

export const dynamic = "force-dynamic";

/**
 * Admin panel se upload kiye gaye product photos.
 *
 * Files `.data/uploads/` me rehti hain (disk), browser ko yahin se milti hain.
 * Path traversal block hai — sirf flat filename allowed, `..` / `/` reject.
 */

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const clean = path.basename(decodeURIComponent(name));
  const ext = path.extname(clean).toLowerCase();
  if (clean !== decodeURIComponent(name) || !TYPES[ext]) {
    return new Response("Not found", { status: 404 });
  }

  const file = path.join(uploadDir(), clean);
  if (!file.startsWith(uploadDir()) || !fs.existsSync(file)) {
    return new Response("Not found", { status: 404 });
  }

  const data = fs.readFileSync(file);
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": TYPES[ext]!,
      "cache-control": "public, max-age=31536000, immutable",
      "content-length": String(data.byteLength),
    },
  });
}
