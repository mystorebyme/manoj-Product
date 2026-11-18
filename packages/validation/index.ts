/**
 * @liksha/validation
 * SINGLE SOURCE OF TRUTH: frontend aur backend dono yahi rules use karte hain.
 * Naya rule chahiye? yahan add karo, dono apps me automatic apply hoga.
 */
import { z } from "zod";

export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9][0-9]{5}$/, "6 digit ka valid Indian pincode daaliye");

export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, "").replace(/^(\+91|91)/, ""))
  .refine((value) => /^[6-9][0-9]{9}$/.test(value), "10 digit ka valid mobile number daaliye");

export const emailSchema = z.string().trim().toLowerCase().email("Valid email daaliye");

/**
 * Quantity limits — ek hi jagah (web cart, API order, admin manual order sab yahi use karte hain).
 *
 *   1. Ek product (ek size/colour)   → max 10
 *   2. Bade size (XL aur usse upar)  → max 30  (bulk / family order)
 *   3. Poore order me total pieces   → max 15  (sirf bade size ka order ho to 30)
 *
 * Owner in numbers ko Google Sheet → Settings (`max_qty_per_item`, `max_qty_bulk`,
 * `max_qty_per_order`) me badal sakta hai; khaali chhodne par yahi default rahenge.
 */
export const QUANTITY_LIMITS = {
  /** ek line (product + size) */
  perItem: 10,
  /** XL, XXL, 3XL … par bulk limit */
  perItemBulk: 30,
  /** poore cart/order me pieces */
  perOrder: 15,
  /** sirf bulk sizes wale order ki total limit */
  perOrderBulk: 30,
} as const;

/** Ye size bulk category me hai? (XL aur usse bade) */
export function isBulkSize(size?: string | null): boolean {
  const clean = String(size).trim().toUpperCase().replace(/\s+/g, " ");
  if (!clean) return false;
  if (/(^|\b)(FREE|ONESIZE|ONE SIZE)\b/.test(clean)) return false;
  return /^(XL|XXL|2XL|3XL|XXXL|4XL|5XL|6XL)\b/.test(clean) || /\b(XL|XXL|2XL|3XL|4XL|5XL)\b/.test(clean);
}

/** Ek line ke liye kitne piece allowed — size ke hisaab se. */
export function lineLimit(size?: string | null, limits: QuantityLimits = QUANTITY_LIMITS): number {
  return isBulkSize(size) ? limits.perItemBulk : limits.perItem;
}

/** Poore order ke liye kitne piece allowed — sirf bulk lines hain to zyada. */
export function orderLimit(
  lines: { size?: string | null }[],
  limits: QuantityLimits = QUANTITY_LIMITS,
): number {
  if (lines.length > 0 && lines.every((line) => isBulkSize(line.size))) return limits.perOrderBulk;
  return limits.perOrder;
}

export type QuantityLimits = {
  perItem: number;
  perItemBulk: number;
  perOrder: number;
  perOrderBulk: number;
};

export type QuantityCheck = { ok: true } | { ok: false; message: string };

/**
 * Cart par limits lagao — ek hi function jo UI aur server dono chalate hain.
 * `requested` us line ki nayi quantity hai.
 */
export function checkLineQuantity(
  lines: { size?: string | null; quantity: number }[],
  index: number,
  requested: number,
  limits: QuantityLimits = QUANTITY_LIMITS,
): QuantityCheck {
  const line = lines[index];
  if (!line) return { ok: false, message: "Ye item cart me nahi mila." };
  if (requested < 1) return { ok: true };
  const limit = lineLimit(line.size, limits);
  if (requested > limit) {
    return {
      ok: false,
      message: `Is size ke liye max ${limit} piece allowed hain. Zyada chahiye to WhatsApp kariye.`,
    };
  }
  const others = lines.reduce((sum, item, i) => (i === index ? sum : sum + item.quantity), 0);
  const cap = orderLimit(
    lines.map((item, i) => (i === index ? { size: item.size, ...item, quantity: requested } : item)),
    limits,
  );
  if (others + requested > cap) {
    return {
      ok: false,
      message: `Ek order me max ${cap} piece allowed hain. Bulk order ke liye WhatsApp kariye.`,
    };
  }
  return { ok: true };
}

/** Order/cart ka poora check — server par order banne se pehle. */
export function checkCartQuantity(
  lines: { size?: string | null; quantity: number }[],
  limits: QuantityLimits = QUANTITY_LIMITS,
): QuantityCheck {
  for (const line of lines) {
    if (line.quantity < 1) return { ok: false, message: "Quantity kam se kam 1 honi chahiye." };
    const limit = lineLimit(line.size, limits);
    if (line.quantity > limit) {
      return {
        ok: false,
        message: `Size ${line.size} ke liye max ${limit} piece allowed hain. Bulk ke liye WhatsApp kariye.`,
      };
    }
  }
  const total = lines.reduce((sum, line) => sum + line.quantity, 0);
  const cap = orderLimit(lines, limits);
  if (total > cap) {
    return {
      ok: false,
      message: `Ek order me max ${cap} piece allowed hain. Bulk order ke liye WhatsApp kariye.`,
    };
  }
  return { ok: true };
}

export const cartLineSchema = z.object({
  handle: z.string().min(1),
  size: z.string().min(1).max(40),
  /** colourway — optional (purane clients bhi kaam karein) */
  colour: z.string().trim().max(40).optional().nullable(),
  quantity: z.number().int().min(1).max(QUANTITY_LIMITS.perItemBulk),
});

