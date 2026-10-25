import "server-only";

import {
  GST_HSN_APPAREL,
  GST_SERVICE_RATE,
  SELLER_STATE,
  apparelGstRate,
  splitTax,
} from "@liksha/validation";
import type { Order } from "@liksha/types";

export interface InvoiceLine {
  title: string;
  size: string;
  hsn: string;
  quantity: number;
  unitPrice: number;
  gross: number;
  taxable: number;
  rate: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface InvoiceView {
  seller: {
    name: string;
    address: string;
    gstin: string;
    email: string;
    phone: string;
    state: string;
  };
  buyer: { name: string; address: string; city: string; state: string; pincode: string; phone: string; email: string };
  order: Order;
  number: string;
  issuedAt: string;
  placeOfSupply: string;
  interState: boolean;
  lines: InvoiceLine[];
  shippingLine: InvoiceLine | null;
  totals: { gross: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number };
}

/**
 * Seller details — **live store settings** (Google Sheet `Settings` tab) se.
 * Order: caller ka override → env → default. Na hone par invoice par
 * "GSTIN pending" chhapta hai (koi banaya hua number nahi).
 */
export type SellerOverride = { name?: string; phone?: string; email?: string; gstin?: string };

export function sellerDetails(override: SellerOverride = {}) {
  const phone = String(override.phone ?? process.env.SELLER_PHONE ?? "").trim();
  return {
    name: String(override.name ?? "").trim() || "TRENDS YOUNIQUE",
    address: "Jaipur, Rajasthan 302001, India",
    gstin: String(override.gstin ?? process.env.SELLER_GSTIN ?? "").trim() || "GSTIN pending",
    email: String(override.email ?? process.env.SELLER_EMAIL ?? "").trim() || "care@trendsyounique.com",
    phone: phone ? (phone.startsWith("+") ? phone : `+91 ${phone.replace(/^91/, "")}`) : "",
    state: SELLER_STATE,
  };
}

/**
 * GST invoice banata hai.
 *
 * - Prices inclusive hain, isliye har line ka tax reverse-calculate hota hai.
 * - Coupon discount line-wise proportionally allocate hota hai (GST rules: discount
 *   invoice par dikhna chahiye, warna taxable value galat aati hai).
 * - Shipping/handling service hai -> 18%.
 * - Same state (Rajasthan) = CGST+SGST, warna IGST.
 */
export function buildInvoice(
  order: Order,
  number: string,
  issuedAt: string,
  sellerOverride: SellerOverride = {},
): InvoiceView {
  const seller = sellerDetails(sellerOverride);
  const placeOfSupply = order.state?.trim() || SELLER_STATE;
  const interState = placeOfSupply.toLowerCase() !== SELLER_STATE.toLowerCase();
  const discountRatio = order.subtotal > 0 ? Math.min(order.discount / order.subtotal, 1) : 0;

  const lines: InvoiceLine[] = order.items.map((item) => {
    const gross = item.price * item.quantity;
    const net = Math.round(gross * (1 - discountRatio));
    const rate = apparelGstRate(item.price);
    const split = splitTax(net, rate, interState);
    return {
      title: item.title,
      size: item.size,
      hsn: GST_HSN_APPAREL,
      quantity: item.quantity,
      unitPrice: item.price,
      gross: net,
      taxable: split.taxable,
      rate,
      cgst: split.cgst,
      sgst: split.sgst,
      igst: split.igst,
    };
  });

  let shippingLine: InvoiceLine | null = null;
  if (order.shipping > 0) {
    const split = splitTax(order.shipping, GST_SERVICE_RATE, interState);
    shippingLine = {
      title: "Shipping & handling",
      size: "—",
      hsn: "9968",
      quantity: 1,
      unitPrice: order.shipping,
      gross: order.shipping,
      taxable: split.taxable,
      rate: GST_SERVICE_RATE,
      cgst: split.cgst,
      sgst: split.sgst,
      igst: split.igst,
    };
  }

  const allLines = shippingLine ? [...lines, shippingLine] : lines;
  const totals = allLines.reduce(
    (acc, line) => ({
      gross: acc.gross + line.gross,
      taxable: acc.taxable + line.taxable,
      cgst: acc.cgst + line.cgst,
      sgst: acc.sgst + line.sgst,
      igst: acc.igst + line.igst,
      tax: acc.tax + line.cgst + line.sgst + line.igst,
    }),
    { gross: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 },
  );

  return {
    seller,
    buyer: {
      name: order.customerName,
      address: order.address,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
      phone: order.phone,
      email: order.email,
    },
    order,
    number,
    issuedAt,
    placeOfSupply,
    interState,
    lines,
    shippingLine,
    totals,
  };
}
