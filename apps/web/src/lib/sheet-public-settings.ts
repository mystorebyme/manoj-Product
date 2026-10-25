/**
 * Sheet se **live public settings** (WhatsApp number, announcement, UPI, limits).
 *
 * Kyun: GitHub Pages par server nahi hota, isliye build ke baad owner kuch badal nahi
 * sakta. Sheet me `Settings` tab hai — `?action=public` sirf wahi keys deta hai jo
 * website par dikh sakti hain (koi token, koi order data nahi). Isse owner number ya
 * announcement badalta hai aur site ~1 minute me utha leti hai, redeploy ke bina.
 *
 * CORS: Apps Script GET response CORS allow nahi karta to fetch fail hoga — tab ye
 * chup-chaap `null` deta hai aur site build-time defaults par chalti rehti hai.
 */

import { sheetWebAppUrl } from "./sheet-config";

export type SheetPublicSettings = {
  brandName?: string;
  tagline?: string;
  supportPhone?: string;
  whatsapp?: string;
  supportEmail?: string;
  upiId?: string;
  upiName?: string;
  announcement?: string;
  freeShipping?: boolean;
  shippingFee?: number;
  maxQtyPerItem?: number;
  maxQtyBulk?: number;
  maxQtyPerOrder?: number;
};

const CACHE_KEY = "trends:sheet-settings:v1";
/** purane project ka cache key — sirf ek baar saaf karna hai (cache hi hai) */
const LEGACY_CACHE_KEY = "nyx:sheet-settings:v1";
const CACHE_MS = 60_000;

type Cached = { at: number; settings: SheetPublicSettings };

function readCache(): Cached | null {
  try {
    // ek baar purana (cloned project ka) key hata do
    window.localStorage.removeItem(LEGACY_CACHE_KEY);
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    if (!parsed || typeof parsed.at !== "number" || !parsed.settings) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(settings: SheetPublicSettings): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), settings }));
  } catch {
    /* storage band — koi baat nahi */
  }
}

/** Pehle cache (agar 1 minute se naya hai) — warna network. Fail par `null`. */
export async function fetchSheetPublicSettings(): Promise<SheetPublicSettings | null> {
  if (typeof window === "undefined") return null;
  const cached = readCache();
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.settings;

  const url = sheetWebAppUrl();
  if (!/^https:\/\/script\.google\.com\//.test(url)) return null;

  try {
    const response = await fetch(`${url}?action=public`, { cache: "no-store" });
    if (!response.ok) return cached?.settings ?? null;
    const body = (await response.json()) as { ok?: boolean; settings?: SheetPublicSettings };
    if (!body?.ok || !body.settings) return cached?.settings ?? null;
    writeCache(body.settings);
    return body.settings;
  } catch {
    // CORS / offline — purana cache ya defaults
    return cached?.settings ?? null;
  }
}
