"use client";

import type { Order } from "@liksha/types";
import { enquirySheetRow, orderItemRows, orderSheetRow } from "./sheet-format";
import { sheetWebAppUrl, sheetWriteToken } from "./sheet-config";

/**
 * Browser → Google Sheet relay (GitHub Pages / koi bhi static host).
 *
 * Problem jo owner ne report ki: "order aur contact form ka data sheet me nahi aata".
 * Wajah: Apps Script `doPost` par browser ka CORS preflight fail hota hai, aur POST
 * ka result browser ko dikhta hi nahi (opaque). Isliye ab **GET + query params**
 * primary rasta hai — Apps Script GET par `Access-Control-Allow-Origin: *` bhejta
 * hai, to jawab padha ja sakta hai (`{ok:true,written:1}`) aur pata chalta hai ki
 * row sach me likhi gayi.
 *
 * Delivery chain (teen raste, isliye ek fail ho to baaki chalta hai):
 *   1. `fetch` GET  `${url}?action=append&token=…&data=<base64url rows>`
 *      → verifiable. Success par queue se row hatti hai.
 *   2. `navigator.sendBeacon` POST (text/plain) — page band ho raha ho tab bhi
 *      request chali jaati hai. (Unverified, par Apps Script side dedupe hai.)
 *   3. hidden form POST — sabse purana, har browser me chalta hai.
 *
 * Har row pehle **localStorage queue** me save hoti hai aur tabhi nikalta hai jab
 * server `ok:true` bole. Internet gaya, tab band hua, script down — row gum nahi
 * hoti; agli visit par khud chali jaati hai. Apps Script `Order ID`/`Enquiry ID`
 * se duplicate rok deta hai, isliye retry se double rows nahi banti.
 */

const URL_ = sheetWebAppUrl();
const WRITE_TOKEN = sheetWriteToken();
/** GET URL ki limit ~8 KB hoti hai — isliye payload chhote batches me */
const MAX_GET_PAYLOAD = 2600;
const QUEUE_KEY = "nyx:sheet-queue-v2";
const MAX_QUEUE = 250;
const MAX_ATTEMPTS = 40;
const RETRY_AFTER_MS = 20_000;

type Row = Record<string, string | number | boolean | null | undefined>;
export type RelayEntry = { id: string; at: number; attempts: number; rows: { sheet: string; row: Row }[] };

export function sheetRelayEnabled(): boolean {
  return /^https:\/\/script\.google\.com\//.test(URL_) && WRITE_TOKEN.length >= 6;
}

/* ─────────────────────────── encoding ─────────────────────────── */

