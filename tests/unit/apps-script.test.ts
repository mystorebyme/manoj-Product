import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error — test helper plain .mjs hai
import { createHarness, seedProductList, SELFTEST_MASTER_TOKEN } from "../helpers/apps-script-harness.mjs";

/**
 * **Apps Script ka asli test.**
 *
 * `scripts/google-apps-script/trends-sheets.gs` ko Node me chala kar dekhte hain:
 * setup, self-test (60+ check), aur ek poora order — place → status → timeline →
 * invoice. Isse pata chalta hai ki sheet me paste karne se pehle hi sab chal raha hai.
 */

const PRODUCT_ROWS = [
  ["1001", "saniya-s-pink-gown", "Pink Coloured Party Wear Gown", 599, 1997, "https://cdn.example/pink.jpg", "https://cdn.example/pink.jpg | https://cdn.example/pink-2.jpg", 2, "party-wear-gown", "https://trendsyounique.fashion/products/saniya-s-pink-gown/"],
  ["1002", "saniya-s-wine-gown", "Wine Coloured Party Wear Gown", 699, 1997, "https://cdn.example/wine.jpg", "https://cdn.example/wine.jpg", 1, "party-wear-gown", "https://trendsyounique.fashion/products/saniya-s-wine-gown/"],
];

function freshHarness() {
  const harness = createHarness({
    sheets: ["Settings", "Orders", "Order Items", "Payments", "Reviews", "Order Updates", "Enquiries", "Messages", "Newsletter", "AddressCheck", "Products", "ProductList", "MainImage", "ProductImages", "Stock", "Coupons", "Returns", "Notifications", "AuditLog", "Banners", "FAQs", "Categories", "Read Me"],
    properties: { MASTER_TOKEN: SELFTEST_MASTER_TOKEN },
    fetch: (url: string) => {
      if (/products-images\.json/.test(url)) return { status: 200, body: { rows: [["1001", "saniya-s-pink-gown", "Gown", 1, "https://cdn.example/pink.jpg"]] } };
      if (/products-sheet\.json/.test(url)) return { status: 200, body: { images: { "saniya-s-pink-gown": ["https://cdn.example/pink.jpg"] }, ids: { "saniya-s-pink-gown": "1001" } } };
      if (/reviews-import\.json/.test(url)) return { status: 200, body: { rows: [] } };
      return { status: 404, body: "" };
    },
  });
  seedProductList(harness.book, PRODUCT_ROWS);
  return harness;
}

test("setup() saare tabs aur settings bana deta hai", () => {
  const { context, book } = freshHarness();
  context.setup();
  for (const name of ["Orders", "Order Items", "Payments", "Coupons", "Stock", "Returns", "Notifications", "AuditLog", "Banners", "FAQs", "Categories", "ImagesAll"]) {
    assert.ok(book.getSheetByName(name), `${name} tab nahi bana`);
  }
  const settings = book.getSheetByName("Settings")!;
  const keys = settings.getRange(1, 1, settings.getLastRow(), 1).getValues().flat().map((v: string) => String(v).toLowerCase());
  assert.ok(keys.includes("whatsapp"), "whatsapp setting nahi mili");
  assert.ok(keys.includes("blocked_states"), "blocked_states setting nahi mili");
  const orders = book.getSheetByName("Orders")!;
  assert.equal(orders.getRange(1, 1).getValue(), "Order ID");
});

test("self-test: saare 60+ check pass hote hain", () => {
  const { context } = freshHarness();
  context.setup();
  const report = context.runSelfTests();
  if (!report.ok) {
    const failures = (report.failures ?? []).map((entry: { name: string; detail: string }) => `${entry.name} → ${entry.detail}`);
    assert.fail(`self-test fail:\n${failures.join("\n")}`);
  }
  assert.equal(report.failed, 0);
  assert.ok(report.total >= 60, `check kam hain: ${report.total}`);
});

