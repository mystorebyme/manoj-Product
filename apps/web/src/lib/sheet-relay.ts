"use client";

import type { Order } from "@liksha/types";
import { enquirySheetRow, orderItemRows, orderSheetRow } from "./sheet-format";
import { sheetWebAppUrl, sheetWriteToken } from "./sheet-config";

/**
 * Browser → Google Sheet relay.
 *
 * Server wala rasta (`/api/enquiry`, `/api/orders`) tab hi chalta hai jab site kisi
 * Node server par ho (Render/VPS). GitHub Pages par sirf static files hoti hain —
 * wahan koi server nahi hota, isliye sheet bharne ke liye ye chhota **client relay**
 * hai: order/enquiry seedha Apps Script web app par `no-cors` POST se chala jaata hai.
 *
 * Security (owner ke liye):
 *   • `NEXT_PUBLIC_SHEET_WRITE_TOKEN` ek **write-only** token hai — usse sirf rows
 *     add ho sakti hain (padhna/settings badalna nahi). Read token server par hi rehta hai.
 *   • Ye token site ke JS me hota hai (public build), isliye sirf `append` ki
 *     permission deta hai, aur Apps Script side par sheets ki allowlist + row cap hai.
 *   • Kuch galat ho jaye to Apps Script me `WRITE_TOKEN` badal kar redeploy kar dein.
 *
 * Relay configure nahi hai to ye module chup-chaap kuch nahi karta — site pehle
 * jaise chalti rehti hai.
 */

const URL_ = sheetWebAppUrl();
const WRITE_TOKEN = sheetWriteToken();

export function sheetRelayEnabled(): boolean {
  return /^https:\/\/script\.google\.com\//.test(URL_) && WRITE_TOKEN.length >= 6;
}

type Row = Record<string, string | number | boolean | null | undefined>;

/** Fire-and-forget — `no-cors` (Apps Script preflight support nahi karta). */
export function relayRows(rows: { sheet: string; row: Row }[]): void {
  if (!sheetRelayEnabled() || !rows.length || typeof window === "undefined") return;
  try {
    // no-cors: response opaque hota hai, par POST pahunch jaata hai (write-only use case)
    void fetch(URL_, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      headers: { "content-type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: WRITE_TOKEN, action: "append", rows }),
    }).catch(() => undefined);
  } catch {
    /* network fail — user ko rokna nahi hai */
  }
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

/**
 * Order + uske items sheet me — ek hi call me.
 *
 * Site agar server-less hai (GitHub Pages) to order ka number server deta hai hi
 * nahi, isliye ek readable ref generate hota hai: `TY-<base36 time>-<random>`.
 */
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
