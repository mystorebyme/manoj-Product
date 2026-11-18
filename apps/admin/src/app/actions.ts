"use server";

import { createAdminOrder } from "@/lib/data";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  checkCredentials,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";
import {
  appendAudit,
  createManualInvoice,
  getDelivery,
  saveDelivery,
  markMessageHandled,
  setMessageReplied,
  saveSettings,
  setOrderNote,
  setOrderTracking,
  reverseOrderPayment,
  updateOrderStatus,
  verifyOrderPayment,
} from "@/lib/data";
import {
  mergedProduct,
  publishCatalog,
  saveCollectionOverride,
  saveProductOverride,
  setProductHidden,
} from "@/lib/catalog-admin";
import { deleteProduct, productSheetRow, saveProduct, toggleProductStatus } from "@liksha/product-store";
import { MAX_IMAGES_PER_PRODUCT, saveUploadedImages } from "@/lib/uploads";
import { upsertProductRow } from "@/lib/sheets";

/** admin form ke size options — stock ke saath */
const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "Free Size"];
import { requireSession } from "@/lib/session";
import type { OrderStatus } from "@liksha/types";

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!checkCredentials(email, password)) {
    return { error: "Email ya password galat hai." };
  }

  const token = createSessionToken(email);
  const store = await cookies();
  const options = sessionCookieOptions();
  // "Keep me signed in" hata dein to browser band hone par session khatam (session cookie)
  const remember = String(formData.get("remember") ?? "on") !== "off";
  store.set(SESSION_COOKIE, token, remember ? options : { ...options, maxAge: undefined });

  appendAudit({ actor: email, action: "auth.login", target: "admin" });
  redirect(next.startsWith("/") ? next : "/");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

/** Website message ko "handled" mark karna (Messages page) */
export async function markMessageHandledAction(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const ok = await markMessageHandled(id, session.email);
  if (ok) appendAudit({ actor: session.email, action: "message.handled", target: id });
  revalidatePath("/messages");
  revalidatePath("/");
}

/** "Replied" toggle — admin inbox me jawab diya hua message mark/undo */
export async function setMessageReplyAction(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const replied = String(formData.get("replied") ?? "") === "true";
  const ok = await setMessageReplied(id, replied, session.email);
  if (ok) appendAudit({ actor: session.email, action: replied ? "message.replied" : "message.unreplied", target: id });
  revalidatePath("/messages");
  revalidatePath("/");
}

export async function updateStockAction(formData: FormData) {
  // middleware ke saath defense-in-depth: action seedha bhi call ho sakta hai
  const session = await requireSession();
  const handle = String(formData.get("handle") ?? "");
  const inStock = formData.get("inStock") === "true";
  const actor = session.email;
  if (!saveProductOverride(handle, { inStock }, actor)) return;
  appendAudit({ actor, action: inStock ? "product.in_stock" : "product.out_of_stock", target: handle });
  revalidatePath("/products");
  revalidatePath("/inventory");
}

export async function updatePriceAction(formData: FormData) {
  const session = await requireSession();
  const handle = String(formData.get("handle") ?? "");
  const rupees = Number(formData.get("price") ?? 0);
  const actor = session.email;
  if (!Number.isFinite(rupees) || rupees <= 0) return;
  if (!saveProductOverride(handle, { price: Math.round(rupees * 100) }, actor)) return;
  appendAudit({ actor, action: "product.price_updated", target: handle, meta: { rupees } });
  revalidatePath("/products");
}

export async function updateTrackingAction(formData: FormData) {
  const session = await requireSession();
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const courier = String(formData.get("courier") ?? "");
  const awb = String(formData.get("awb") ?? "");
  const url = String(formData.get("url") ?? "");
  const actor = session.email;
  const updated = await setOrderTracking(orderNumber, { courier, awb, url }, actor);
  if (updated) {
    appendAudit({ actor, action: "order.tracking_updated", target: orderNumber, meta: { courier, awb } });
  }
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderNumber}`);
}

/** "Abhi kahan atka hai" — customer ko tracking page par ye note dikhta hai. */
export async function setOrderNoteAction(formData: FormData) {
  const session = await requireSession();
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const text = String(formData.get("text") ?? "");
  const actor = session.email;
  const updated = await setOrderNote(orderNumber, text, actor);
  if (updated) {
    appendAudit({ actor, action: "order.note_updated", target: orderNumber, meta: { text } });
  }
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderNumber}`);
}

