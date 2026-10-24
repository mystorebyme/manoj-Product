import "server-only";

import fs from "node:fs";
import { dataFile } from "./data-dir";
import { dbEnabled } from "./db";
import { readSheetSettings, writeSheetSettings } from "./google-sheets";

/**
 * Store settings — source of truth storefront hai.
 * Admin panel API se save karta hai, website runtime par padhti hai.
 */
export type StoreSettings = {
  announcement: string;
  freeShipping: boolean;
  /** payment yahan aata hai — owner Google Sheet se badal sakta hai */
  upiId: string;
  upiName: string;
  gstin: string;
  supportPhone: string;
  supportEmail: string;
  whatsapp: string;
  /** Admin panel ka link (sirf admin/owner ke liye — public API me nahi jaata) */
  adminUrl: string;
  /** brand naam + home hero ka sub-line (sheet se badal sakte hain) */
  brandName: string;
  tagline: string;
  /** quantity limits — sheet ke Settings tab se (khaali = code default) */
  maxQtyPerItem: number;
  maxQtyBulk: number;
  maxQtyPerOrder: number;
  updatedAt: string;
  updatedBy: string;
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  announcement: "Diwali Sale — Up to 70% OFF · Final price ₹499 onwards",
  freeShipping: true,
  upiId: process.env.STORE_UPI_ID ?? "dhakadgourav@fam",
  upiName: process.env.STORE_UPI_NAME ?? "TRENDS YOUNIQUE",
  gstin: process.env.SELLER_GSTIN ?? "",
  supportPhone: "8005900581",
  supportEmail: "care@trendsyounique.com",
  whatsapp: "8005900581",
  adminUrl: process.env.ADMIN_PANEL_URL ?? "",
  brandName: "TRENDS YOUNIQUE",
  tagline: "Couture for the woman who arrives",
  maxQtyPerItem: 10,
  maxQtyBulk: 30,
  maxQtyPerOrder: 15,
  updatedAt: new Date(0).toISOString(),
  updatedBy: "system",
};

let cache: { at: number; value: StoreSettings } | null = null;

export function normalizeStoreSettings(input: unknown): StoreSettings {
  const base = DEFAULT_STORE_SETTINGS;
  if (!input || typeof input !== "object") return base;
  const raw = input as Partial<StoreSettings>;
  const text = (value: unknown, fallback: string, max = 240) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
  return {
    announcement: typeof raw.announcement === "string" ? raw.announcement.trim().slice(0, 180) : base.announcement,
    freeShipping: raw.freeShipping !== false,
    upiId: text(raw.upiId, base.upiId, 80),
    upiName: text(raw.upiName, base.upiName, 80),
    gstin: typeof raw.gstin === "string" ? raw.gstin.trim().slice(0, 20) : base.gstin,
    supportPhone: text(raw.supportPhone, base.supportPhone, 16),
    supportEmail: text(raw.supportEmail, base.supportEmail, 120),
    whatsapp: text(raw.whatsapp, base.whatsapp, 16),
    adminUrl: text(raw.adminUrl, base.adminUrl, 200),
    brandName: text(raw.brandName, base.brandName, 60),
    tagline: text(raw.tagline, base.tagline, 160),
    maxQtyPerItem: Number(raw.maxQtyPerItem) > 0 ? Math.min(99, Math.round(Number(raw.maxQtyPerItem))) : base.maxQtyPerItem,
    maxQtyBulk: Number(raw.maxQtyBulk) > 0 ? Math.min(999, Math.round(Number(raw.maxQtyBulk))) : base.maxQtyBulk,
    maxQtyPerOrder: Number(raw.maxQtyPerOrder) > 0 ? Math.min(999, Math.round(Number(raw.maxQtyPerOrder))) : base.maxQtyPerOrder,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt,
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : base.updatedBy,
  };
}

async function load(): Promise<StoreSettings> {
  if (dbEnabled()) {
    const { query } = await import("./db");
    const rows = await query<{ payload: StoreSettings }>(
      "select payload from store_settings where id = 'default' limit 1",
    );
    return rows[0] ? normalizeStoreSettings(rows[0].payload) : DEFAULT_STORE_SETTINGS;
  }
  const file = dataFile("settings.json");
  if (!fs.existsSync(file)) return DEFAULT_STORE_SETTINGS;
  try {
    return normalizeStoreSettings(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    return DEFAULT_STORE_SETTINGS;
  }
}

/**
 * Settings = database/file ke defaults + owner ki Google Sheet (sheet jeetti hai).
 * Sheet me jo cell bhara hua hai wahi site par jaata hai, isliye owner ko redeploy
 * karne ki zaroorat nahi — 15 second me change live.
 */
export async function getStoreSettings(options: { fresh?: boolean } = {}): Promise<StoreSettings> {
  if (!options.fresh && cache && Date.now() - cache.at < 5_000) return cache.value;

  const stored = await load();
  const sheet = await readSheetSettings({ fresh: options.fresh });
  const value = sheet
    ? normalizeStoreSettings({
        ...stored,
        ...(sheet.announcement ? { announcement: sheet.announcement } : {}),
        ...(sheet.supportPhone ? { supportPhone: sheet.supportPhone } : {}),
        ...(sheet.supportEmail ? { supportEmail: sheet.supportEmail } : {}),
        ...(sheet.whatsapp ? { whatsapp: sheet.whatsapp } : {}),
        ...(sheet.upiId ? { upiId: sheet.upiId } : {}),
        ...(sheet.upiName ? { upiName: sheet.upiName } : {}),
        ...(sheet.gstin ? { gstin: sheet.gstin } : {}),
        ...(typeof sheet.freeShipping === "boolean" ? { freeShipping: sheet.freeShipping } : {}),
        ...(sheet.adminUrl ? { adminUrl: sheet.adminUrl } : {}),
        ...(sheet.brandName ? { brandName: sheet.brandName } : {}),
        ...(sheet.tagline ? { tagline: sheet.tagline } : {}),
        ...(sheet.maxQtyPerItem ? { maxQtyPerItem: sheet.maxQtyPerItem } : {}),
        ...(sheet.maxQtyBulk ? { maxQtyBulk: sheet.maxQtyBulk } : {}),
        ...(sheet.maxQtyPerOrder ? { maxQtyPerOrder: sheet.maxQtyPerOrder } : {}),
        ...(sheet.announcement || sheet.upiId || sheet.supportPhone
          ? { updatedAt: new Date().toISOString(), updatedBy: "google-sheet" }
          : {}),
      })
    : stored;

  cache = { at: Date.now(), value };
  return value;
}

export async function saveStoreSettings(input: unknown, actor: string): Promise<StoreSettings> {
  const next = normalizeStoreSettings({
    ...(input as StoreSettings),
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  });

  if (dbEnabled()) {
    const { query } = await import("./db");
    await query(
      `insert into store_settings (id, payload, updated_at) values ('default', $1::jsonb, now())
       on conflict (id) do update set payload = excluded.payload, updated_at = now()`,
      [JSON.stringify(next)],
    );
  } else {
    const file = dataFile("settings.json");
    fs.mkdirSync(file.replace(/\/[^/]+$/, ""), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2));
  }

  // sheet configured hai to admin ka edit seedha sheet me bhi (owner ko wahi dikhe)
  await writeSheetSettings(next).catch(() => false);

  cache = { at: Date.now(), value: next };
  return next;
}
