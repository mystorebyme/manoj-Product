import type { Order } from "@liksha/types";
import { siteConfig } from "../config/site";

/**
 * Google Sheet row formatting — pure functions (koi network / server-only nahi).
 * Isliye unit tests me seedha import ho sakte hain.
 */

export type SheetSettings = {
  announcement?: string;
  supportPhone?: string;
  supportEmail?: string;
  whatsapp?: string;
  upiId?: string;
  upiName?: string;
  gstin?: string;
  freeShipping?: boolean;
  adminUrl?: string;
  /** owner sheet se quantity limits (Settings tab) */
  maxQtyPerItem?: number;
  maxQtyBulk?: number;
  maxQtyPerOrder?: number;
  brandName?: string;
  tagline?: string;
};

function text(value: unknown, max = 240): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, max) : undefined;
}

function number_(value: unknown, min: number, max: number): number | undefined {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function truthy(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase();
    if (["true", "yes", "y", "1", "on", "haan"].includes(normalised)) return true;
    if (["false", "no", "n", "0", "off", "nahi"].includes(normalised)) return false;
  }
  return undefined;
}

/** Apps Script kai shapes bhej sakta hai — sabko ek hi shape me laao */
export function normaliseSheetSettings(payload: unknown): SheetSettings | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  if (root.ok === false) return null;
  const source =
    (root.settings as Record<string, unknown> | undefined) ??
    (root.data as Record<string, unknown> | undefined) ??
    root;

  const settings: SheetSettings = {
    announcement: text(source.announcement ?? source.Announcement, 180),
    supportPhone: text(source.supportPhone ?? source.support_phone ?? source.phone, 16),
    supportEmail: text(source.supportEmail ?? source.support_email ?? source.email, 120),
    whatsapp: text(source.whatsapp ?? source.whatsapp_number, 16),
    upiId: text(source.upiId ?? source.upi_id ?? source.upi, 80),
    upiName: text(source.upiName ?? source.upi_name ?? source.payee_name, 80),
    gstin: text(source.gstin ?? source.GSTIN, 20),
    freeShipping: truthy(source.freeShipping ?? source.free_shipping),
    adminUrl: text(source.adminUrl ?? source.admin_url ?? source.admin_panel, 200),
    maxQtyPerItem: number_(source.maxQtyPerItem ?? source.max_qty_per_item, 1, 99),
    maxQtyBulk: number_(source.maxQtyBulk ?? source.max_qty_bulk, 1, 999),
    maxQtyPerOrder: number_(source.maxQtyPerOrder ?? source.max_qty_per_order, 1, 999),
    brandName: text(source.brandName ?? source.brand_name, 60),
    tagline: text(source.tagline, 160),
  };

  const hasValue = Object.values(settings).some((value) => value !== undefined);
  return hasValue ? settings : null;
}

const inr = (paise: number) => Math.round(paise) / 100;

/** `7740992663` → `wa.me/917740992663` (sheet me clickable link ban jaata hai) */
export function sheetWhatsAppLink(phone: string | null | undefined): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  const last10 = digits.slice(-10);
  return last10.length === 10 ? `https://wa.me/91${last10}` : "";
}

function lineLabel(item: Order["items"][number]): string {
  const bits = [item.title];
  const variant = [item.colour, item.size].filter(Boolean).join(" / ");
  return `${bits[0]}${variant ? ` (${variant})` : ""} x${item.quantity}`;
}

/**
 * Order ki ek sheet row. Har event (placed / payment submitted / paid / shipped)
 * apni row banata hai — owner ko timeline milti hai, purani row overwrite nahi hoti.
 *
 * **Keys exactly `Orders` tab ke headers hain** (Apps Script header ke naam se cell
 * me value daalta hai, isliye naam badalna = column khaali chala jaana).
 */
export function orderSheetRow(
  order: Order,
  event: string,
  extra: Record<string, string | number | null> = {},
): Record<string, string | number> {
  const pieces = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const notes = Object.entries(extra)
    .filter(([, value]) => value !== null && value !== undefined && String(value) !== "")
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");

  return {
    "Order ID": order.orderNumber,
    "Date & Time": order.createdAt || new Date().toISOString(),
    Event: event,
    Status: order.status,
    Customer: order.customerName,
    Phone: order.phone,
    WhatsApp: sheetWhatsAppLink(order.phone),
    Email: order.email,
    Address: order.address,
    City: order.city,
    State: order.state,
    PIN: order.pincode,
    Items: order.items.map(lineLabel).join(" | "),
    "Qty total": pieces,
    "Subtotal ₹": inr(order.subtotal),
    "Discount ₹": inr(order.discount),
    Coupon: order.couponCode ?? "",
    "Shipping ₹": inr(order.shipping),
    "Total ₹": inr(order.total),
    "Payment method": order.paymentMethod,
    "Payment status": order.paymentStatus,
    "Payment ref": order.payment?.reference ?? "",
    Courier: order.tracking?.courier ?? "",
    AWB: order.tracking?.awb ?? "",
    "Tracking URL": order.tracking?.url ?? "",
    Notes: [order.notes ?? "", notes].filter(Boolean).join(" · "),
    Source: order.payment?.gateway ? `website · ${order.payment.gateway}` : "website",
  };
}

