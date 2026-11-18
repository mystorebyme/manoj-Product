"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  QUANTITY_LIMITS,
  lineLimit,
  orderLimit,
  type QuantityLimits,
} from "@liksha/validation";
import { useStoreSettings } from "@/components/store-settings-provider";
import {
  addToCart as addToCartPure,
  cartTotals,
  mergeCarts,
  removeFromCart,
  updateQuantity as updateQuantityPure,
  type CartLine,
} from "@/lib/cart-logic";

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
  /**
   * Do-step remove — pehla click sirf "confirm?" maangta hai, tabhi item hatta hai.
   * Customer ka cart galti se khaali na ho.
   */
  removeLine: (key: string) => void;
  /** jis line par remove ka confirm pending hai */
  pendingRemove: string | null;
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
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  /**
   * Cart ka mirror — side-effect (notice) state updater ke andar set karne ki
   * zaroorat na pade, isliye current lines ref me bhi rakhte hain.
   * `linesRef` hamesha latest `lines` par sync rehta hai.
   */
  const linesRef = useRef<MiniCartLine[]>([]);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

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

  // limits bhi ref me — hydration/storage-sync effect ko latest limits chahiye
  const limitsRef = useRef<QuantityLimits>(limits);
  useEffect(() => {
    limitsRef.current = limits;
  }, [limits]);

  /**
   * Storage se sirf **merge** karte hain (overwrite nahi).
   *
   * Pehle yahan `setLines(readStorage())` tha — agar customer ne page load hote hi
   * "Add to cart" dabaya (ya do tab khule the), to storage ki purani list us naye
   * item ko mita deti thi. Wahi "cart me add hua par remove ho gaya" wala bug tha.
   */
  useEffect(() => {
    const stored = readStorage();
    setLines((current) => mergeCarts(current, stored, limitsRef.current));
    setHydrated(true);
  }, []);

  // doosre tab me kuch badla to yahan bhi sync ho jaye
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return;
      const stored = readStorage();
      if (!stored.length) return; // khaali event se cart na ude
      setLines((current) => mergeCarts(current, stored, limitsRef.current));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // remove-confirm 4s me khud reset
  useEffect(() => {
    if (!pendingRemove) return;
    const timer = setTimeout(() => setPendingRemove(null), 4000);
    return () => clearTimeout(timer);
  }, [pendingRemove]);

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

  const addItem = useCallback(
    (product: MiniProduct, quantity = 1) => {
      // pure helper — naya item, quantity badhana, limit sab wahin handle hota hai
      const result = addToCartPure(linesRef.current as CartLine[], product, quantity, limits);
      if (result.changed) {
        linesRef.current = result.lines as MiniCartLine[];
        setLines(result.lines as MiniCartLine[]);
      }
      setNotice(result.notice);
      if (result.changed) {
        setLastAdded({ ...product, size: product.size ?? "Free Size", key: result.lines[0]!.key, quantity });
        setIsOpen(true);
      }
    },
    [limits],
  );

  const removeLine = useCallback((key: string) => {
    // pehla click: sirf confirm maango (galti se item delete na ho)
    if (pendingRemove !== key) {
      setPendingRemove(key);
      return;
    }
    setPendingRemove(null);
    const result = removeFromCart(linesRef.current as CartLine[], key);
    linesRef.current = result.lines as MiniCartLine[];
    setLines(result.lines as MiniCartLine[]);
    setNotice(null);
  }, [pendingRemove]);

  const setQuantity = useCallback(
    (key: string, quantity: number) => {
      const result = updateQuantityPure(linesRef.current as CartLine[], key, quantity, limits);
      if (result.changed) {
        linesRef.current = result.lines as MiniCartLine[];
        setLines(result.lines as MiniCartLine[]);
      }
      setNotice(result.notice);
    },
    [limits],
  );

  const maxForSize = useCallback(
    (size?: string | null) => lineLimit(size ?? "Free Size", limits),
    [limits],
  );

  const value = useMemo<CartContextValue>(() => {
    const { count, subtotal } = cartTotals(lines as CartLine[]);
    return {
      lines,
      count,
      subtotal,
      isOpen,
      addItem,
      removeLine,
      pendingRemove,
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
  }, [
    lines,
    isOpen,
    addItem,
    removeLine,
    pendingRemove,
    setQuantity,
    lastAdded,
    maxForSize,
    notice,
    limits,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
