"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  QUANTITY_LIMITS,
  checkLineQuantity,
  lineLimit,
  orderLimit,
  type QuantityLimits,
} from "@liksha/validation";
import { useStoreSettings } from "@/components/store-settings-provider";

export type MiniProduct = {
  handle: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  image: string;
  size?: string;
  colour?: string;
};

export type MiniCartLine = MiniProduct & { key: string; quantity: number };

type CartContextValue = {
  lines: MiniCartLine[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  addItem: (product: MiniProduct, quantity?: number) => void;
  removeLine: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  openCart: () => void;
  closeCart: () => void;
  clear: () => void;
  lastAdded: MiniCartLine | null;
  /** limits ka live result — UI "max 10" dikhata hai */
  limits: QuantityLimits;
  maxForSize: (size?: string | null) => number;
  /** poore cart ki limit (bulk sizes ho to 30 warna 15) */
  maxItems: number;
  /** limit cross hui to customer ko dikhne wala message */
  notice: string | null;
  clearNotice: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "trends:cart:v1";

function readStorage(): MiniCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MiniCartLine[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((line) => line && line.handle && line.quantity > 0);
  } catch {
    return [];
  }
}

/**
 * Cart + quantity limits.
 *
 * Limit ke teen rules `@liksha/validation` me hain (ek hi jagah, server bhi wahi
 * chalata hai) — default: per item 10, XL+ 30, per order 15 (sirf XL+ order ho to 30).
 * Isliye koi bhi client-side bypass server par bhi reject ho jaata hai.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<MiniCartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<MiniCartLine | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // owner Google Sheet → Settings se limits (khaali = shared package ke default)
  const settings = useStoreSettings();
  const limits = useMemo<QuantityLimits>(
    () => ({
      perItem: settings.maxQtyPerItem ?? QUANTITY_LIMITS.perItem,
      perItemBulk: settings.maxQtyBulk ?? QUANTITY_LIMITS.perItemBulk,
      perOrder: settings.maxQtyPerOrder ?? QUANTITY_LIMITS.perOrder,
      perOrderBulk: Math.max(
        settings.maxQtyPerOrder ?? QUANTITY_LIMITS.perOrder,
        settings.maxQtyBulk ?? QUANTITY_LIMITS.perOrderBulk,
      ),
    }),
    [settings.maxQtyPerItem, settings.maxQtyBulk, settings.maxQtyPerOrder],
  );

  useEffect(() => {
    setLines(readStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* ignore quota errors */
    }
  }, [lines, hydrated]);

  // notice khud gayab ho jaye — customer ko hamesha banner nahi dekhna padta
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const addItem = useCallback((product: MiniProduct, quantity = 1) => {
    const size = product.size ?? "Free Size";
    const colour = product.colour?.trim() || undefined;
    const key = `${product.handle}::${size}`;
    const line: MiniCartLine = { ...product, size, colour, key, quantity };

    setLines((current) => {
      const existing = current.find((item) => item.key === key);
      const index = current.findIndex((item) => item.key === key);
      const requested = (existing?.quantity ?? 0) + quantity;

      if (index >= 0) {
        const check = checkLineQuantity(current, index, requested, limits);
        if (!check.ok) {
          setNotice(check.message);
          return current;
        }
        setNotice(null);
        // naya/updated item hamesha list ke UPAR — customer ko turant dikhe
        const rest = current.filter((item) => item.key !== key);
        return [{ ...current[index]!, quantity: requested }, ...rest];
      }

      const check = checkLineQuantity(current, current.length, quantity, limits);
      if (!check.ok) {
        setNotice(check.message);
        return current;
      }
      setNotice(null);
      return [line, ...current];
    });

    setLastAdded(line);
    setIsOpen(true);
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
    setNotice(null);
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setLines((current) => {
      if (quantity <= 0) return current.filter((line) => line.key !== key);
      const index = current.findIndex((line) => line.key === key);
      if (index < 0) return current;
      const check = checkLineQuantity(current, index, quantity, limits);
      if (!check.ok) {
        setNotice(check.message);
        return current;
      }
      setNotice(null);
      return current.map((line) => (line.key === key ? { ...line, quantity } : line));
    });
  }, []);

  const maxForSize = useCallback(
    (size?: string | null) => lineLimit(size ?? "Free Size", limits),
    [limits],
  );

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    return {
      lines,
      count,
      subtotal,
      isOpen,
      addItem,
      removeLine,
      setQuantity,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      clear: () => setLines([]),
      lastAdded,
      limits,
      maxForSize,
      maxItems: orderLimit(lines, limits),
      notice,
      clearNotice: () => setNotice(null),
    };
  }, [lines, isOpen, addItem, removeLine, setQuantity, lastAdded, maxForSize, notice, limits]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
