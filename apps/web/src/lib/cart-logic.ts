import {
  checkLineQuantity,
  orderLimit,
  lineLimit,
  type QuantityLimits,
  QUANTITY_LIMITS,
} from "@liksha/validation";

/**
 * Cart ki saari logic — **pure functions** (koi React, koi storage nahi).
 *
 * Isliye yahan bug pakadna aasan hai: unit test seedha `addToCart` call karke
 * dekh sakta hai ki naya item cart me aata hai ya nahi.
 *
 * ⚠️ Yahan ek bug tha jo live site par "Add to cart karte hi cart khaali" kar raha tha:
 * naya item add karte waqt `checkLineQuantity(lines, lines.length, ...)` call hota tha —
 * us index par koi line hoti hi nahi, isliye function turant
 * `{ ok: false, "Ye item cart me nahi mila." }` return karta tha aur item
 * cart me jaata hi nahi. Ab **pehle candidate cart banate hain, phir usi par
 * validate karte hain** — isliye naya item bhi sahi se add hota hai.
 */

export type CartLine = {
  handle: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  image: string;
  size?: string;
  colour?: string;
  key: string;
  quantity: number;
};

export type CartLineInput = Omit<CartLine, "key" | "size" | "quantity"> & {
  size?: string | null;
  quantity?: number;
};

export type CartResult<T = CartLine[]> = {
  lines: T;
  /** limit lagne par customer ko dikhne wala message */
  notice: string | null;
  /** kuch badla ya nahi */
  changed: boolean;
};

export function cartKey(handle: string, size?: string | null): string {
  return `${handle}::${size || "Free Size"}`;
}

/** naya item sabse upar (customer ko turant dikhe) */
export function addToCart(
  lines: CartLine[],
  input: CartLineInput,
  quantity = 1,
  limits: QuantityLimits = QUANTITY_LIMITS,
): CartResult {
  const size = input.size || "Free Size";
  const key = cartKey(input.handle, size);
  const existing = lines.find((line) => line.key === key);
  const requested = (existing?.quantity ?? 0) + Math.max(1, Math.round(quantity));

  const line: CartLine = {
    handle: input.handle,
    title: input.title,
    price: input.price,
    compareAtPrice: input.compareAtPrice ?? null,
    image: input.image,
    size,
    colour: input.colour?.trim() || undefined,
    key,
    quantity: requested,
  };

  const rest = lines.filter((item) => item.key !== key);
  const candidate = [line, ...rest];

  // candidate ke index 0 par hi naya/updated line hai — usi par limit check
  const check = checkLineQuantity(candidate, 0, requested, limits);
  if (!check.ok) return { lines, notice: check.message, changed: false };
  return { lines: candidate, notice: null, changed: true };
}

export function updateQuantity(
  lines: CartLine[],
  key: string,
  quantity: number,
  limits: QuantityLimits = QUANTITY_LIMITS,
): CartResult {
  const index = lines.findIndex((line) => line.key === key);
  if (index < 0) return { lines, notice: null, changed: false };
  if (quantity <= 0) {
    return { lines: lines.filter((line) => line.key !== key), notice: null, changed: true };
  }
  const check = checkLineQuantity(lines, index, quantity, limits);
  if (!check.ok) return { lines, notice: check.message, changed: false };
  return {
    lines: lines.map((line, i) => (i === index ? { ...line, quantity } : line)),
    notice: null,
    changed: true,
  };
}

export function removeFromCart(lines: CartLine[], key: string): CartResult {
  const next = lines.filter((line) => line.key !== key);
  return { lines: next, notice: null, changed: next.length !== lines.length };
}

/** storage se aayi list ko current state ke saath merge (kabhi kuch na khoye) */
export function mergeCarts(current: CartLine[], stored: CartLine[], limits: QuantityLimits = QUANTITY_LIMITS): CartLine[] {
  if (!current.length) return stored;
  if (!stored.length) return current;
  const byKey = new Map(stored.map((line) => [line.key, line]));
  for (const line of current) {
    const existing = byKey.get(line.key);
    // dono jagah same item ho to zyada quantity rakho (add karne par kami na ho)
    byKey.set(line.key, existing ? { ...existing, quantity: Math.max(existing.quantity, line.quantity) } : line);
  }
  const merged = current.map((line) => byKey.get(line.key) ?? line);
  for (const line of byKey.values()) {
    if (!merged.some((entry) => entry.key === line.key)) merged.push(line);
  }
  // poore order ka cap kabhi cross na ho
  const cap = orderLimit(merged, limits);
  const total = merged.reduce((sum, line) => sum + line.quantity, 0);
  if (total <= cap) return merged;
  let left = cap;
  const trimmed: CartLine[] = [];
  for (const line of merged) {
    const take = Math.min(line.quantity, Math.max(0, left));
    if (take > 0) trimmed.push({ ...line, quantity: take });
    left -= take;
    if (left <= 0) break;
  }
  return trimmed;
}

export function cartTotals(lines: CartLine[]) {
  return {
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.reduce((sum, line) => sum + line.price * line.quantity, 0),
  };
}

export { lineLimit, orderLimit };
