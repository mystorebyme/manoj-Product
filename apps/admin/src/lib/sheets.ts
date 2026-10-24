/**
 * Admin → Google Sheet bridge (Apps Script web app).
 *
 * Do kaam:
 *   • product save par `Products` tab me row (owner ko readable DB)
 *   • order status change par `Orders` tab me append (append-only history)
 *
 * Config na ho to chup-chaap skip — panel kabhi sheet ki wajah se fail nahi hota.
 */

export function sheetsConfig(): { url: string; token: string } | null {
  const url = (process.env.GOOGLE_SHEETS_WEBAPP_URL ?? "").trim();
  const token = (process.env.GOOGLE_SHEETS_TOKEN ?? "").trim();
  if (!url || !/^https:\/\/script\.google\.com\//.test(url)) return null;
  return { url, token };
}

export function sheetsEnabled(): boolean {
  return Boolean(sheetsConfig());
}

const TIMEOUT_MS = 6000;

/** Row ko sheet me append karo (best-effort, 6s timeout). */
export async function appendSheetRow(
  sheet: string,
  row: Record<string, string | number | boolean | null | undefined>,
): Promise<boolean> {
  const config = sheetsConfig();
  if (!config) return false;
  try {
    const response = await fetch(config.url, {
      method: "POST",
      cache: "no-store",
      // Apps Script preflight nahi karta — simple request (text/plain) bhejte hain
      headers: { "content-type": "text/plain;charset=utf-8", accept: "application/json" },
      body: JSON.stringify({ token: config.token, action: "append", rows: [{ sheet, row }] }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as { ok?: boolean };
    return payload.ok === true;
  } catch {
    return false;
  }
}

/** Products tab me row upsert (handle ke hisaab se overwrite, warna append). */
export async function upsertProductRow(
  row: Record<string, string | number | boolean | null | undefined>,
): Promise<boolean> {
  const config = sheetsConfig();
  if (!config) return false;
  try {
    const response = await fetch(config.url, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "text/plain;charset=utf-8", accept: "application/json" },
      body: JSON.stringify({ token: config.token, action: "upsert", sheet: "Products", key: String(row.Handle ?? ""), row }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as { ok?: boolean };
    return payload.ok === true;
  } catch {
    return false;
  }
}

/** Sheet ki recent rows (admin ke "Google Sheet" screen ke liye). */
export async function recentRows(sheet: string, limit = 20): Promise<Record<string, string | number>[] | null> {
  const config = sheetsConfig();
  if (!config) return null;
  try {
    const endpoint = new URL(config.url);
    endpoint.searchParams.set("action", "recent");
    endpoint.searchParams.set("sheet", sheet);
    endpoint.searchParams.set("limit", String(limit));
    endpoint.searchParams.set("token", config.token);
    const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return null;
    const payload = (await response.json()) as { ok?: boolean; rows?: Record<string, string | number>[] };
    return payload.ok && Array.isArray(payload.rows) ? payload.rows : null;
  } catch {
    return null;
  }
}
