/**
 * Store ka UPI VPA — sirf server side env se (owner ka asli id).
 *
 * Pehle `payments.ts` me `process.env.STORE_UPI_ID ?? "trendsyounique@upi"` tha:
 * env set na ho to customer ko ek **banaya hua** VPA dikhta tha aur paisa kahin
 * nahi jaata. Ab khaali/galat id par UPI card hi nahi khulta.
 *
 * Alag file isliye ki ye test se import ho sake (`payments.ts` me `server-only` hai).
 */

const PLACEHOLDER = "trendsyounique@upi";

export function storeUpiId(): string {
  const raw = (process.env.STORE_UPI_ID ?? "").trim();
  // UPI VPA shape: kuch@handle
  if (!/^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9]{1,32}$/.test(raw)) return "";
  if (raw.toLowerCase() === PLACEHOLDER) return "";
  return raw;
}

export function storeUpiName(): string {
  return (process.env.STORE_UPI_NAME ?? "").trim() || "TRENDS YOUNIQUE";
}

/** `upi://pay` intent — id na ho to `null` (caller UPI card chhupa de) */
export function manualUpiUri(amountPaise: number, orderNumber: string): string | null {
  const vpa = storeUpiId();
  if (!vpa) return null;
  const params = new URLSearchParams({
    pa: vpa,
    pn: storeUpiName(),
    am: (amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: `Order ${orderNumber}`,
  });
  return `upi://pay?${params.toString()}`;
}
