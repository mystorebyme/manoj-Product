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

/** email providers ke liye apna URL handler (default: sab 404) */
type FetchAnswer = { status: number; body: unknown };
function freshHarness(mailFetch?: (url: string, opts: Record<string, unknown>) => FetchAnswer | null) {
  const harness = createHarness({
    sheets: ["Settings", "Orders", "Order Items", "Payments", "Reviews", "Order Updates", "Enquiries", "Messages", "Newsletter", "AddressCheck", "Products", "ProductList", "MainImage", "ProductImages", "Stock", "Coupons", "Returns", "Notifications", "AuditLog", "Banners", "FAQs", "Categories", "Read Me"],
    properties: { MASTER_TOKEN: SELFTEST_MASTER_TOKEN },
    fetch: (url: string, opts: Record<string, unknown> = {}) => {
      if (mailFetch && !/products-images\.json|products-sheet\.json|reviews-import\.json/.test(url)) {
        const answer = mailFetch(url, opts);
        return answer ?? { status: 404, body: "" };
      }
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

test("order par asli email jaati hai — placed + shipped, poori detail ke saath", () => {
  const { context, mails, book } = freshHarness();
  context.setup();
  context.writeSettings_({ owner_email: "owner@trendsyounique.test", mail_use_google: "true" });
  context.bustSettingsCache_();

  const placed = context.placeOrder_({
    customer: {
      name: "Riya Sharma",
      phone: "9876543210",
      email: "riya@example.com",
      address: "12, Malviya Nagar, Jaipur",
      city: "Jaipur",
      state: "Rajasthan",
      pin: "302017",
    },
    items: [{ handle: "saniya-s-pink-gown", size: "M", qty: 2 }],
    paymentMethod: "upi",
  });
  assert.equal(placed.ok, true);

  // customer + owner copy
  const toCustomer = mails.find((mail: { to: string }) => mail.to === "riya@example.com");
  assert.ok(toCustomer, "customer ko email nahi gayi");
  assert.match(String(toCustomer.subject), /LK-/);
  assert.match(String(toCustomer.htmlBody), /Aapka order|Order/);
  assert.match(String(toCustomer.htmlBody), /Pink Coloured Party Wear Gown/);
  assert.match(String(toCustomer.htmlBody), /₹1,198|1,198/);
  assert.ok(mails.some((mail: { to: string }) => mail.to === "owner@trendsyounique.test"), "owner copy nahi gayi");

  // queue me 'sent' ho gaya
  const queue = book.getSheetByName("MailQueue")!;
  const head = queue.getRange(1, 1, 1, queue.getLastColumn()).getValues()[0];
  const statuses = queue
    .getRange(2, head.indexOf("Status") + 1, queue.getLastRow() - 1, 1)
    .getValues()
    .flat()
    .map((value: string) => String(value));
  assert.ok(statuses.every((value: string) => value === "sent"), `queue status: ${statuses.join(",")}`);

  // status badla → nayi email
  const before = mails.length;
  context.adminSetOrderStatus_(placed.orderNumber, "shipped", "", true, { courier: "Delhivery", AWB: "AWB999" });
  assert.ok(mails.length > before, "shipped par email nahi gayi");
  const shipped = mails[mails.length - 1];
  assert.match(String(shipped.subject), /ship/i);
  assert.match(String(shipped.htmlBody), /Delhivery/);
  assert.match(String(shipped.htmlBody), /AWB999/);
});

test("mail fail ho to queue 30 baar tak retry karti hai (aur baad me chali jaati hai)", () => {
  const { context, mails, mailState } = freshHarness();
  context.setup();
  context.writeSettings_({ mail_use_google: "true" });
  context.bustSettingsCache_();
  mailState.failAll = true;

  const placed = context.placeOrder_({
    customer: {
      name: "Amit",
      phone: "9812345678",
      email: "amit@example.com",
      address: "House 5, Sector 4, Jaipur",
      city: "Jaipur",
      state: "Rajasthan",
      pin: "302001",
    },
    items: [{ handle: "saniya-s-wine-gown", size: "L", qty: 1 }],
    paymentMethod: "cod",
  });
  assert.equal(placed.ok, true);
  assert.equal(mails.length, 0, "fail hone ke bawajood mail bhej di");

  const stats = context.mailQueueStats_();
  assert.ok(stats.retry >= 1, `retry queue khaali: ${JSON.stringify(stats)}`);

  // ab network theek — queue chalane par mail jaye
  mailState.failAll = false;
  const flushed = context.processMailQueue_(20, true);
  assert.ok(flushed.sent >= 1, "retry ke baad mail nahi gayi");
  assert.ok(mails.length >= 1);
  assert.equal(context.mailQueueStats_().retry, 0);
});

test("email endpoints: mail_queue stats aur mail_test (test mail)", () => {
  const { context, mails } = freshHarness();
  context.setup();
  context.writeSettings_({ owner_email: "owner@trendsyounique.test", mail_use_google: "true" });
  context.bustSettingsCache_();

  const queueBody = JSON.parse(
    context.doGet({ parameter: { action: "mail_queue", token: SELFTEST_MASTER_TOKEN } }).getContent(),
  );
  assert.equal(queueBody.ok, true);
  assert.equal(typeof queueBody.stats.total, "number");

  const testBody = JSON.parse(
    context.doGet({ parameter: { action: "mail_test", to: "check@example.com", token: SELFTEST_MASTER_TOKEN } }).getContent(),
  );
  assert.equal(testBody.ok, true, testBody.message);
  assert.ok(mails.some((mail: { to: string }) => mail.to === "check@example.com"));
});

test("email permission nahi hai to order fail nahi hota, aur owner ko saaf steps milte hain", () => {
  const { context, mails, mailState, book } = freshHarness();
  context.setup();
  context.writeSettings_({ owner_email: "owner@trendsyounique.test", mail_use_google: "true" });
  context.bustSettingsCache_();
  mailState.failAll = true;
  mailState.errorMessage =
    "Exception: You do not have permission to call MailApp.sendEmail. Required permissions: [https://www.googleapis.com/auth/script.send_mail]";

  const placed = context.placeOrder_({
    customer: {
      name: "Neha",
      phone: "9876500011",
      email: "neha@example.com",
      address: "9, Vaishali Nagar, Jaipur",
      city: "Jaipur",
      state: "Rajasthan",
      pin: "302021",
    },
    items: [{ handle: "saniya-s-pink-gown", size: "S", qty: 1 }],
    paymentMethod: "cod",
  });
  assert.equal(placed.ok, true, "permission error par order ruk gaya");
  assert.equal(mails.length, 0);

  // test email se owner ko steps milte hain
  const test = context.sendTestEmail_("owner@trendsyounique.test");
  assert.equal(test.ok, false);
  assert.equal(test.code, "permission");
  assert.match(String(test.message), /authorizeMail/);

  // queue me row retry par hai, gum nahi hui
  const queue = book.getSheetByName("MailQueue")!;
  assert.ok(queue.getLastRow() >= 2, "mail queue me row nahi bani");
  assert.ok(context.mailQueueStats_().retry >= 1);

  // permission mil gayi → retry par bachi mail chali jati hai
  mailState.failAll = false;
  context.processMailQueue_(20, true);
  assert.ok(mails.length >= 1, "permission ke baad mail nahi gayi");
});

/** `EmailKeys` tab me ek provider row set karo (Enabled + key) */
function setProvider(
  book: { getSheetByName: (name: string) => any },
  provider: string,
  values: { enabled?: string; key?: string; key2?: string; key3?: string; from?: string },
  index = 0,
) {
  const tab = book.getSheetByName("EmailKeys");
  const head: string[] = tab.getRange(1, 1, 1, tab.getLastColumn()).getValues()[0];
  const rows: string[][] = tab
    .getRange(2, 1, tab.getLastRow() - 1, head.length)
    .getValues()
    .map((row: string[]) => row.map((cell: unknown) => String(cell ?? "")));
  const matches = rows
    .map((row: string[], i: number) => ({ row, i }))
    .filter((entry: { row: string[] }) => entry.row[head.indexOf("Provider")] === provider);
  const target = matches[index];
  assert.ok(target, `${provider} ka slot nahi mila`);
  const line = target.i + 2;
  tab.getRange(line, head.indexOf("Enabled") + 1).setValue(values.enabled ?? "TRUE");
  tab.getRange(line, head.indexOf("Key") + 1).setValue(values.key ?? "");
  if (values.key2 !== undefined) tab.getRange(line, head.indexOf("Key 2") + 1).setValue(values.key2);
  if (values.key3 !== undefined) tab.getRange(line, head.indexOf("Key 3") + 1).setValue(values.key3);
  if (values.from !== undefined) tab.getRange(line, head.indexOf("From Email") + 1).setValue(values.from);
}

const CUSTOMER = {
  name: "Riya Sharma",
  phone: "9876543210",
  email: "riya@example.com",
  address: "12, Malviya Nagar, Jaipur",
  city: "Jaipur",
  state: "Rajasthan",
  pin: "302017",
};

test("provider chain: Brevo se customer ko mail (apni Gmail ke bina)", () => {
  const calls: { url: string; opts: Record<string, any> }[] = [];
  const { context, book, mails } = freshHarness((url, opts) => {
    calls.push({ url, opts });
    if (url.indexOf("api.brevo.com") >= 0) return { status: 201, body: { messageId: "x" } };
    return null;
  });
  context.setup();
  setProvider(book, "brevo", { key: "xkeysib-test-key", from: "store@trendsyounique.test" });

  const placed = context.placeOrder_({
    customer: CUSTOMER,
    items: [{ handle: "saniya-s-pink-gown", size: "M", qty: 1 }],
    paymentMethod: "upi",
  });
  assert.equal(placed.ok, true);

  const brevo = calls.filter((call) => call.url.indexOf("api.brevo.com") >= 0);
  assert.ok(brevo.length >= 1, "Brevo ko call nahi gayi");
  const payload = JSON.parse(String(brevo[0].opts.payload));
  assert.equal(payload.to[0].email, "riya@example.com", "customer ka email nahi gaya");
  assert.equal(payload.sender.email, "store@trendsyounique.test");
  assert.match(String(payload.htmlContent), /Pink Coloured Party Wear Gown/);
  assert.equal(brevo[0].opts.headers["api-key"], "xkeysib-test-key");
  assert.equal(mails.length, 0, "Google MailApp use hua (nahi hona chahiye)");

  const stats = context.mailQueueStats_();
  assert.equal(stats.sent, 1, `queue: ${JSON.stringify(stats)}`);
});

test("provider chain: ek fail ho to agla provider try hota hai", () => {
  const calls: string[] = [];
  const { context, book } = freshHarness((url) => {
    calls.push(url);
    if (url.indexOf("api.brevo.com") >= 0) return { status: 500, body: "brevo down" };
    if (url.indexOf("api.resend.com") >= 0) return { status: 200, body: { id: "ok" } };
    return null;
  });
  context.setup();
  setProvider(book, "brevo", { key: "xkeysib-bad", from: "store@trendsyounique.test" });
  setProvider(book, "resend", { key: "re_test", from: "store@trendsyounique.test" });

  const sent = context.sendMailNow_("riya@example.com", "Test", "hello", "<p>hello</p>");
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(sent.provider, "resend");
  assert.ok(calls.some((url) => url.indexOf("api.brevo.com") >= 0), "Brevo try nahi hua");
  assert.ok(calls.some((url) => url.indexOf("api.resend.com") >= 0), "Resend try nahi hua");
});

test("provider chain: sab fail ho to queue retry par rehti hai (gum nahi hoti)", () => {
  const { context, book } = freshHarness(() => ({ status: 500, body: "down" }));
  context.setup();
  setProvider(book, "brevo", { key: "k1", from: "store@trendsyounique.test" });
  setProvider(book, "elasticemail", { key: "k2", from: "store@trendsyounique.test" });

  const placed = context.placeOrder_({
    customer: CUSTOMER,
    items: [{ handle: "saniya-s-pink-gown", size: "L", qty: 1 }],
    paymentMethod: "cod",
  });
  assert.equal(placed.ok, true);
  const stats = context.mailQueueStats_();
  assert.ok(stats.retry >= 1, `queue: ${JSON.stringify(stats)}`);
});

test("Web3Forms owner alert — bina apni Gmail diye owner tak mail", () => {
  const calls: { url: string; opts: Record<string, any> }[] = [];
  const { context, book } = freshHarness((url, opts) => {
    calls.push({ url, opts });
    if (url.indexOf("api.web3forms.com") >= 0) return { status: 200, body: { success: true } };
    return null;
  });
  context.setup();
  setProvider(book, "web3forms", { key: "w3f-access-key" });

  const result = context.ownerAlert_("Email fail — test", "Customer ko mail nahi gaya");
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.provider, "web3forms");
  const call = calls.find((entry) => entry.url.indexOf("api.web3forms.com") >= 0)!;
  const payload = JSON.parse(String(call.opts.payload));
  assert.equal(payload.access_key, "w3f-access-key");
  assert.match(String(payload.message), /Customer ko mail nahi gaya/);
});
