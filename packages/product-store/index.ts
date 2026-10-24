import fs from "node:fs";
import path from "node:path";
import type { Product, SizePricing } from "@liksha/types";

/**
 * Shared file store — admin likhta hai, storefront padhta hai.
 *
 * Path: `DATA_DIR` (default `<repo>/.data`), file `products.json`; photos
 * `uploads/` me. Isliye dev me admin 3001 par chal raha ho aur storefront 3000
 * par, dono ek hi data dekhte hain.
 */

export function repoRoot(): string {
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    if (fs.existsSync(path.join(dir, "turbo.json")) || fs.existsSync(path.join(dir, ".git"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export function dataDir(): string {
  const dir = process.env.DATA_DIR ?? path.join(repoRoot(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function dataFile(name: string): string {
  return path.join(dataDir(), name);
}

/**
 * Admin se upload hue products ka store.
 *
 * Catalogue (287 purane products) build-time JSON me hai — woh static rehta hai.
 * Owner jo naya product admin panel se daalta hai woh yahan (`.data/products.json`)
 * aata hai, aur storefront use har request par merge karke dikhata hai.
 *
 * Google Sheet configured ho to har save par `Products` tab me bhi wahi row
 * jaati hai (owner ke liye readable DB copy) — sheet down ho to site phir bhi chalti hai.
 */

export type AdminProductRecord = {
  handle: string;
  title: string;
  /** paise */
  price: number;
  /** paise — MRP (strike-through) */
  compareAtPrice: number | null;
  images: string[];
  colours: string[];
  /**
   * Size rows. `price` optional hai — set ho to wahi us size ka price hai
   * (size-wise pricing), warna base `price` chalta hai. Paise me.
   */
  sizes: { size: string; stock: number; price?: number | null }[];
  description: string;
  fabric: string;
  collection: string;
  category: Product["category"];
  status: "published" | "draft";
  /** admin panel ke liye */
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

type Store = { version: 1; products: AdminProductRecord[] };

const FILE = "products.json";

function readStore(): Store {
  try {
    const raw = fs.readFileSync(dataFile(FILE), "utf8");
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || !Array.isArray(parsed.products)) return { version: 1, products: [] };
    return parsed;
  } catch {
    return { version: 1, products: [] };
  }
}

/** tmp + rename — beech me crash ho to file aadhi likhi na rahe. */
function writeStore(store: Store): void {
  const target = dataFile(FILE);
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, target);
}

export function slugifyTitle(title: string): string {
  return String(title)
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

export function listAdminProducts(options: { publishedOnly?: boolean } = {}): AdminProductRecord[] {
  const list = readStore().products;
  const filtered = options.publishedOnly ? list.filter((item) => item.status === "published") : list;
  return [...filtered].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function getAdminProduct(handle: string): AdminProductRecord | null {
  return readStore().products.find((item) => item.handle === handle) ?? null;
}

function sizePricingFor(record: AdminProductRecord): Record<string, SizePricing> {
  const pricing: Record<string, SizePricing> = {};
  for (const entry of record.sizes) {
    pricing[entry.size] = {
      // size-wise price (admin) — na ho to base price
      price: entry.price && entry.price > 0 ? entry.price : record.price,
      compareAtPrice: record.compareAtPrice,
      available: entry.stock > 0,
    };
  }
  return pricing;
}

/** Admin record → wahi Product shape jo storefront use karta hai. */
export function toCatalogProduct(record: AdminProductRecord): Product {
  const inStock = record.sizes.some((entry) => entry.stock > 0);
  return {
    handle: record.handle,
    sourceHandle: record.handle,
    title: record.title,
    price: record.price,
    compareAtPrice: record.compareAtPrice,
    images: record.images,
    collections: [record.collection].filter(Boolean),
    category: record.category,
    fabric: record.fabric || "Premium fabric",
    color: record.colours[0] ?? "As shown",
    colourName: record.colours[0] ?? null,
    sizes: record.sizes.map((entry) => entry.size),
    sizePricing: sizePricingFor(record),
    details: [],
    description: record.description || record.title,
    descriptionHtml: descriptionHtml(record.description),
    productType: "Trends Younique",
    rating: 0,
    reviewCount: 0,
    inStock,
    featured: false,
    publishedAt: record.createdAt,
  };
}

function descriptionHtml(description: string): string {
  if (!description) return "";
  return description
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export type SaveProductInput = {
  handle?: string;
  title: string;
  price: number;
  compareAtPrice?: number | null;
  images: string[];
  colours?: string[];
  sizes?: { size: string; stock: number; price?: number | null }[];
  description?: string;
  fabric?: string;
  collection?: string;
  category?: string;
  status?: "published" | "draft";
  actor?: string;
};

const DEFAULT_SIZES = ["S", "M", "L", "XL"];

export function normaliseSizes(
  input?: { size: string; stock: number; price?: number | null }[],
): { size: string; stock: number; price: number | null }[] {
  const list = (input ?? []).filter((entry) => entry && entry.size);
  const source: { size: string; stock: number; price?: number | null }[] = list.length
    ? list
    : DEFAULT_SIZES.map((size) => ({ size, stock: 0 }));
  const seen = new Set<string>();
  return source
    .map((entry) => ({
      size: String(entry.size).trim().toUpperCase(),
      stock: Math.max(0, Math.min(999, Math.round(Number(entry.stock) || 0))),
      // size ka apna price (₹ → paise pehle hi ho chuka hota hai); 0/negative = base price
      price:
        Number.isFinite(Number(entry.price)) && Number(entry.price) > 0
          ? Math.round(Number(entry.price))
          : null,
    }))
    .filter((entry) => {
      if (!entry.size || seen.has(entry.size)) return false;
      seen.add(entry.size);
      return true;
    });
}

export function saveProduct(input: SaveProductInput): { ok: true; product: AdminProductRecord } | { ok: false; error: string } {
  const title = String(input.title ?? "").trim();
  if (title.length < 3) return { ok: false, error: "Product ka naam kam se kam 3 character ka hona chahiye." };
  if (!Number.isFinite(input.price) || input.price <= 0) return { ok: false, error: "Price daaliye (₹)." };
  const images = (input.images ?? []).map((image) => String(image).trim()).filter(Boolean).slice(0, 12);
  if (!images.length) return { ok: false, error: "Kam se kam ek photo upload kariye." };

  const store = readStore();
  const requested = input.handle?.trim() || slugifyTitle(title);
  const handle = requested || `product-${Date.now().toString(36)}`;
  const existing = store.products.find((item) => item.handle === handle);
  if (!input.handle && existing) {
    return { ok: false, error: `"${handle}" naam ka product pehle se hai — title thoda badliye.` };
  }

  const now = new Date().toISOString();
  const record: AdminProductRecord = {
    handle,
    title,
    price: Math.round(input.price),
    compareAtPrice:
      input.compareAtPrice && input.compareAtPrice > input.price ? Math.round(input.compareAtPrice) : null,
    images,
    colours: (input.colours ?? []).map((colour) => String(colour).trim()).filter(Boolean),
    sizes: normaliseSizes(input.sizes),
    description: String(input.description ?? "").trim(),
    fabric: String(input.fabric ?? "").trim(),
    collection: String(input.collection ?? "new-arrivals").trim() || "new-arrivals",
    category: (input.category ?? "anarkali") as Product["category"],
    status: input.status === "draft" ? "draft" : "published",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    createdBy: input.actor ?? existing?.createdBy,
  };

  const index = store.products.findIndex((item) => item.handle === handle);
  if (index >= 0) store.products[index] = record;
  else store.products.push(record);
  writeStore(store);
  return { ok: true, product: record };
}

export function deleteProduct(handle: string): boolean {
  const store = readStore();
  const next = store.products.filter((item) => item.handle !== handle);
  if (next.length === store.products.length) return false;
  writeStore({ ...store, products: next });
  return true;
}

export function toggleProductStatus(handle: string): AdminProductRecord | null {
  const store = readStore();
  const record = store.products.find((item) => item.handle === handle);
  if (!record) return null;
  record.status = record.status === "published" ? "draft" : "published";
  record.updatedAt = new Date().toISOString();
  writeStore(store);
  return record;
}

/** Uploaded images ka folder — admin yahan likhta hai, web `/api/uploads/...` se padhti hai. */
export function uploadDir(): string {
  const dir = path.join(dataDir(), "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Admin product ki row — Google Sheet `Products` tab ke columns ke saamne. */
export function productSheetRow(record: AdminProductRecord): Record<string, string | number | null> {
  return {
    Handle: record.handle,
    "Product name": record.title,
    "Price ₹": Math.round(record.price) / 100,
    "MRP ₹": record.compareAtPrice ? Math.round(record.compareAtPrice) / 100 : "",
    "Discount %":
      record.compareAtPrice && record.compareAtPrice > record.price
        ? Math.round(((record.compareAtPrice - record.price) / record.compareAtPrice) * 100)
        : 0,
    // `S (5)` normal, `XL (2 @3799)` = us size ka apna price
    Sizes: record.sizes
      .map((entry) =>
        entry.price && entry.price > 0
          ? `${entry.size} (${entry.stock} @${Math.round(entry.price) / 100})`
          : `${entry.size} (${entry.stock})`,
      )
      .join(", "),
    Colours: record.colours.join(", "),
    Images: record.images.join(", "),
    Collection: record.collection,
    Category: record.category,
    Fabric: record.fabric,
    Description: record.description,
    Stock: record.sizes.reduce((sum, entry) => sum + entry.stock, 0),
    Status: record.status === "published" ? "Live" : "Draft",
    Updated: record.updatedAt,
  };
}