export async function updateOrderStatusAction(formData: FormData) {
  const session = await requireSession();
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  const note = String(formData.get("note") ?? "") || undefined;
  const actor = session.email;
  const updated = await updateOrderStatus(orderNumber, status, actor, note);
  // invalid transition par kuch nahi likha jaata — UI refresh par purana status hi dikhega
  if (updated) {
    appendAudit({ actor, action: `order.status.${status}`, target: orderNumber, meta: note ? { note } : undefined });
  }
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderNumber}`);
  revalidatePath("/");
}

export async function saveSettingsAction(formData: FormData) {
  const session = await requireSession();
  const actor = session.email;
  await saveSettings({
    announcement: String(formData.get("announcement") ?? ""),
    freeShipping: formData.get("freeShipping") === "on",
    upiId: String(formData.get("upiId") ?? ""),
    upiName: String(formData.get("upiName") ?? ""),
    gstin: String(formData.get("gstin") ?? ""),
    supportPhone: String(formData.get("supportPhone") ?? ""),
    supportEmail: String(formData.get("supportEmail") ?? ""),
    whatsapp: String(formData.get("whatsapp") ?? ""),
    adminUrl: String(formData.get("adminUrl") ?? ""),
    maxQtyPerItem: Number(formData.get("maxQtyPerItem") ?? 10) || 10,
    maxQtyBulk: Number(formData.get("maxQtyBulk") ?? 30) || 30,
    maxQtyPerOrder: Number(formData.get("maxQtyPerOrder") ?? 15) || 15,
  }, actor);
  appendAudit({ actor, action: "settings.updated", target: "store" });
  revalidatePath("/settings");
}

/* ───────────────── product edits -> seed overrides -> publish ───────────────── */

/** Product ka poora edit (title, price, MRP, stock, description, collections, size pricing, images). */
export async function saveProductEditAction(formData: FormData) {
  const session = await requireSession();
  const actor = session.email;
  const handle = String(formData.get("handle") ?? "");
  if (!handle) return;

  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const rupees = (key: string) => {
    const value = Number(formData.get(key) ?? "");
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : undefined;
  };

  const patch: Parameters<typeof saveProductOverride>[1] = {};
  const title = text("title");
  if (title) patch.title = title;

  const price = rupees("price");
  if (price) patch.price = price;

  const compareAt = rupees("compareAtPrice");
  patch.compareAtPrice = compareAt ?? null;

  patch.inStock = formData.get("inStock") === "on";
  patch.featured = formData.get("featured") === "on";

  const description = text("description");
  if (description) patch.description = description;

  const collections = formData.getAll("collections").map((value) => String(value));
  patch.collections = collections;

  // size rows: size_<SIZE> price rupees + avail_<SIZE>
  const sizePricing: Record<string, { price?: number; available?: boolean }> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("size_")) continue;
    const size = key.slice(5).replace(/_/g, " ");
    const sizePrice = Number(value);
    const available = formData.get(`avail_${size.replace(/ /g, "_")}`) === "on";
    sizePricing[size] = {
      ...(Number.isFinite(sizePrice) && sizePrice > 0 ? { price: Math.round(sizePrice * 100) } : {}),
      available,
    };
  }
  if (Object.keys(sizePricing).length) patch.sizePricing = sizePricing;

  saveProductOverride(handle, patch, actor);
  appendAudit({ actor, action: "product.edited", target: handle, meta: { price, collections } });
  revalidatePath("/products");
  revalidatePath(`/products/${handle}`);
}

/**
 * "Main image" chuno — customer ko card aur product page par sabse pehle yahi
 * photo dikhti hai, isliye owner khud decide kare kaunsi photo attract karti hai.
 *
 * Kaam kaise: catalogue me **images ka order** hi main image banata hai
 * (`images[0]`), isliye chuni hui photo ko list me sabse aage le aate hain —
 * baaki photos ka order waise hi rehta hai.
 */
export async function setProductMainImageAction(formData: FormData) {
  const session = await requireSession();
  const handle = String(formData.get("handle") ?? "");
  const image = String(formData.get("image") ?? "").trim();
  if (!handle || !image) return;

  const product = mergedProduct(handle);
  if (!product || !product.images.includes(image)) return;

  const ordered = [image, ...product.images.filter((candidate) => candidate !== image)];
  saveProductOverride(handle, { images: ordered }, session.email);
  appendAudit({
    actor: session.email,
    action: "product.main_image",
    target: handle,
    meta: { image },
  });
  revalidatePath("/products");
  revalidatePath(`/products/${handle}`);
}

/**
 * Ek photo ko aage/peeche khiskao (chhota reorder) — `direction` "up" | "down".
 * Pehli photo hi main image hoti hai, isliye "up" se wo main ban jaati hai.
 */
export async function moveProductImageAction(formData: FormData) {
  const session = await requireSession();
  const handle = String(formData.get("handle") ?? "");
  const image = String(formData.get("image") ?? "").trim();
  const direction = String(formData.get("direction") ?? "up");
  if (!handle || !image) return;

  const product = mergedProduct(handle);
  if (!product) return;
  const images = [...product.images];
  const index = images.indexOf(image);
  if (index < 0) return;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= images.length) return;
  [images[index], images[target]] = [images[target]!, images[index]!];

  saveProductOverride(handle, { images }, session.email);
  appendAudit({
    actor: session.email,
    action: "product.images_reordered",
    target: handle,
    meta: { image, direction },
  });
  revalidatePath("/products");
  revalidatePath(`/products/${handle}`);
}

export async function toggleProductVisibilityAction(formData: FormData) {
  const session = await requireSession();
  const handle = String(formData.get("handle") ?? "");
  const hidden = formData.get("hidden") === "true";
  setProductHidden(handle, hidden, session.email);
  appendAudit({ actor: session.email, action: hidden ? "product.hidden" : "product.visible", target: handle });
  revalidatePath("/products");
}

export async function saveCollectionEditAction(formData: FormData) {
  const session = await requireSession();
  const handle = String(formData.get("handle") ?? "");
  const image = String(formData.get("image") ?? "").trim();
  saveCollectionOverride(handle, {
    title: String(formData.get("title") ?? "").trim() || undefined,
    subtitle: String(formData.get("subtitle") ?? "").trim() || undefined,
    // home ke circle / collection header ki photo (local `/images/…` ya https)
    ...(image ? { image } : {}),
  });
  appendAudit({ actor: session.email, action: "collection.edited", target: handle });
  revalidatePath("/collections");
}

/** Admin ka "Publish" — catalogue rebuild, website turant naya data dikhati hai. */
export async function publishCatalogAction() {
  const session = await requireSession();
  const result = await publishCatalog();
  appendAudit({
    actor: session.email,
    action: result.ok ? "catalog.published" : "catalog.publish_failed",
    target: "website",
    meta: { log: result.log.slice(-600) },
  });
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/collections");
}

/* ───────────────────────── naya product + photos (upload) ───────────────────────── */

/**
 * Product save — admin se photos upload, naam, price, MRP, size + stock, colour.
 *
 * Data `@liksha/product-store` me jaata hai (`.data/products.json`), jise storefront
 * seedha padhta hai — isliye publish/rebuild ka intezaar nahi. Saath hi Google Sheet
 * ke `Products` tab me row upsert hoti hai (owner ke liye readable DB).
 */
export async function createProductAction(formData: FormData) {
  const session = await requireSession();
  const text = (key: string) => String(formData.get(key) ?? "").trim();

  const files = formData.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const { urls, errors } = await saveUploadedImages(files);

  // purane photos bhi rakh sakte hain (edit ke waqt)
  const kept = formData
    .getAll("existingPhoto")
    .map((value) => String(value).trim())
    .filter((value) => value.startsWith("/api/uploads/"));
  const images = [...kept, ...urls].slice(0, MAX_IMAGES_PER_PRODUCT);

  // rupees → paise (blank chhodne par base price hi lagta hai)
  const rupees = (key: string) => {
    const value = Number(text(key));
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0;
  };

  const sizes = SIZES.map((size) => ({
    size,
    stock: Math.max(0, Math.round(Number(text(`stock_${size}`)) || 0)),
    // size-wise pricing — admin yahan XL/XXL ka alag price daal sakta hai
    price: rupees(`price_${size}`) || null,
  })).filter((entry) => formData.get(`size_${entry.size}`) !== null || entry.stock > 0);

  const handle = text("handle");
  const result = saveProduct({
    handle: handle || undefined,
    title: text("title"),
    price: rupees("price"),
    compareAtPrice: rupees("compareAtPrice") || null,
    images,
    colours: text("colours")
      .split(",")
      .map((colour) => colour.trim())
      .filter(Boolean),
    sizes: sizes.length ? sizes : undefined,
    description: text("description"),
    fabric: text("fabric"),
    collection: text("collection") || "new-arrivals",
    category: text("category") || "anarkali",
    status: text("status") === "draft" ? "draft" : "published",
    actor: session.email,
  });

  if (!result.ok) {
    const message = errors.length ? `${result.error} (${errors[0]})` : result.error;
    redirect(`/products/new?error=${encodeURIComponent(message)}`);
  }

  // sheet row (best-effort — panel isliye fail nahi hota)
  const sheetOk = await upsertProductRow(productSheetRow(result.product));

  appendAudit({
    actor: session.email,
    action: "product.saved",
    target: result.product.handle,
    meta: { images: images.length, status: result.product.status, sheet: sheetOk },
  });

  revalidatePath("/products");
  revalidatePath("/");
  redirect(`/products?created=${encodeURIComponent(result.product.handle)}`);
}

/** Product ko draft/live toggle karo (storefront turant badal jaata hai). */
export async function toggleProductStatusAction(formData: FormData) {
  const session = await requireSession();
  const handle = String(formData.get("handle") ?? "").trim();
  if (!handle) return;
  const updated = toggleProductStatus(handle);
  if (updated) {
    await upsertProductRow(productSheetRow(updated));
    appendAudit({
      actor: session.email,
      action: "product.status",
      target: handle,
      meta: { status: updated.status },
    });
  }
  revalidatePath("/products");
  revalidatePath("/");
}

/** Product delete (sirf admin-uploaded products; purana catalogue untouched). */
export async function deleteProductAction(formData: FormData) {
  const session = await requireSession();
  const handle = String(formData.get("handle") ?? "").trim();
  if (!handle) return;
  if (deleteProduct(handle)) {
    appendAudit({ actor: session.email, action: "product.deleted", target: handle, meta: {} });
  }
  revalidatePath("/products");
  revalidatePath("/");
}

/* ───────────────────────── manual order (admin) ───────────────────────── */

export async function createOrderAction(formData: FormData) {
  const session = await requireSession();
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const items = text("handle")
    ? [{ handle: text("handle"), size: text("size"), quantity: Math.max(1, Number(text("quantity")) || 1) }]
    : [];

  const result = await createAdminOrder({
    customerName: text("customerName"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    notes: text("notes") || undefined,
    items,
    markPaid: formData.get("markPaid") === "on",
    reference: text("reference") || undefined,
    actor: session.email,
  });

  if (!result.order) {
    redirect(`/orders/new?error=${encodeURIComponent(result.error ?? "Order create nahi hua")}`);
  }

  appendAudit({
    actor: session.email,
    action: "order.created.manual",
    target: result.order!.orderNumber,
    meta: { total: result.order!.total },
  });
  revalidatePath("/orders");
  revalidatePath("/");
  redirect(`/orders/${encodeURIComponent(result.order!.orderNumber)}`);
}

/* ───────────────────────── manual invoice (admin) ───────────────────────── */

export async function createManualInvoiceAction(formData: FormData) {
  const session = await requireSession();
  const text = (key: string) => String(formData.get(key) ?? "").trim();

  // items: title[] size[] qty[] price[] (blank rows skip)
  const titles = formData.getAll("itemTitle").map(String);
  const sizes = formData.getAll("itemSize").map(String);
  const quantities = formData.getAll("itemQty").map(String);
  const prices = formData.getAll("itemPrice").map(String);

  const items = titles
    .map((title, index) => ({
      title: title.trim(),
      size: (sizes[index] ?? "").trim() || undefined,
      quantity: Math.max(1, Number(quantities[index] ?? 1) || 1),
      price: Math.round((Number(prices[index] ?? 0) || 0) * 100),
    }))
    .filter((item) => item.title && item.price > 0);

  if (!items.length) return;

  const invoice = await createManualInvoice({
    createdBy: session.email,
    customerName: text("customerName") || "Customer",
    phone: text("phone"),
    email: text("email") || undefined,
    address: text("address"),
    city: text("city"),
    state: text("state") || "Rajasthan",
    pincode: text("pincode"),
    items,
    notes: text("notes") || undefined,
    orderRef: text("orderRef") || undefined,
  });
  appendAudit({ actor: session.email, action: "invoice.manual_created", target: invoice.number });
  redirect(`/invoices/${encodeURIComponent(invoice.number)}`);
}

/* ───────────────────────── payments ───────────────────────── */

export async function verifyPaymentAction(formData: FormData) {
  const session = await requireSession();
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const reference = String(formData.get("reference") ?? "").trim();
  const amountRupees = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim();
  if (!orderNumber || !reference) return;
  const updated = await verifyOrderPayment(orderNumber, {
    reference,
    amount: Math.round((Number.isFinite(amountRupees) ? amountRupees : 0) * 100),
    actor: session.email,
    note: note || undefined,
  });
  if (updated) {
    appendAudit({ actor: session.email, action: "payment.verified", target: orderNumber, meta: { reference } });
  }
  revalidatePath("/payments");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderNumber}`);
}

