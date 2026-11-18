import test from "node:test";
import assert from "node:assert/strict";
import {
  cartWhatsAppMessage,
  checkoutWhatsAppMessage,
  productWhatsAppMessage,
  questionWhatsAppMessage,
} from "../../apps/web/src/lib/whatsapp";

/**
 * WhatsApp = dukaan ka order channel. Owner ko message me **poora** detail milna
 * chahiye — warna usse customer se dobara poochhna padta hai.
 */

const items = [
  {
    title: "Rose Noir Embroidered Anarkali",
    handle: "rose-noir-embroidered-anarkali",
    colour: "Wine",
    size: "XL",
    quantity: 2,
    price: 349_900,
  },
  {
    title: "Ivory Chikankari Suit Set",
    handle: "ivory-chikankari-suit-set",
    colour: "Ivory",
    size: "M",
    quantity: 1,
    price: 249_900,
  },
];

test("checkout message me item link, colour, size, qty, price + address sab aata hai", () => {
  const message = checkoutWhatsAppMessage({
    items,
    total: 949_700,
    name: "Riya Sharma",
    phone: "9876543210",
    email: "riya@example.com",
    address: "B-12, Vaishali Nagar, near Amrapali Circle",
    city: "Jaipur",
    state: "Rajasthan",
    pincode: "302021",
    notes: "Shaadi ke liye 30 Oct tak chahiye",
    orderRef: "TY-ABC123",
    origin: "https://trendsyounique.onrender.com",
  });

  for (const expected of [
    "TY-ABC123",
    "Rose Noir Embroidered Anarkali",
    "Colour: Wine",
    "Size: XL · Qty: 2",
    "Rs. 3,499 × 2 = Rs. 6,998",
    "https://trendsyounique.onrender.com/products/rose-noir-embroidered-anarkali",
    "Ivory Chikankari Suit Set",
    "Rs. 9,497",
    "Riya Sharma",
    "9876543210",
    "riya@example.com",
    "B-12, Vaishali Nagar, near Amrapali Circle",
    "Jaipur, Rajasthan, 302021",
    "Shaadi ke liye 30 Oct tak chahiye",
  ]) {
    assert.ok(message.includes(expected), `message me "${expected}" nahi mila`);
  }
  // website par koi online payment nahi — message me UPI/payment line nahi jaani chahiye
  assert.ok(!/upi/i.test(message), "message me UPI mention nahi hona chahiye");
});

test("cart message ke har item ka link aur total aata hai", () => {
  const message = cartWhatsAppMessage(items, "https://trendsyounique.onrender.com");
  assert.match(message, /1\. \*Rose Noir Embroidered Anarkali\*/);
  assert.match(message, /Colour: Wine · Size: XL/);
  assert.match(message, /Qty: 2 × Rs\. 3,499 = Rs\. 6,998/);
  assert.match(message, /\/products\/ivory-chikankari-suit-set/);
  assert.match(message, /Pieces: 3/);
  assert.match(message, /\*Total: Rs\. 9,497\*/);
});

test("product message me colour/size/qty/price aur link", () => {
  const message = productWhatsAppMessage(items[0]!, "https://trendsyounique.onrender.com");
  assert.match(message, /Colour: Wine/);
  assert.match(message, /Size: XL/);
  assert.match(message, /Quantity: 2/);
  assert.match(message, /\/products\/rose-noir-embroidered-anarkali/);
});

test("question message me item ka link hota hai (owner context samajh sake)", () => {
  const message = questionWhatsAppMessage(items[1]!, "https://trendsyounique.onrender.com");
  assert.match(message, /product question/);
  assert.match(message, /Ivory Chikankari Suit Set/);
  assert.match(message, /https:\/\/trendsyounique\.onrender\.com\/products\/ivory-chikankari-suit-set/);
});

test("colour na ho to message me galat 'undefined' nahi aata", () => {
  const message = checkoutWhatsAppMessage({
    items: [{ ...items[0]!, colour: null }],
    total: 349_900,
    name: "Riya",
    phone: "9876543210",
    address: "B-12 Vaishali Nagar",
    city: "Jaipur",
    state: "Rajasthan",
    pincode: "302021",
  });
  assert.ok(!message.includes("undefined"));
  assert.ok(!message.includes("Colour: null"));
});
