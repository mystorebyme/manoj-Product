import "server-only";

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { dataFile } from "@/lib/data-dir";
import { appendSheetRows } from "@/lib/google-sheets";
// row builder pure module me hai — header contract test me seedha test hota hai
import { enquirySheetRow } from "@/lib/sheet-format";

/**
 * WhatsApp enquiries.
 *
 * Customer jab product page ya cart se "Order on WhatsApp" dabata hai to:
 *   1. uska poora item list (naam, colour, size, qty, price, link) yahan save hota hai
 *   2. wahi row owner ki Google Sheet → `Enquiries` tab me chali jaati hai
 *   3. browser WhatsApp owner ke number par pre-filled message kholta hai
 *
 * Isse owner ke paas WhatsApp chat ke saath-saath ek readable DB bhi rehti hai —
 * kis din kaun sa item, kitne ka, kis page se aaya.
 */

export type EnquiryItem = {
  title: string;
  handle: string;
  colour?: string | null;
  size?: string | null;
  quantity: number;
  price: number;
};

export type Enquiry = {
  id: string;
  createdAt: string;
  /** kahan se aaya */
  type: "product" | "cart" | "checkout" | "contact";
  items: EnquiryItem[];
  total: number;
  customer?: string | null;
  phone?: string | null;
  note?: string | null;
  /** jis page se bheja (path only — koi query string me personal data nahi) */
  source?: string | null;
};

const FILE = "enquiries.json";

function readAll(): Enquiry[] {
  try {
    const raw = fs.readFileSync(dataFile(FILE), "utf8");
    const parsed = JSON.parse(raw) as Enquiry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: Enquiry[]): void {
  const file = dataFile(FILE);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

export function listEnquiries(limit = 50): Enquiry[] {
  return readAll()
    .slice()
    .reverse()
    .slice(0, Math.max(1, Math.min(500, limit)));
}

/** Naya enquiry save karo + sheet me bhejo (sheet fail ho to bhi save rahe). */
export async function saveEnquiry(input: Omit<Enquiry, "id" | "createdAt">): Promise<Enquiry> {
  const clean: Enquiry = {
    ...input,
    id: `ENQ-${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 4).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    items: input.items.slice(0, 20).map((item) => ({
      title: String(item.title).slice(0, 160),
      handle: String(item.handle).slice(0, 120),
      colour: item.colour ? String(item.colour).slice(0, 60) : null,
      size: item.size ? String(item.size).slice(0, 40) : null,
      quantity: Math.max(1, Math.min(999, Math.round(Number(item.quantity) || 1))),
      price: Math.max(0, Math.round(Number(item.price) || 0)),
    })),
    total: Math.max(0, Math.round(Number(input.total) || 0)),
    customer: input.customer ? String(input.customer).slice(0, 80) : null,
    phone: input.phone ? String(input.phone).replace(/[^\d+]/g, "").slice(0, 16) : null,
    note: input.note ? String(input.note).slice(0, 500) : null,
    source: input.source ? String(input.source).slice(0, 200) : null,
  };

  const rows = readAll();
  rows.push(clean);
  // bahut purane rows disk par na badhein
  writeAll(rows.slice(-5000));

  void appendSheetRows([{ sheet: "Enquiries", row: enquirySheetRow(clean) }]).catch(() => undefined);

  return clean;
}