/**
 * Auto-confirm undo — UPI return se paid mark hua order, par bank me paisa nahi
 * aaya. Payment wapas pending + (confirm tha to) order placed.
 */
export async function reversePaymentAction(formData: FormData) {
  const session = await requireSession();
  const orderNumber = String(formData.get("orderNumber") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || "payment not received";
  if (!orderNumber) return;
  const updated = await reverseOrderPayment(orderNumber, { actor: session.email, reason });
  if (updated) {
    appendAudit({ actor: session.email, action: "payment.reversed", target: orderNumber, meta: { reason } });
  }
  revalidatePath("/payments");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderNumber}`);
}

/* ───────────────── delivery (pincode) rules ─────────────────────────────────
 * Source of truth storefront hai. Remote mode me API se save hota hai, isliye
 * admin ka block turant website ke pincode check par lagta hai. */

function parsePinLines(value: string): { pincode: string; note?: string }[] {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [pin, ...rest] = line.split(/[|\-–—,]/);
      return { pincode: String(pin ?? "").replace(/\D/g, "").slice(0, 6), note: rest.join(" ").trim() || undefined };
    })
    .filter((row) => /^[1-9]\d{5}$/.test(row.pincode));
}

export async function saveDeliverySettingsAction(formData: FormData) {
  const session = await requireSession();
  const actor = session.email;

  const current = await getDelivery();
  const settings = current.settings;

  const mode = String(formData.get("stateMode") ?? "all");
  const states: Record<string, boolean> = {};
  const selected = new Set(formData.getAll("states").map((value) => String(value)));
  for (const state of Object.keys(settings.states)) {
    states[state] = selected.has(state);
  }
  for (const state of selected) states[state] = true;

  const blockedText = formData.get("blockedPincodes");
  const allowedText = formData.get("allowedPincodes");

  const next = {
    ...settings,
    allowAllStates: mode === "all",
    states,
    // textarea diya gaya ho tabhi list replace karenge, warna per-row buttons ne jo kiya wahi rahega
    ...(blockedText === null
      ? {}
      : {
          blockedPincodes: parsePinLines(String(blockedText)).map((row) => ({
            ...row,
            at: new Date().toISOString(),
            by: actor,
          })),
        }),
    ...(allowedText === null
      ? {}
      : {
          allowedPincodes: parsePinLines(String(allowedText)).map((row) => ({
            ...row,
            at: new Date().toISOString(),
            by: actor,
          })),
        }),
    deliveryDays: String(formData.get("deliveryDays") ?? settings.deliveryDays).trim() || settings.deliveryDays,
    freeShipping: formData.get("freeShipping") === "on",
  };

  await saveDelivery(next, actor);
  appendAudit({
    actor,
    action: "delivery.settings_updated",
    target: "serviceability",
    meta: {
      allowAllStates: next.allowAllStates,
      blocked: next.blockedPincodes.length,
      allowed: next.allowedPincodes.length,
    },
  });
  revalidatePath("/delivery");
}

export async function togglePinRuleAction(formData: FormData) {
  const session = await requireSession();
  const actor = session.email;
  const pincode = String(formData.get("pincode") ?? "").replace(/\D/g, "").slice(0, 6);
  const list = String(formData.get("list") ?? "blocked"); // blocked | allowed
  const op = String(formData.get("op") ?? "add"); // add | remove
  const note = String(formData.get("note") ?? "").trim() || undefined;
  if (!/^[1-9]\d{5}$/.test(pincode)) return;

  const { settings } = await getDelivery();
  const key = list === "allowed" ? "allowedPincodes" : "blockedPincodes";
  const rows = settings[key].filter((row) => row.pincode !== pincode);
  if (op === "add") rows.push({ pincode, note, at: new Date().toISOString(), by: actor });

  await saveDelivery({ ...settings, [key]: rows }, actor);
  appendAudit({
    actor,
    action: op === "add" ? `delivery.${list}_added` : `delivery.${list}_removed`,
    target: pincode,
    meta: note ? { note } : undefined,
  });
  revalidatePath("/delivery");
}
