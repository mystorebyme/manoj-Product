"use client";

/**
 * Order tracking — seedha Google Sheet se.
 *
 * Owner `Orders` tab me `Status` / `Courier` / `AWB` / `Notes` badalta hai, aur
 * `Order Updates` tab me message likhta hai. Site `?action=order_status` se wahi
 * padhti hai, isliye tracking ke liye koi server/database ki zaroorat nahi —
 * static hosting par bhi kaam karta hai.
 *
 * Order number + registered mobile dono match hone par hi jawab aata hai, isliye
 * koi doosre ka order nahi dekh sakta.
 */

import { sheetWebAppUrl } from "./sheet-config";

export type TrackedOrder = {
  orderNumber: string;
  placedAt: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  qty: number;
  city: string;
  state: string;
  courier: string;
  awb: string;
  trackingUrl: string;
  note: string;
};

export type TrackedItem = {
  product: string;
  handle: string;
  colour: string;
  size: string;
  qty: number;
  price: number;
  image: string;
  link: string;
};

export type TrackedUpdate = { at: string; status: string; message: string };

export type OrderTrackResult = {
  ok: boolean;
  error?: string;
  order?: TrackedOrder;
  items?: TrackedItem[];
  updates?: TrackedUpdate[];
};

export const ORDER_STEPS = ["placed", "confirmed", "packed", "shipped", "delivered"] as const;
export type OrderStep = (typeof ORDER_STEPS)[number];

/** Sheet ke sheet-message status ko step index me — kuch bhi likha ho, kaam chale */
export function stepIndex(status: string): number {
  const value = String(status ?? "").trim().toLowerCase();
  if (!value) return 0;
  if (/cancel|return|refund|rto/.test(value)) return -1;
  if (/deliver|complete|handover/.test(value)) return 4;
  if (/ship|dispatch|transit|courier|awb|out for/.test(value)) return 3;
  if (/pack|ready|label/.test(value)) return 2;
  if (/confirm|process|accept|prepar/.test(value)) return 1;
  return 0;
}

export function trackingEnabled(): boolean {
  return /^https:\/\/script\.google\.com\//.test(sheetWebAppUrl());
}

export async function trackOrder(orderNumber: string, phone: string): Promise<OrderTrackResult> {
  const base = sheetWebAppUrl();
  if (!/^https:\/\/script\.google\.com\//.test(base)) {
    return { ok: false, error: "Tracking abhi setup nahi hua — WhatsApp par status le lein." };
  }
  const order = orderNumber.trim().toUpperCase();
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (!order) return { ok: false, error: "Order number daaliye." };
  if (digits.length !== 10) return { ok: false, error: "10 digit mobile number daaliye." };

  try {
    const url = `${base}?action=order_status&order=${encodeURIComponent(order)}&phone=${digits}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return { ok: false, error: "Sheet se jawab nahi aaya — thodi der baad try karein." };
    }
    const body = (await response.json()) as OrderTrackResult & { ok?: boolean };
    if (!body?.ok || !body.order) {
      return { ok: false, error: body?.error || "Is number ka koi order nahi mila." };
    }
    return { ok: true, order: body.order, items: body.items ?? [], updates: body.updates ?? [] };
  } catch {
    return { ok: false, error: "Network problem — WhatsApp par status le sakte hain." };
  }
}