/**
 * `Payments` tab ki row — payment submit / verify / reverse ka record.
 * Keys exactly Payments headers ke naam par hain.
 */
export function paymentSheetRow(
  order: Order,
  event: string,
  extra: Record<string, string | number | null> = {},
): Record<string, string | number> {
  return {
    Timestamp: new Date().toISOString(),
    Event: event,
    "Order ID": order.orderNumber,
    Status: order.status,
    Customer: order.customerName,
    Phone: order.phone,
    "Total ₹": inr(order.total),
    "Payment status": order.paymentStatus,
    "Payment ref": order.payment?.reference ?? "",
    "UPI ID": extra["UPI ID"] ?? order.payment?.upiUri ?? "",
    Method: order.paymentMethod,
    Notes: [order.payment?.gateway ? `via ${order.payment.gateway}` : "", ...Object.values(extra)]
      .filter(Boolean)
      .join(" · "),
  };
}

/**
 * `Order Items` tab ki rows — ek order ka har item alag row (packing slip, invoice
 * aur owner ke hisaab ke liye). Colour/size/price/link sab yahan aata hai.
 */
export function orderItemRows(order: Order): Record<string, string | number>[] {
  return order.items.map((item) => ({
    "Order ID": order.orderNumber,
    "Date & Time": order.createdAt || new Date().toISOString(),
    Product: item.title,
    Handle: item.handle,
    Colour: item.colour ?? "",
    Size: item.size,
    Qty: item.quantity,
    "Price ₹": inr(item.price),
    "Line total ₹": inr(item.price * item.quantity),
    "Product link": item.handle ? `${siteConfig.url}/products/${item.handle}` : "",
    Image: item.image ?? "",
    "Order status": order.status,
  }));
}

/** `Enquiries` tab ki row — WhatsApp order/enquiry ka poora detail. */
export type EnquirySheetItem = {
  title: string;
  handle: string;
  colour?: string | null;
  size?: string | null;
  quantity: number;
  price: number;
};

export type EnquirySheetInput = {
  id: string;
  createdAt: string;
  type: string;
  customer?: string | null;
  phone?: string | null;
  items: EnquirySheetItem[];
  total: number;
  note?: string | null;
  source?: string | null;
};

/** Har item ek line: colour · size · qty · line total · product link */
export function enquiryItemsSummary(items: EnquirySheetItem[]): string {
  return items
    .map(
      (item, index) =>
        `${index + 1}) ${item.title}` +
        `${item.colour ? ` · Colour: ${item.colour}` : ""}` +
        ` · Size: ${item.size ?? "-"}` +
        ` · Qty: ${item.quantity}` +
        ` · Rs. ${inr(item.price * item.quantity)}` +
        (item.handle ? ` · ${siteConfig.url}/products/${item.handle}` : ""),
    )
    .join("\n");
}

export function enquirySheetRow(enquiry: EnquirySheetInput): Record<string, string | number> {
  return {
    "Date & Time": enquiry.createdAt,
    "Enquiry ID": enquiry.id,
    Type: enquiry.type,
    Customer: enquiry.customer ?? "",
    Phone: enquiry.phone ?? "",
    Items: enquiryItemsSummary(enquiry.items),
    "Qty total": enquiry.items.reduce((sum, item) => sum + item.quantity, 0),
    "Value ₹": inr(enquiry.total),
    Message: enquiry.note ?? "",
    "Source page": enquiry.source ?? "",
  };
}

/** `Messages` tab (contact form) */
export function messageSheetRow(message: {
  createdAt: string;
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
  replied?: boolean;
  handled?: boolean;
}): Record<string, string> {
  return {
    Timestamp: message.createdAt,
    Name: message.name,
    Email: message.email,
    Phone: message.phone ?? "",
    Subject: message.subject ?? "",
    Message: message.message,
    Status: message.replied ? "replied" : message.handled ? "handled" : "new",
  };
}

/** `Newsletter` tab */
export function newsletterSheetRow(
  email: string,
  at = new Date().toISOString(),
  source = "footer",
): Record<string, string> {
  return { Timestamp: at, Email: email, Source: source };
}
