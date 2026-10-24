import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Order } from "@liksha/types";
import {
  orderItemRows,
  orderSheetRow,
  paymentSheetRow,
} from "../../apps/web/src/lib/sheet-format";

/**
 * **Sheet header contract test.**
 *
 * Apps Script row ko header ke *naam* se cell me daalta hai (`appendRows_`):
 * row object ka key agar sheet header se match na kare to wo column chupchaap
 * khaali reh jaata hai — order sheet me aata hai par customer ka phone/address
 * gum ho jaata hai. Isliye yahan header list seedha `.gs` file se padh kar
 * compare karte hain, taaki code aur sheet kabhi drift na karein.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scriptText = readFileSync(
  path.join(repoRoot, "scripts/google-apps-script/trends-sheets.gs"),
  "utf8",
);

/** `HEADERS` block se ek tab ke columns nikalo */
function headersFor(sheet: string): string[] {
  const start = scriptText.indexOf("var HEADERS");
  assert.ok(start > 0, "HEADERS block mila hi nahi");
  // tab ka block: `Orders: [` … `]`
  const pattern = new RegExp(`(?:'|")?${sheet}(?:'|")?\\s*:\\s*\\[([\\s\\S]*?)\\]`);
  const match = pattern.exec(scriptText.slice(start));
  assert.ok(match, `${sheet} ke headers nahi mile`);
  return [...match[1]!.matchAll(/'([^']+)'/g)].map((entry) => entry[1]!);
}

const order: Order = {
  id: "1",
  orderNumber: "TY-HEADER01",
  createdAt: "2026-10-25T08:30:00.000Z",
  customerName: "Riya Sharma",
  email: "riya@example.com",
  phone: "9876543210",
  address: "B-12, Vaishali Nagar, near Amrapali Circle",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302021",
  notes: "Shaadi ke liye chahiye",
  items: [
    {
      handle: "rose-noir-embroidered-anarkali",
      title: "Rose Noir Embroidered Anarkali",
      image: "/api/uploads/rose-front.jpg",
      colour: "Wine",
      size: "XL",
      quantity: 2,
      price: 349_900,
    },
  ],
  subtotal: 699_800,
  discount: 0,
  shipping: 0,
  total: 699_800,
  couponCode: null,
  paymentMethod: "prepaid",
  paymentStatus: "pending",
  status: "placed",
  payment: { gateway: "manual-upi", reference: null, amount: 699_800, status: "pending", createdAt: "2026-10-25T08:30:00.000Z" },
} as unknown as Order;

test("Orders row me har key sheet ke header par hai (colour, quantity, total, link)", () => {
  const headers = headersFor("Orders");
  const row = orderSheetRow(order, "order.placed");
  for (const key of Object.keys(row)) {
    assert.ok(headers.includes(key), `Orders header me "${key}" nahi hai`);
  }
  assert.equal(row["Order ID"], "TY-HEADER01");
  assert.equal(row["Total ₹"], 6998);
  assert.equal(row["Qty total"], 2);
  assert.equal(row["PIN"], "302021");
  assert.match(String(row.WhatsApp), /^https:\/\/wa\.me\/919876543210$/);
  assert.match(String(row.Items), /Rose Noir Embroidered Anarkali \(Wine \/ XL\) x2/);
});

test("Order Items row me colour, size, qty, price aur product link jaata hai", () => {
  const headers = headersFor("Order Items");
  const rows = orderItemRows(order);
  assert.equal(rows.length, 1);
  for (const key of Object.keys(rows[0]!)) {
    assert.ok(headers.includes(key), `Order Items header me "${key}" nahi hai`);
  }
  assert.equal(rows[0]!["Colour"], "Wine");
  assert.equal(rows[0]!["Size"], "XL");
  assert.equal(rows[0]!["Qty"], 2);
  assert.equal(rows[0]!["Price ₹"], 3499);
  assert.equal(rows[0]!["Line total ₹"], 6998);
  assert.match(String(rows[0]!["Product link"]), /\/products\/rose-noir-embroidered-anarkali$/);
});

test("Payments row ke keys bhi sheet header se match karte hain", () => {
  const headers = headersFor("Payments");
  const row = paymentSheetRow(order, "payment.paid", { "UPI ID": "trendsyounique@upi" });
  for (const key of Object.keys(row)) {
    assert.ok(headers.includes(key), `Payments header me "${key}" nahi hai`);
  }
  assert.equal(row["UPI ID"], "trendsyounique@upi");
  assert.equal(row["Total ₹"], 6998);
});

test("har sheet ke headers me duplicate column nahi", () => {
  for (const sheet of ["Orders", "Order Items", "Products", "Enquiries", "Payments", "Settings", "Messages", "Newsletter"]) {
    const headers = headersFor(sheet);
    assert.ok(headers.length > 0, `${sheet} khaali hai`);
    assert.equal(new Set(headers).size, headers.length, `${sheet} me duplicate column hai`);
  }
});
