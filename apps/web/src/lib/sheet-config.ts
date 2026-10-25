/**
 * Sheet bridge ki settings — **ek hi verified jagah** se.
 *
 * Owner ka bug (25 Oct): GitHub ke repo variables me `SHEET_WEBAPP_URL` /
 * `SHEET_WRITE_TOKEN` kisi **dusre (purane) Apps Script deployment** ke liye set
 * the. Us deployment ka jawab har request par `{"ok":false,"error":"unauthorized"}`
 * aata tha — isliye order, contact form, enquiry, newsletter, review… kuch bhi
 * sheet tak pahunchta hi nahi tha (sheet me sirf purane test rows the).
 *
 * Isliye ab URL/token **code me hi** hain (yahi deployment owner ki sheet
 * `1ag5Ivpw…` se juda hua hai aur `?action=verify_write` par `true` deta hai) —
 * purane env vars ki galti dobara asar nahi karegi.
 *
 * Naya deployment lena ho to bas niche `VERIFIED_WEBAPP_URL` + `VERIFIED_WRITE_TOKEN`
 * badal dein (dono ek hi jagah). Ya phir `NEXT_PUBLIC_SHEET_URL_OVERRIDE` /
 * `NEXT_PUBLIC_SHEET_TOKEN_OVERRIDE` env set karein — naam deliberately alag hain
 * taaki purane `SHEET_*` variables galti se lagu na hon.
 *
 * Security note: `WRITE_TOKEN` sirf rows **add** kar sakta hai (padh nahi sakta),
 * aur Apps Script side par sheet allowlist + row cap laga hua hai. Master token
 * (`tym-…`) kabhi bhi browser me nahi jaata.
 */

const VERIFIED_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbwQxTH7BIhPkYvlTi7SWzUnh5WD2mP-AijXB2vrfLr9j3TvcD7fW3XtM4N9406VYDhO/exec";

/** Write-only token — Apps Script ke `WRITE_TOKEN` se match karta hai (verify_write: true) */
const VERIFIED_WRITE_TOKEN = "tyw-cb77177528f9474049ffa98fead4cee1";

/** Purane naam bhi rakhe hain (kuch docs/tests inhe import karte hain) */
export const SHEET_WEBAPP_URL_DEFAULT = VERIFIED_WEBAPP_URL;
export const SHEET_WRITE_TOKEN_DEFAULT = VERIFIED_WRITE_TOKEN;

/**
 * Optional override — sirf naye naam se. Value Apps Script URL hona chahiye.
 */
export function sheetWebAppUrl(): string {
  const override = (process.env.NEXT_PUBLIC_SHEET_URL_OVERRIDE ?? "").trim();
  if (/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(override)) return override;
  return VERIFIED_WEBAPP_URL;
}

export function sheetWriteToken(): string {
  const override = (process.env.NEXT_PUBLIC_SHEET_TOKEN_OVERRIDE ?? "").trim();
  return override.length >= 6 ? override : VERIFIED_WRITE_TOKEN;
}

/** Sheet (spreadsheet) ka ID — sirf docs/diagnostics ke liye, browser ko chahiye nahi */
export const SHEET_SPREADSHEET_ID = "1ag5Ivpw8GWkX8oE5_KLe77GFR4KP-7uQFKsmjeZ2xVY";
