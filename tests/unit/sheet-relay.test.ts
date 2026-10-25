import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { appendUrl, encodePayload, splitBatches } from "../../apps/web/src/lib/sheet-relay";

/**
 * Sheet relay — "data sheet me pahuncha ya nahi" ka guarantee.
 *
 * Owner ka bug: order/contact kuch bhi sheet me nahi aa raha tha. Wajah — relay
 * API jawab ka intezaar karta tha, aur browser POST ka result verifiable nahi
 * tha. Ab GET write (jiska jawab padha ja sakta hai) primary hai + localStorage
 * queue. Ye tests us behaviour ko pin karte hain.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const URL_ = "https://script.google.com/macros/s/TEST/exec";
const TOKEN = "tyw-test-token";

test("encodePayload URL-safe base64 deta hai (koi +, /, = nahi)", () => {
  const encoded = encodePayload({ hello: "नमस्ते ₹ 675°" });
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  const decoded = Buffer.from(encoded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  assert.deepEqual(JSON.parse(decoded), { hello: "नमस्ते ₹ 675°" });
});

test("appendUrl me action, token aur data — teeno hain", () => {
  const url = appendUrl(URL_, TOKEN, [{ sheet: "Messages", row: { Name: "A" } }]);
  assert.ok(url.startsWith(`${URL_}?action=append&token=${TOKEN}&data=`));
  const data = url.split("&data=")[1]!;
  const decoded = JSON.parse(Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  assert.equal(decoded[0].sheet, "Messages");
});

test("appendUrl base URL me pehle se ? ho to & use hota hai", () => {
  assert.ok(appendUrl(`${URL_}?x=1`, TOKEN, []).includes("?x=1&action=append"));
});

test("splitBatches GET ki 8 KB limit ke andar rows bhejta hai", () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({
    sheet: "Order Items",
    row: {
      "Order ID": "TY-ABC123",
      Product: `Product number ${index} with a fairly long descriptive name`,
      Size: "M [38]",
      Colour: "Wine",
      Qty: 1,
      "Price ₹": 675,
    },
  }));
  const batches = splitBatches(rows);
  assert.ok(batches.length > 1, "12 heavy rows ek GET me nahi jaani chahiye");
  assert.equal(batches.flat().length, rows.length, "koi row na khoye");
  for (const batch of batches) {
    assert.ok(encodePayload(batch).length <= 2600, "batch payload 2600 chars se chhota ho");
  }
});

test("contact form sheet relay pehle chalta hai, server ke jawab ka intezaar nahi karta", () => {
  const source = readFileSync("apps/web/src/components/contact-form.tsx", "utf8");
  const relay = source.indexOf("relayMessageToSheet(message)");
  const api = source.indexOf('apiUrl("/api/contact")');
  assert.ok(relay > 0 && api > 0, "dono calls honi chahiye");
  assert.ok(relay < api, "relay API call se pehle hona chahiye (warna API hang = data lost)");
});

test("checkout order row enquiry log se pehle sheet par jaati hai", () => {
  const source = readFileSync("apps/web/src/components/checkout-form.tsx", "utf8");
  const order = source.indexOf("relayOrderToSheet({");
  const enquiry = source.indexOf("logWhatsAppEnquiry({");
  assert.ok(order > 0 && enquiry > 0);
  assert.ok(order < enquiry, "order ki row pehle likho, enquiry baad me");
});

test("har submit ke baad pending queue flush hoti hai (layout boot)", () => {
  const relay = readFileSync("apps/web/src/lib/sheet-relay.ts", "utf8");
  assert.match(relay, /readQueue|QUEUE_KEY/, "localStorage queue honi chahiye");
  const layout = readFileSync("apps/web/src/app/layout.tsx", "utf8");
  assert.ok(layout.includes("SheetQueueBoot"), "layout me boot component mounted ho");
});

test("Apps Script: GET se row likhne ka rasta mojood hai", () => {
  const script = readFileSync("scripts/google-apps-script/trends-sheets.gs", "utf8");
  assert.match(script, /VERSION = '2026-10-25\.r(1[0-9]|2[0-9])'/);
  assert.match(script, /action === 'append'/, "doGet me append action chahiye");
  assert.match(script, /base64DecodeWebSafe/, "GET payload base64url decode ho");
  assert.match(script, /action === 'diag'/, "diagnostics action chahiye");
  // duplicate guard ek hi baar per sheet padha jaaye (bade order par timeout na ho)
  assert.match(script, /seenBySheet\[name\]/);
});

test("Apps Script: master token placeholder ho to reads band rehte hain", () => {
  const script = readFileSync("scripts/google-apps-script/trends-sheets.gs", "utf8");
  assert.match(script, /masterTokenConfigured_\(\)/);
  assert.match(script, /MASTER_PLACEHOLDERS/, "placeholder list honi chahiye");
  assert.match(script, /PropertiesService/, "Script Properties se token badla ja sake");
});

test("relay: bade entry ke saare batches bheje jaate hain (pehla fail ho to bhi)", async () => {
  const source = readFileSync(resolve(root, "apps/web/src/lib/sheet-relay.ts"), "utf8");
  // deliver() me ab early return nahi — warna bade order ka baaki hissa 20s ruka rehta tha
  assert.ok(!/sendViaPixel\(batch\);\s*\n\s*return false;/.test(source), "deliver me early return nahi hona chahiye");
  assert.match(source, /allVerified/);
});

test("relay: 7 din se purani queue entry drop hoti hai (pending count atakta nahi)", () => {
  const source = readFileSync(resolve(root, "apps/web/src/lib/sheet-relay.ts"), "utf8");
  assert.match(source, /MAX_QUEUE_AGE_MS/);
  assert.match(source, /dropStaleEntries/);
});
