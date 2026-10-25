import test from "node:test";
import assert from "node:assert/strict";
import { manualUpiUri, storeUpiId } from "../../apps/web/src/lib/upi-config";

test("UPI id set na ho to koi banaya hua VPA nahi dikhta", () => {
  const previous = process.env.STORE_UPI_ID;
  delete process.env.STORE_UPI_ID;
  assert.equal(storeUpiId(), "");
  assert.equal(manualUpiUri(49_900, "TY-1"), null);

  // purana placeholder bhi reject
  process.env.STORE_UPI_ID = "trendsyounique@upi";
  assert.equal(storeUpiId(), "");
  assert.equal(manualUpiUri(49_900, "TY-1"), null);

  // galat shape reject
  process.env.STORE_UPI_ID = "not-a-vpa";
  assert.equal(storeUpiId(), "");

  if (previous === undefined) delete process.env.STORE_UPI_ID;
  else process.env.STORE_UPI_ID = previous;
});

test("asli UPI id se intent URI banti hai (amount + note ke saath)", () => {
  const previous = process.env.STORE_UPI_ID;
  process.env.STORE_UPI_ID = "trends.younique@okhdfcbank";
  const uri = manualUpiUri(49_900, "TY-ABC123");
  assert.ok(uri && uri.startsWith("upi://pay?"));
  assert.match(uri!, /pa=trends\.younique%40okhdfcbank/);
  assert.match(uri!, /am=499\.00/);
  assert.match(uri!, /tn=Order\+TY-ABC123/);
  if (previous === undefined) delete process.env.STORE_UPI_ID;
  else process.env.STORE_UPI_ID = previous;
});