/** UTF-8 safe base64url — Apps Script `Utilities.base64DecodeWebSafe` ise padhta hai */
export function encodePayload(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Verifiable GET write ka URL */
export function appendUrl(baseUrl: string, token: string, rows: { sheet: string; row: Row }[]): string {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}action=append&token=${encodeURIComponent(token)}&data=${encodePayload(rows)}`;
}

/* ─────────────────────────── queue (durable) ─────────────────────────── */

function readQueue(): RelayEntry[] {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as RelayEntry[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && Array.isArray(entry.rows) && entry.rows.length > 0);
  } catch {
    return [];
  }
}

function writeQueue(entries: RelayEntry[]): void {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(entries.slice(-MAX_QUEUE)));
  } catch {
    /* storage full/band — queue sirf best effort */
  }
}

function newId(): string {
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function enqueue(rows: { sheet: string; row: Row }[]): RelayEntry {
  const entry: RelayEntry = { id: newId(), at: Date.now(), attempts: 0, rows };
  const queue = readQueue();
  queue.push(entry);
  writeQueue(queue);
  return entry;
}

function dequeue(id: string): void {
  writeQueue(readQueue().filter((entry) => entry.id !== id));
}

/** Kitni rows abhi bhi sheet tak nahi pahunchi (diagnostics page dikhata hai) */
export function pendingRelayCount(): number {
  try {
    return readQueue().reduce((sum, entry) => sum + entry.rows.length, 0);
  } catch {
    return 0;
  }
}

/* ─────────────────────────── transports ─────────────────────────── */

/** GET write — jawab padha ja sakta hai, isliye yahi "sach" hai. */
async function sendViaGet(rows: { sheet: string; row: Row }[]): Promise<boolean> {
  const response = await fetch(appendUrl(URL_, WRITE_TOKEN, rows), {
    method: "GET",
    cache: "no-store",
    // CORS: Apps Script GET par `*` bhejta hai, isliye jawab milta hai
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return false;
  const payload = (await response.json()) as { ok?: boolean; written?: number };
  return Boolean(payload?.ok) && (payload.written ?? 0) >= 0;
}

function sendViaBeacon(rows: { sheet: string; row: Row }[]): void {
  try {
    const body = JSON.stringify({ token: WRITE_TOKEN, action: "append", rows });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(URL_, new Blob([body], { type: "text/plain;charset=UTF-8" }));
      return;
    }
    void fetch(URL_, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      headers: { "content-type": "text/plain;charset=utf-8" },
      body,
    }).catch(() => undefined);
  } catch {
    /* agla transport dekhega */
  }
}

/**
 * Hidden-form fallback — browser ka normal form POST (CORS lagta hi nahi).
 * Apps Script `e.parameter` se padhta hai.
 */
function sendViaForm(rows: { sheet: string; row: Row }[]): void {
  try {
    const frameName = "nyx-sheet-frame";
    let frame = document.getElementsByName(frameName)[0] as HTMLIFrameElement | undefined;
    if (!frame) {
      frame = document.createElement("iframe");
      frame.name = frameName;
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      frame.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
      document.body.appendChild(frame);
    }
    const form = document.createElement("form");
    form.method = "POST";
    form.action = URL_;
    form.target = frameName;
    form.style.display = "none";
    const fields: Record<string, string> = {
      token: WRITE_TOKEN,
      action: "append",
      rows: JSON.stringify(rows),
    };
    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    window.setTimeout(() => form.remove(), 4000);
  } catch {
    /* last transport bhi fail — queue me pada rahega */
  }
}

/**
 * 1×1 pixel GET — sabse aakhri fallback.
 *
 * Image request ko browser kabhi CORS/preflight ke liye nahi rokta, aur page band
 * hone par bhi chali jaati hai. Jawab verify nahi hota, par Apps Script side
 * duplicate guard ki wajah se ise safely bhej sakte hain.
 */
function sendViaPixel(rows: { sheet: string; row: Row }[]): void {
  try {
    const url = appendUrl(URL_, WRITE_TOKEN, rows);
    if (url.length > 7000) return;
    const image = new Image();
    image.referrerPolicy = "no-referrer";
    image.src = url;
  } catch {
    /* ignore */
  }
}

/** Rows ko GET ke liye chhote batches me todo */
export function splitBatches(rows: { sheet: string; row: Row }[]): { sheet: string; row: Row }[][] {
  const batches: { sheet: string; row: Row }[][] = [];
  let current: { sheet: string; row: Row }[] = [];
  for (const entry of rows) {
    const candidate = [...current, entry];
    if (current.length && encodePayload(candidate).length > MAX_GET_PAYLOAD) {
      batches.push(current);
      current = [entry];
    } else {
      current = candidate;
    }
  }
  if (current.length) batches.push(current);
  return batches;
}

/** Ek queue entry ko bhejne ki koshish — success par queue se hata do */
async function deliver(entry: RelayEntry): Promise<boolean> {
  for (const batch of splitBatches(entry.rows)) {
    // ek hi row itni badi ho ki URL limit cross ho jaye → GET skip (400 aata hai)
    if (encodePayload(batch).length <= MAX_GET_PAYLOAD) {
      try {
        if (await sendViaGet(batch)) continue;
      } catch {
        /* GET fail — niche unverified raste try karo */
      }
    }
    sendViaBeacon(batch);
    sendViaForm(batch);
    sendViaPixel(batch);
    return false;
  }
  dequeue(entry.id);
  return true;
}

/**
 * Purani pending rows bhejo (page load par aur har naye submit par chalta hai).
 * `force` false hone par recent entries ko 20s tak chhedta nahi (throttle).
 */
export async function flushSheetQueue(force = false): Promise<number> {
  if (!sheetRelayEnabled() || typeof window === "undefined") return 0;
  let sent = 0;
  for (const entry of readQueue()) {
    if (!force && entry.attempts > 0 && Date.now() - entry.at < RETRY_AFTER_MS) continue;
    if (entry.attempts >= MAX_ATTEMPTS) continue;
    const queue = readQueue();
    const item = queue.find((candidate) => candidate.id === entry.id);
    if (item) {
      item.attempts += 1;
      item.at = Date.now();
      writeQueue(queue);
    }
    if (await deliver(entry)) sent += entry.rows.length;
  }
  return sent;
}

/* ─────────────────────────── public API ─────────────────────────── */

/**
 * Fire-and-forget — rows queue me daalo, bhejne ki koshish karo.
 * Caller ko await karne ki zaroorat nahi, par `await` kare to bhi 12s max.
 */
export function relayRows(rows: { sheet: string; row: Row }[]): void {
  if (!sheetRelayEnabled() || !rows.length || typeof window === "undefined") return;
  enqueue(rows);
  // nayi row + purani pending rows — dono ek hi pass me (force: naya submit turant jaye)
  void flushSheetQueue(true).catch(() => undefined);
}

export type RelayOrderInput = {
  orderRef: string;
  createdAt?: string;
  customerName: string;
  phone: string;
  email?: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes?: string | null;
  items: {
    title: string;
    handle: string;
    colour?: string | null;
    size?: string | null;
    quantity: number;
    price: number;
    image?: string | null;
  }[];
  total: number;
};

/** Order + uske items sheet me — ek hi queue entry me. */
export function relayOrderToSheet(input: RelayOrderInput): void {
  if (!sheetRelayEnabled()) return;
  const createdAt = input.createdAt ?? new Date().toISOString();
  const subtotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const order = {
    id: input.orderRef,
    orderNumber: input.orderRef,
    createdAt,
    status: "placed",
    customerName: input.customerName,
    phone: input.phone,
    email: input.email ?? "",
    address: input.address,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
    notes: input.notes ?? null,
    items: input.items.map((item) => ({
      title: item.title,
      handle: item.handle,
      image: item.image ?? "",
      colour: item.colour ?? null,
      size: item.size ?? "",
      quantity: item.quantity,
      price: item.price,
    })),
    subtotal,
    discount: 0,
    shipping: 0,
    total: input.total,
    couponCode: null,
    paymentMethod: "prepaid",
    paymentStatus: "pending",
    payment: { gateway: "whatsapp", reference: null, amount: input.total, status: "pending", createdAt },
  } as unknown as Order;

  relayRows([
    { sheet: "Orders", row: orderSheetRow(order, "order.placed.whatsapp") },
    ...orderItemRows(order).map((row) => ({ sheet: "Order Items", row })),
  ]);
}

/** WhatsApp enquiry (product page / cart / checkout) → `Enquiries` tab. */
export function relayEnquiryToSheet(input: {
  id: string;
  createdAt: string;
  type: string;
  items: { title: string; handle: string; colour?: string | null; size?: string | null; quantity: number; price: number }[];
  total: number;
  customer?: string | null;
  phone?: string | null;
  note?: string | null;
  source?: string | null;
}): void {
  if (!sheetRelayEnabled()) return;
  relayRows([
    {
      sheet: "Enquiries",
      row: enquirySheetRow({
        id: input.id,
        createdAt: input.createdAt,
        type: input.type,
        customer: input.customer ?? null,
        phone: input.phone ?? null,
        items: input.items,
        total: input.total,
        note: input.note ?? null,
        source: input.source ?? null,
      }),
    },
  ]);
}

/** Footer ka newsletter signup → `Newsletter` tab (static hosting par bhi). */
export function relayNewsletterToSheet(email: string, source = "footer"): void {
  if (!sheetRelayEnabled()) return;
  relayRows([
    { sheet: "Newsletter", row: { Timestamp: new Date().toISOString(), Email: email, Source: source } },
  ]);
}

/** Contact form ka message → `Messages` tab. */
export function relayMessageToSheet(input: {
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
}): void {
  if (!sheetRelayEnabled()) return;
  relayRows([
    {
      sheet: "Messages",
      row: {
        Timestamp: new Date().toISOString(),
        Name: input.name,
        Email: input.email,
        Phone: input.phone ?? "",
        Subject: input.subject ?? "",
        Message: input.message,
        Status: "new",
      },
    },
  ]);
}

/** Naya order ref — `TY-` + time + random (sheet/deep-link me pehchaan ke liye). */
export function newOrderRef(): string {
  const time = Date.now().toString(36).toUpperCase().slice(-6);
  const random = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `TY-${time}${random}`;
}
