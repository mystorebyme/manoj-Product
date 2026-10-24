import fs from "node:fs";
import path from "node:path";
import { dataFile } from "./data-dir";

/**
 * Sheet outbox — "sheet me har detail pahunchni chahiye" ka guarantee.
 *
 * Apps Script web app kabhi slow ho, quota lag jaye ya network timout ho jaye to
 * row **gum nahi** hoti: yahan disk par queue ho jaati hai aur agli baar sheet
 * reachable hote hi (naya order / 15s settings refresh) khud bhej di jaati hai.
 *
 * File: `<DATA_DIR>/sheet-outbox.json` (default `.data/`). Purani rows pehle
 * jaati hain — isliye sheet me line order wahi rehta hai jo asli me hua tha.
 */

export type OutboxRow = {
  sheet: string;
  row: Record<string, string | number | boolean | null | undefined>;
  /** kab queue hui (ISO) */
  at: string;
};

const FILE = "sheet-outbox.json";
/** Itne se zyada rows bhi pending hon to bhi bharte rahenge, par purani pehle */
const MAX_ROWS = 1_000;

function readRaw(): OutboxRow[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile(FILE), "utf8")) as OutboxRow[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry.sheet === "string" && entry.row);
  } catch {
    return [];
  }
}

function writeRaw(rows: OutboxRow[]): void {
  const target = dataFile(FILE);
  if (!rows.length) {
    try {
      fs.rmSync(target, { force: true });
    } catch {
      /* kuch na karo */
    }
    return;
  }
  const tmp = path.join(path.dirname(target), `${FILE}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), "utf8");
  fs.renameSync(tmp, target);
}

export function outboxRows(): OutboxRow[] {
  return readRaw();
}

export function outboxCount(): number {
  return readRaw().length;
}

/** Rows queue karo. Bahut zyada pending ho to **purani** rows rakhte hain. */
export function enqueueRows(
  rows: { sheet: string; row: Record<string, string | number | boolean | null | undefined> }[],
): number {
  if (!rows.length) return outboxCount();
  const queued = readRaw();
  const at = new Date().toISOString();
  for (const entry of rows) queued.push({ sheet: entry.sheet, row: entry.row, at });
  const trimmed = queued.length > MAX_ROWS ? queued.slice(queued.length - MAX_ROWS) : queued;
  writeRaw(trimmed);
  return trimmed.length;
}

/**
 * Sabse purani `limit` rows outbox se nikaal kar do (file me sirf baaki bachti hain).
 * Bhejne me fail ho to caller `enqueueRows(batch)` se wapas daal de.
 */
export function takeOutboxBatch(limit = 40): OutboxRow[] {
  const rows = readRaw();
  if (!rows.length) return [];
  const batch = rows.slice(0, Math.max(1, limit));
  writeRaw(rows.slice(batch.length));
  return batch;
}

export function clearOutbox(): void {
  writeRaw([]);
}