test("poora order: place → sheet rows → status → timeline → invoice", async () => {
  const { context, book } = freshHarness();
  context.setup();
  context.stockSet_("saniya-s-pink-gown", "M", 3);
  context.couponSave_({ code: "TRENDS10", type: "percent", value: 10, minOrder: 0, active: true });

  const placed = context.placeOrder_({
    customer: {
      name: "Riya Sharma",
      phone: "9876543210",
      address: "12, Malviya Nagar, Near Ganesh Mandir",
      city: "Jaipur",
      state: "Rajasthan",
      pin: "302017",
    },
    items: [{ handle: "saniya-s-pink-gown", colour: "Pink", size: "M", qty: 2 }],
    coupon: "TRENDS10",
    paymentMethod: "upi",
    source: "test",
  });
  assert.equal(placed.ok, true, placed.message);
  assert.match(placed.orderNumber, /^LK-[A-Z0-9]{6}$/);

  // Orders + Order Items + Payments rows
  const orders = book.getSheetByName("Orders")!;
  const ordersHead = orders.getRange(1, 1, 1, orders.getLastColumn()).getValues()[0];
  const orderRow = orders.getRange(2, 1, 1, ordersHead.length).getValues()[0];
  const asObject = Object.fromEntries(ordersHead.map((key: string, index: number) => [key, orderRow[index]]));
  assert.equal(asObject["Order ID"], placed.orderNumber);
  assert.equal(asObject.Status, "placed");
  assert.equal(Number(asObject["Subtotal ₹"]), 1198);
  assert.equal(Number(asObject["Discount ₹"]), 120); // 10% of 1198
  assert.equal(Number(asObject["Total ₹"]), 1078);
  assert.equal(book.getSheetByName("Order Items")!.getLastRow(), 2);
  assert.equal(book.getSheetByName("Payments")!.getLastRow(), 2);

  // stock 3 → 1, coupon used 1
  assert.equal(context.stockOf_("saniya-s-pink-gown", "M"), 1);
  assert.equal(Number(context.couponByCode_("TRENDS10").Used), 1);

  // status badla → timeline + message
  const moved = context.adminSetOrderStatus_(placed.orderNumber, "shipped", "Courier ko de diya", true, {
    courier: "Delhivery",
    awb: "AWB12345",
  });
  assert.equal(moved.ok, true);
  const timeline = context.orderTimeline_(placed.orderNumber, "9876543210");
  assert.equal(timeline.ok, true);
  assert.equal(timeline.order.status, "shipped");
  assert.equal(timeline.order.step, 3);
  assert.equal(timeline.order.courier, "Delhivery");
  assert.ok(timeline.updates.length >= 1, "timeline me update nahi aaya");
  assert.equal(timeline.items.length, 1);
  assert.equal(Number(timeline.items[0].qty), 2);

  // invoice
  const invoice = context.invoiceData_(placed.orderNumber, "9876543210");
  assert.equal(invoice.ok, true);
  const html = context.invoiceHtml_(invoice);
  assert.ok(html.includes("INVOICE"));
  assert.ok(html.includes("Riya Sharma"));

  // galat mobile se timeline band
  const wrongPhone = context.orderTimeline_(placed.orderNumber, "9000000000");
  assert.equal(wrongPhone.ok, false);
});

test("order status GET endpoint site ka shape deta hai", () => {
  const { context } = freshHarness();
  context.setup();
  const placed = context.placeOrder_({
    customer: { name: "Amit", phone: "9812345678", address: "House 5, Sector 4, Jaipur", city: "Jaipur", state: "Rajasthan", pin: "302001" },
    items: [{ handle: "saniya-s-wine-gown", size: "L", qty: 1 }],
    paymentMethod: "cod",
  });
  const body = JSON.parse(context.doGet({ parameter: { action: "order_status", order: placed.orderNumber, phone: "9812345678" } }).getContent());
  assert.equal(body.ok, true);
  assert.equal(body.order.orderNumber, placed.orderNumber);
  assert.equal(body.order.status, "placed");
  assert.ok(Array.isArray(body.steps) && body.steps.length === 5);
  assert.ok(Array.isArray(body.updates));
  assert.ok(Array.isArray(body.items) && body.items.length === 1);
});

test("blocked PIN par order ruk jaata hai (Settings se)", () => {
  const { context } = freshHarness();
  context.setup();
  context.writeSettings_({ blocked_pincodes: "302017", blocked_states: "Kerala" });
  context.bustSettingsCache_();
  const blocked = context.placeOrder_({
    customer: { name: "Riya", phone: "9876543210", address: "12, Malviya Nagar, Jaipur", city: "Jaipur", state: "Rajasthan", pin: "302017" },
    items: [{ handle: "saniya-s-pink-gown", size: "M", qty: 1 }],
    paymentMethod: "cod",
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, "blocked_pincode");

  const blockedState = context.placeOrder_({
    customer: { name: "Riya", phone: "9876543210", address: "12, MG Road, Kochi", city: "Kochi", state: "Kerala", pin: "682001" },
    items: [{ handle: "saniya-s-pink-gown", size: "M", qty: 1 }],
    paymentMethod: "cod",
  });
  assert.equal(blockedState.error, "blocked_state");
});

test("onEditAutoStatus: sheet me status badalne par timeline khud banti hai", () => {
  const { context, book } = freshHarness();
  context.setup();
  const placed = context.placeOrder_({
    customer: { name: "Neha", phone: "9765432109", address: "Plot 9, Vaishali Nagar, Jaipur", city: "Jaipur", state: "Rajasthan", pin: "302021" },
    items: [{ handle: "saniya-s-pink-gown", size: "S", qty: 1 }],
    paymentMethod: "cod",
  });
  const orders = book.getSheetByName("Orders")!;
  const head = orders.getRange(1, 1, 1, orders.getLastColumn()).getValues()[0];
  const statusCol = head.indexOf("Status") + 1;
  assert.ok(statusCol > 0);
  context.onEditAutoStatus({
    range: { getSheet: () => orders, getColumn: () => statusCol, getRow: () => 2, getValue: () => "packed" },
    value: "packed",
  });
  const timeline = context.orderTimeline_(placed.orderNumber);
  assert.equal(timeline.order.status, "packed");
  assert.equal(timeline.order.step, 2);
  assert.ok(timeline.updates.some((update: { status: string }) => update.status === "packed"));
});
