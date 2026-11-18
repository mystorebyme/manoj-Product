import { z } from "zod";
import { saveEnquiry } from "@/lib/enquiries";

export const dynamic = "force-dynamic";

/**
 * WhatsApp enquiry logger.
 *
 * Customer WhatsApp par order bhejta hai — browser `sendBeacon` (ya fetch) se
 * yahan ek chhoti si copy bhej deta hai, taaki owner ke paas chat ke alawa
 * ek structured record (DB + Google Sheet) bhi rahe.
 *
 * Yahaan koi price/stock decide nahi hota — sirf customer ne jo bheja wahi log
 * hota hai. Order ki asli pricing `POST /api/orders` (server) karta hai.
 */

const itemSchema = z.object({
  title: z.string().trim().min(1).max(160),
  handle: z.string().trim().min(1).max(120),
  colour: z.string().trim().max(60).optional().nullable(),
  size: z.string().trim().max(40).optional().nullable(),
  quantity: z.number().int().min(1).max(999),
  price: z.number().int().min(0),
});

const enquirySchema = z.object({
  type: z.enum(["product", "cart", "checkout", "contact"]).default("cart"),
  items: z.array(itemSchema).min(1).max(20),
  total: z.number().int().min(0),
  customer: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(16).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  source: z.string().trim().max(200).optional().nullable(),
});

// bahut zyada spam na ho — per-IP simple throttle (process memory, best-effort)
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

function throttled(key: string): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local";
  if (throttled(ip)) {
    return Response.json({ ok: false, error: "Bahut zyada requests — thodi der baad try kariye." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const parsed = enquirySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  try {
    const enquiry = await saveEnquiry(parsed.data);
    return Response.json({ ok: true, id: enquiry.id }, { status: 201 });
  } catch (error) {
    console.error("[enquiry] save failed", error);
    // enquiry save fail ho to bhi customer ka WhatsApp khulna chahiye — 200 hi dete hain
    return Response.json({ ok: false, error: "save_failed" }, { status: 200 });
  }
}
