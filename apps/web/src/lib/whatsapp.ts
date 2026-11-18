import type { Order } from "@liksha/types";
import { siteConfig } from "../config/site";
import { relayEnquiryToSheet } from "./sheet-relay";

/**
 * WhatsApp — dukaan ka sabse zaroori order channel.
 *
 * Do tarah ke flow, dono me customer ka poora item detail (naam · colour · size ·
 * qty · price · link) pre-filled message me jaata hai, aur wahi detail background
 * me DB + Google Sheet (`Enquiries` / `Orders`) me save hoti hai:
 *
 *   1. Product page → "Order on WhatsApp" (ek item)
 *   2. Cart / drawer → "Send cart on WhatsApp" (poora cart)
 *
 * Koi API key nahi, koi 3rd party nahi — sirf `wa.me` deep link jo customer ke
 * apne WhatsApp me owner ke number par chat khol deta hai.
 */

export const money = (paise: number) => `Rs. ${(paise / 100).toLocaleString("en-IN")}`;

/** 10 digit number → `wa.me` ke liye 91 ke saath */
export function whatsappNumber(raw?: string | null): string {
  const digits = String(raw ?? siteConfig.whatsapp).replace(/\D/g, "");
  const last10 = digits.slice(-10);
  return `91${last10}`;
}

export const WHATSAPP_NUMBER = whatsappNumber(siteConfig.whatsapp);

/** Site ka live URL — WhatsApp message me hamari hi site ka link jaata hai. */
export function currentSiteUrl(): string {
  if (typeof window !== "undefined") {
    const base = process.env.NEXT_PUBLIC_PAGES_BASE_PATH ?? "";
    return `${window.location.origin}${base}`;
  }
  return siteConfig.url;
}

export function productUrl(handle: string): string {
  return `${currentSiteUrl()}/products/${handle}`;
}

export function whatsappLink(message: string, phone = WHATSAPP_NUMBER): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

export type WhatsAppLine = {
  title: string;
  handle: string;
  size?: string | null;
  colour?: string | null;
  quantity: number;
  price: number;
  image?: string | null;
};

/** Ek item ka message (product page ka button). */
export function productWhatsAppMessage(line: WhatsAppLine, origin = currentSiteUrl()): string {
  const total = line.price * line.quantity;
  return [
    `*${siteConfig.name} — order on WhatsApp*`,
    "",
    `*${line.title}*`,
    line.colour ? `Colour: ${line.colour}` : null,
    `Size: ${line.size || "-"}`,
    `Quantity: ${line.quantity}`,
    `Price: ${money(line.price)} × ${line.quantity} = *${money(total)}*`,
    "",
    `Product: ${origin}/products/${line.handle}`,
    "",
    "Please confirm availability and share the payment link.",
  ]
    .filter((part): part is string => part !== null)
    .join("\n");
}

/** Poora cart ek message me (cart page + drawer). */
export function cartWhatsAppMessage(lines: WhatsAppLine[], origin = currentSiteUrl()): string {
  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const pieces = lines.reduce((sum, line) => sum + line.quantity, 0);
  const parts = [`*${siteConfig.name} — cart order*`, ""];
  lines.forEach((line, index) => {
    parts.push(
      `${index + 1}. *${line.title}*` +
        `\n   ${[line.colour ? `Colour: ${line.colour}` : null, `Size: ${line.size ?? "-"}`]
          .filter(Boolean)
          .join(" · ")}` +
        `\n   Qty: ${line.quantity} × ${money(line.price)} = ${money(line.price * line.quantity)}` +
        `\n   ${origin}/products/${line.handle}`,
    );
  });
  parts.push("", `Items: ${lines.length} · Pieces: ${pieces}`, `*Total: ${money(total)}*`);
  parts.push("", "Please confirm this order and share the payment link.");
  return parts.join("\n");
}

export type CheckoutWhatsAppInput = {
  items: WhatsAppLine[];
  total: number;
  name: string;
  phone: string;
  email?: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes?: string | null;
  orderRef?: string | null;
  origin?: string;
};

/**
 * Checkout ka **poora** order message — yahi owner ko WhatsApp par jaata hai.
 *
 * Har item ke saath: naam · colour · size · qty · line total · **product link**,
 * aur neeche customer ka naam, phone, email, poora address, notes aur total.
 * Isse owner bina kuch poochhe order ready kar sakta hai.
 */
