/**
 * Address ↔ PIN code verification (state ka mel).
 *
 * Asli India Post data (`public/pincode-map.json`, 19,486 pincodes) se PIN ka
 * sach wala state nikalta hai, phir customer ke chune hue state se milata hai.
 *
 *   PIN 302001 → Rajasthan
 *   customer ne "Kerala" chuna → MISMATCH (galat delivery address)
 *
 * Mismatch ho to order aage nahi badhta, aur poora record owner ki sheet ke
 * `AddressCheck` tab me chala jaata hai — isse owner decide karta hai kaunsa
 * state ya PIN block karna hai (`Settings` tab: `blocked_states`,
 * `blocked_pincodes`). Ye sab admin-side hai, customer ko sirf saaf message
 * dikhta hai.
 */

import { assetUrl } from "@/lib/format";

export type PinTruth = { state: string; district: string };

export type AddressVerdict = {
  /** order aage badh sakta hai? */
  ok: boolean;
  /** pin sach me kis state/district ka hai */
  pinState: string | null;
  district: string | null;
  /** customer ne jo state chuna vs PIN ka state */
  mismatch: boolean;
  /** owner ne block kiya hua? */
  blocked: "state" | "pincode" | null;
  /** customer ko dikhne wala message */
  message: string;
};

type PincodeMap = Record<string, Record<string, string[]>>;

let cache: Promise<PincodeMap> | null = null;

function loadMap(): Promise<PincodeMap> {
  if (!cache) {
    cache = fetch(assetUrl("/pincode-map.json"), { cache: "force-cache" })
      .then((response) => (response.ok ? (response.json() as Promise<PincodeMap>) : {}))
      .catch(() => ({}));
  }
  return cache;
}

/** state ke naam compare karne layak — case, space aur `&`/`and` ka farq nahi */
export function normalizeStateName(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z]/g, "");
}

/** India ke saare state/UT jo pincode data me hain (dropdown ke liye) */
export async function addressStates(): Promise<string[]> {
  const map = await loadMap();
  return Object.keys(map).sort();
}

export async function pinTruth(pincode: string): Promise<PinTruth | null> {
  const pin = String(pincode ?? "").replace(/\D/g, "").slice(0, 6);
  if (!/^[1-9]\d{5}$/.test(pin)) return null;
  const map = await loadMap();
  for (const [state, districts] of Object.entries(map)) {
    for (const [district, pincodes] of Object.entries(districts)) {
      if (pincodes.includes(pin)) return { state, district };
    }
  }
  return null;
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  return String(value ?? "")
    .split(/[,|\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export type DeliveryBlocks = { states?: unknown; pincodes?: unknown };

/** Settings tab ke blocked_states / blocked_pincodes */
export function isBlocked(
  pincode: string,
  state: string,
  blocks: DeliveryBlocks | undefined,
): "state" | "pincode" | null {
  if (!blocks) return null;
  const pin = String(pincode ?? "").replace(/\D/g, "");
  if (list(blocks.pincodes).some((entry) => entry.replace(/\D/g, "") === pin)) return "pincode";
  const wanted = normalizeStateName(state);
  if (wanted && list(blocks.states).some((entry) => normalizeStateName(entry) === wanted)) return "state";
  return null;
}

/**
 * Poora check: PIN asli hai? state match karta hai? owner ne block kiya hai?
 * Sab kuch ek hi jawab me — checkout aur product page dono isi ko use karte hain.
 */
export async function verifyAddress(
  state: string,
  pincode: string,
  blocks?: DeliveryBlocks,
): Promise<AddressVerdict> {
  const pin = String(pincode ?? "").replace(/\D/g, "").slice(0, 6);
  if (!/^[1-9]\d{5}$/.test(pin)) {
    return {
      ok: false,
      pinState: null,
      district: null,
      mismatch: false,
      blocked: null,
      message: "6 digit Indian PIN code daaliye.",
    };
  }

  const truth = await pinTruth(pin);
  if (!truth) {
    return {
      ok: false,
      pinState: null,
      district: null,
      mismatch: false,
      blocked: null,
      message: `PIN ${pin} India Post ke record me nahi hai — dobara check kariye.`,
    };
  }

  const blocked = isBlocked(pin, state, blocks);
  if (blocked === "pincode") {
    return {
      ok: false,
      pinState: truth.state,
      district: truth.district,
      mismatch: false,
      blocked,
      message: `Is PIN code (${pin}) par abhi delivery available nahi hai. WhatsApp par baat kariye.`,
    };
  }
  if (blocked === "state") {
    return {
      ok: false,
      pinState: truth.state,
      district: truth.district,
      mismatch: false,
      blocked,
      message: "Is state me abhi delivery available nahi hai. WhatsApp par baat kariye.",
    };
  }

  if (state && normalizeStateName(state) !== normalizeStateName(truth.state)) {
    return {
      ok: false,
      pinState: truth.state,
      district: truth.district,
      mismatch: true,
      blocked: null,
      message: `PIN ${pin} ${truth.district}, ${truth.state} ka hai — par state "${state}" chuna gaya hai. State "${truth.state}" kariye ya PIN badliye.`,
    };
  }

  return {
    ok: true,
    pinState: truth.state,
    district: truth.district,
    mismatch: false,
    blocked: null,
    message: `Deliverable — ${truth.district}, ${truth.state}.`,
  };
}
