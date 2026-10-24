import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Outbox apna alag DATA_DIR use karta hai — dev ka `.data/` chheda nahi jaata. */
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "trends-outbox-"));
process.env.DATA_DIR = tempDir;

import {
  clearOutbox,
  enqueueRows,
  outboxCount,
  outboxRows,
  takeOutboxBatch,
} from "../../apps/web/src/lib/sheet-outbox";

test("fail hui row outbox me queue hoti hai aur count badhta hai", () => {
  clearOutbox();
  assert.equal(outboxCount(), 0);
  enqueueRows([{ sheet: "Orders", row: { "Order ID": "TY-1", "Total ₹": 499 } }]);
  enqueueRows([
    { sheet: "Order Items", row: { "Order ID": "TY-1", Colour: "Wine" } },
    { sheet: "Enquiries", row: { "Enquiry ID": "ENQ-1" } },
  ]);
  assert.equal(outboxCount(), 3);
  assert.equal(outboxRows()[0]?.sheet, "Orders");
  assert.ok(outboxRows()[0]?.at, "queue time save hona chahiye");
});

test("batch purani rows pehle leta hai aur file me baaki chhodta hai", () => {
  clearOutbox();
  for (let index = 0; index < 5; index += 1) {
    enqueueRows([{ sheet: "Orders", row: { "Order ID": `TY-${index}` } }]);
  }
  const batch = takeOutboxBatch(2);
  assert.equal(batch.length, 2);
  assert.equal(batch[0]?.row["Order ID"], "TY-0");
  assert.equal(batch[1]?.row["Order ID"], "TY-1");
  assert.equal(outboxCount(), 3, "bache hue rows file me rehne chahiye");
});

test("take khaali outbox par khali array deta hai (crash nahi)", () => {
  clearOutbox();
  assert.deepEqual(takeOutboxBatch(10), []);
  assert.equal(outboxCount(), 0);
});

test("outbox fail hone par bhi corrupt file se crash nahi hota", () => {
  clearOutbox();
  const file = path.join(tempDir, "sheet-outbox.json");
  fs.writeFileSync(file, "{ not json", "utf8");
  assert.equal(outboxCount(), 0);
  assert.deepEqual(outboxRows(), []);
  enqueueRows([{ sheet: "Orders", row: { "Order ID": "TY-X" } }]);
  assert.equal(outboxCount(), 1, "corrupt file ke baad bhi nayi row save honi chahiye");
});