export function checkoutWhatsAppMessage(input: CheckoutWhatsAppInput): string {
  const origin = input.origin ?? currentSiteUrl();
  const pieces = input.items.reduce((sum, line) => sum + line.quantity, 0);
  const parts: string[] = [];
  parts.push(`*${siteConfig.name} — new order* 🛍️`);
  if (input.orderRef) parts.push(`Order ref: *${input.orderRef}*`);
  parts.push("");
  parts.push(`*Items (${input.items.length} · ${pieces} pcs)*`);
  input.items.forEach((line, index) => {
    parts.push(
      `${index + 1}. *${line.title}*` +
        (line.colour ? `\n   Colour: ${line.colour}` : "") +
        `\n   Size: ${line.size || "-"} · Qty: ${line.quantity}` +
        `\n   Price: ${money(line.price)} × ${line.quantity} = ${money(line.price * line.quantity)}` +
        `\n   Link: ${origin}/products/${line.handle}`,
    );
  });
  parts.push("");
  parts.push(`*Total: ${money(input.total)}* (free shipping)`);
  parts.push("");
  parts.push("*Customer details*");
  parts.push(`Name: ${input.name || "-"}`);
  parts.push(`Phone: ${input.phone || "-"}`);
  if (input.email) parts.push(`Email: ${input.email}`);
  parts.push(
    `Address: ${[input.address, input.city, input.state, input.pincode].filter(Boolean).join(", ")}`,
  );
  if (input.notes) parts.push(`Notes: ${input.notes}`);
  // Payment ki koi detail message me nahi jaati — owner WhatsApp par khud batata hai.
  parts.push("");
  parts.push("Please confirm this order and share the payment/confirm message. Thank you!");
  return parts.join("\n");
}

/** Product page se owner se sawaal — item ka link saath jaata hai. */
export function questionWhatsAppMessage(line: WhatsAppLine, origin = currentSiteUrl()): string {
  return [
    `*${siteConfig.name} — product question*`,
    "",
    `*${line.title}*`,
    line.colour ? `Colour: ${line.colour}` : null,
    line.size ? `Size: ${line.size}` : null,
    `Link: ${origin}/products/${line.handle}`,
    "",
    "Hi, mujhe is item ke baare me kuch poochhna hai —",
    "• Fabric / work kya hai?",
    "• Delivery kitne din me hogi?",
    "• Kya ye size me available hai?",
  ]
    .filter((part): part is string => part !== null)
    .join("\n");
}

/** Order place hone ke baad confirmation message. */
export function orderWhatsAppMessage(order: Order, origin = siteConfig.url): string {
  const lines: string[] = [];
  lines.push(`*${siteConfig.name} — order confirmation*`);
  lines.push("");
  lines.push(`Order number: *${order.orderNumber}*`);
  lines.push(`Name: ${order.customerName}`);
  lines.push(`Phone: ${order.phone}`);
  lines.push("");
  lines.push(`*Items (${order.items.length})*`);
  order.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.title}` +
        (item.colour ? `\n   Colour: ${item.colour}` : "") +
        `\n   Size: ${item.size}` +
        `\n   Qty: ${item.quantity} × ${money(item.price)} = ${money(item.price * item.quantity)}` +
        `\n   Link: ${origin}/products/${item.handle}`,
    );
  });
  lines.push("");
  lines.push(`Subtotal: ${money(order.subtotal)}`);
  if (order.discount > 0) lines.push(`Discount: -${money(order.discount)}`);
  lines.push(`Shipping: ${order.shipping > 0 ? money(order.shipping) : "Free"}`);
  lines.push(`*Total: ${money(order.total)}*`);
  lines.push(`Payment: Prepaid (${order.paymentStatus})`);
  lines.push("");
  lines.push("*Delivery address*");
  lines.push(`${order.address}, ${order.city}, ${order.state} - ${order.pincode}`);
  if (order.notes) {
    lines.push("");
    lines.push(`Note: ${order.notes}`);
  }
  lines.push("");
  lines.push("Please confirm my order on WhatsApp.");
  return lines.join("\n");
}

export function orderWhatsAppLink(order: Order, origin = siteConfig.url): string {
  return whatsappLink(orderWhatsAppMessage(order, origin));
}

export type EnquiryPayload = {
  type: "product" | "cart" | "checkout";
  items: { title: string; handle: string; colour?: string | null; size?: string | null; quantity: number; price: number }[];
  total: number;
  customer?: string | null;
  phone?: string | null;
  note?: string | null;
};

/**
 * WhatsApp kholne se pehle enquiry ko DB/Sheet me log karo.
 *
 * `sendBeacon` use karte hain — tab switch / app open hone par bhi request
 * cancel nahi hoti, aur customer ko kuch wait nahi karna padta.
 */
export function logWhatsAppEnquiry(payload: EnquiryPayload): void {
  if (typeof window === "undefined") return;
  const source = `${window.location.pathname}`.slice(0, 200);
  const body = JSON.stringify({ ...payload, source });

  /**
   * Sheet relay — GitHub Pages (static) par `/api/enquiry` hoti hi nahi, isliye
   * enquiry seedha Apps Script par bhi bhejte hain. Server ho to dono jagah
   * pahunchti hai (sheet relay configure na ho to ye line kuch nahi karti).
   */
  relayEnquiryToSheet({
    id: `ENQ-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    type: payload.type,
    items: payload.items.map((item) => ({
      title: item.title,
      handle: item.handle,
      colour: item.colour ?? null,
      size: item.size ?? null,
      quantity: item.quantity,
      price: item.price,
    })),
    total: payload.total,
    customer: payload.customer ?? null,
    phone: payload.phone ?? null,
    note: payload.note ?? null,
    source,
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/enquiry", blob)) return;
    }
  } catch {
    /* fall through to fetch */
  }
  void fetch("/api/enquiry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
