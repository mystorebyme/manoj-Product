/**
 * Sheet bridge ki settings (build-time defaults + env override).
 *
 * GitHub Pages par koi server nahi hota, isliye web app ka URL aur **write-only**
 * token build ke andar hi chahiye hote hain. Yahan defaults isliye rakhe hain ki
 * repo variables set na hon tab bhi site kaam kare (owner ko kuch karna na pade).
 *
 * Env override (agar kabhi badalna ho):
 *   NEXT_PUBLIC_SHEET_WEBAPP_URL, NEXT_PUBLIC_SHEET_WRITE_TOKEN
 *
 * Security note: `WRITE_TOKEN` sirf rows **add** kar sakta hai (padh nahi sakta),
 * aur Apps Script side par sheet allowlist + row cap laga hua hai. Master token
 * (`tym-…`) kabhi bhi yahan ya browser me nahi jaata.
 */

export const SHEET_WEBAPP_URL_DEFAULT =
  "https://script.google.com/macros/s/AKfycbztH_mt1s5yYG4Sq9joQSZzw4KN_3BzKe-R_Z7TAV69hsrlkhOdyHoKu0F5JiiQvok/exec";

/** Write-only token — Apps Script ke `WRITE_TOKEN` se bilkul same hona chahiye. */
export const SHEET_WRITE_TOKEN_DEFAULT = "tyw-cb77177528f9474049ffa98fead4cee1";

/**
 * Transition token — jab tak owner script ka naya version deploy nahi karte, purani
 * deployment sirf apne pichhle token (`CHANGE-ME-…`) ko accept karti hai. Relay dono
 * tokens ke saath POST bhejta hai; server sirf **sahi** wale ko accept karta hai,
 * isliye duplicate row nahi banti. Naya version deploy hone ke baad ise hata dena.
 */
export const SHEET_LEGACY_WRITE_TOKEN = "CHANGE-ME-trends-write-token";

export function sheetWebAppUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SHEET_WEBAPP_URL ?? "").trim();
  return fromEnv || SHEET_WEBAPP_URL_DEFAULT;
}

export function sheetWriteToken(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SHEET_WRITE_TOKEN ?? "").trim();
  return fromEnv || SHEET_WRITE_TOKEN_DEFAULT;
}
