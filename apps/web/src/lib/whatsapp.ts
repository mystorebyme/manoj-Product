import type { Order } from "@liksha/types";
import { siteConfig } from "@/config/site";

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
  const body = JSON.stringify({
    ...payload,
    source: `${window.location.pathname}`.slice(0, 200),
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