export const createOrderSchema = z
  .object({
  customerName: z.string().trim().min(2, "Poora naam daaliye").max(80),
  email: emailSchema,
  phone: phoneSchema,
  address: z.string().trim().min(10, "Poora address daaliye").max(300),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: pincodeSchema,
  notes: z.string().trim().max(500).optional().nullable(),
  couponCode: z.string().trim().toUpperCase().max(24).optional().nullable(),
  paymentMethod: z.enum(["prepaid", "cod"]).default("prepaid"),
  items: z.array(cartLineSchema).min(1, "Cart khaali hai").max(20),
  })
  .superRefine((value, ctx) => {
    // size-wise + order-wise limits (server aur UI dono yahi rule chalate hain)
    const check = checkCartQuantity(value.items.map((item) => ({ size: item.size, quantity: item.quantity })));
    if (!check.ok) {
      ctx.addIssue({ code: "custom", message: check.message, path: ["items"] });
    }
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const orderStatusSchema = z.enum([
  "placed",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
]);

export const updateOrderStatusSchema = z.object({
  status: orderStatusSchema,
  note: z.string().trim().max(200).optional(),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  phone: phoneSchema.optional(),
  subject: z.string().trim().max(80).optional(),
  message: z.string().trim().min(10).max(1500),
});

export const newsletterSchema = z.object({
  email: emailSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6).max(72),
});

/** ek hi jagah se business rules — UI aur API dono yahi call karein */
/**
 * Festive sale (Round 11): final price already ₹499–₹699 hai, isliye koi
 * percentage coupon stack nahi hota — warna customer ka final price badal jaata.
 * Naya offer dena ho to seedha price badlo (scripts/lib/sale-pricing.mjs).
 */
export const COUPONS: Record<string, number> = {};

export const COD_MAX_SUBTOTAL = 350_000; // Rs. 3500 in paise
export const COD_FEE = 5_000; // Rs. 50 in paise
export const FREE_SHIPPING_THRESHOLD = 0;

export function computeDiscount(subtotal: number, couponCode?: string | null): number {
  if (!couponCode) return 0;
  const percent = COUPONS[couponCode.toUpperCase()];
  if (!percent) return 0;
  return Math.round((subtotal * percent) / 100);
}

/** ---------- order status machine (web + api + admin ke liye ek hi truth) ---------- */

export const ORDER_STATUSES = [
  "placed",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;

export type OrderStatusName = (typeof ORDER_STATUSES)[number];

/** kaunse status se kaunse par ja sakte hain — baaki sab invalid */
export const ORDER_TRANSITIONS: Record<OrderStatusName, readonly OrderStatusName[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

export function canTransition(from: OrderStatusName, to: OrderStatusName): boolean {
  if (from === to) return false;
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export const IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ORDER_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Order number: LK- + base36 timestamp (6) + 4 crypto-random chars.
 * 36^4 combinations per millisecond — double click / burst me bhi duplicate nahi.
 */
export function generateOrderNumber(now: number = Date.now()): string {
  const time = now.toString(36).toUpperCase().padStart(6, "0").slice(-6);
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let random = "";
  for (const byte of bytes) random += ORDER_ALPHABET[byte % ORDER_ALPHABET.length];
  return `LK-${time}${random}`;
}

export const ORDER_NUMBER_PATTERN = /^LK-[A-Z0-9]{6,12}$/;

/* ────────────────────────── GST invoice (shared) ──────────────────────────
 * Apparel GST (22 Sep 2025 ke baad): per-piece value Rs. 2,500 tak 5%, usse
 * zyada par 18%. Prices site par inclusive hain, isliye tax ko total se
 * reverse-calculate karte hain — customer se extra kuch nahi liya jaata.
 * Web (invoice page/PDF) aur admin (order view) dono yahi functions use karte hain.
 */

export const GST_APPAREL_THRESHOLD = 250_000; // paise — Rs. 2,500 per piece
export const GST_APPAREL_RATE = 5;
export const GST_APPAREL_RATE_HIGH = 18;
export const GST_SERVICE_RATE = 18; // COD / shipping charges
export const GST_HSN_APPAREL = "6204";

export type TaxSplit = {
  rate: number;
  /** taxable value = total / (1 + rate) */
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
};

/** GST rate jo ek piece ki selling price par lagta hai */
export function apparelGstRate(unitPricePaise: number): number {
  return unitPricePaise <= GST_APPAREL_THRESHOLD ? GST_APPAREL_RATE : GST_APPAREL_RATE_HIGH;
}

/**
 * Tax-inclusive amount ko taxable + GST me todo.
 * @param grossPaise customer ne jo diya (tax included)
 * @param ratePercent 5 | 18
 * @param interState  true -> IGST, false -> CGST + SGST (half-half)
 */
export function splitTax(grossPaise: number, ratePercent: number, interState = false): TaxSplit {
  const gross = Math.max(0, Math.round(grossPaise));
  const taxable = Math.round((gross * 100) / (100 + ratePercent));
  const tax = gross - taxable; // rounding delta tax me daal diya -> taxable + tax === gross
  if (interState) {
    return { rate: ratePercent, taxable, cgst: 0, sgst: 0, igst: tax, tax };
  }
  const cgst = Math.floor(tax / 2);
  return { rate: ratePercent, taxable, cgst, sgst: tax - cgst, igst: 0, tax };
}

/** Financial year label: Apr-Mar -> "2026-27" */
export function financialYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const start = date.getMonth() + 1 >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** Invoice serial: LK/2026-27/0001 (ek baar issue hone par badalta nahi) */
export function invoiceNumber(sequence: number, date: Date = new Date()): string {
  return `LK/${financialYear(date)}/${String(sequence).padStart(4, "0")}`;
}

export const INVOICE_NUMBER_PATTERN = /^LK\/\d{4}-\d{2}\/\d{4}$/;

/** Indian state list — place-of-supply / CGST-SGST vs IGST decide karne ke liye */
export const SELLER_STATE = "Rajasthan";
