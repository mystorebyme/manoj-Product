"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { createLocalStore, useLocalStore } from "@/lib/local-store";
import { useIsClient } from "@/lib/client-env";

/**
 * Wishlist — localStorage me (guest browsing ke saath consistent).
 *
 * Sirf handles store hote hain; product ka poora data hamesha catalog se aata hai,
 * isliye price/stock kabhi purana nahi dikhta.
 *
 * Round 41: localStorage read ab `useSyncExternalStore` se hota hai (`lib/local-store.ts`) —
 * pehle `useEffect(() => setWishlist(read()), [])` tha, jo cascading render karta tha aur
 * `react-hooks/set-state-in-effect` warn deta tha. Behaviour same: pehla paint khaali
 * wishlist, hydration ke baad asli list (isliye `ready` flag hai).
 *
 * NOTE: purane template ka "compare products" feature hata diya gaya hai — owner
 * ko sirf wishlist chahiye thi, aur do icon wahi purana clone look de rahe the.
 */

type LibraryValue = {
  wishlist: string[];
  ready: boolean;
  isWished: (handle: string) => boolean;
  toggleWishlist: (handle: string) => void;
  clearWishlist: () => void;
};

const WishlistContext = createContext<LibraryValue | null>(null);

const WISHLIST_KEY = "trends:wishlist:v1";
/** purana (cloned project ka) key — ek baar migrate karke hamesha ke liye hata dete hain */
const LEGACY_WISHLIST_KEY = "liksha:wishlist:v1";

const EMPTY: string[] = [];

/** handles ki list — galat/bojhil data aaye to chhod do */
function parseHandles(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : EMPTY;
}

const wishlistStore = createLocalStore<string[]>({
  key: WISHLIST_KEY,
  legacyKey: LEGACY_WISHLIST_KEY,
  fallback: EMPTY,
  parse: parseHandles,
});

export function WishlistProvider({ children }: { children: ReactNode }) {
  const wishlist = useLocalStore(wishlistStore);
  // server + hydration ke pehle render me list khaali dikhti hai — `ready` se UI ko pata chale
  const ready = useIsClient();

  const isWished = useCallback((handle: string) => wishlist.includes(handle), [wishlist]);

  const toggleWishlist = useCallback((handle: string) => {
    wishlistStore.set((current) =>
      current.includes(handle) ? current.filter((item) => item !== handle) : [handle, ...current],
    );
  }, []);

  const clearWishlist = useCallback(() => wishlistStore.set(EMPTY), []);

  const value = useMemo<LibraryValue>(
    () => ({ wishlist, ready, isWished, toggleWishlist, clearWishlist }),
    [wishlist, ready, isWished, toggleWishlist, clearWishlist],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): LibraryValue {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used within a WishlistProvider");
  return context;
}
