"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Wishlist — localStorage me (guest browsing ke saath consistent).
 *
 * Sirf handles store hote hain; product ka poora data hamesha catalog se aata hai,
 * isliye price/stock kabhi purana nahi dikhta.
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

const WISHLIST_KEY = "liksha:wishlist:v1";

function read(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setWishlist(read(WISHLIST_KEY));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
    } catch {
      /* ignore */
    }
  }, [wishlist, ready]);

  const toggleWishlist = useCallback((handle: string) => {
    setWishlist((current) =>
      current.includes(handle) ? current.filter((item) => item !== handle) : [handle, ...current],
    );
  }, []);

  const value = useMemo<LibraryValue>(
    () => ({
      wishlist,
      ready,
      isWished: (handle) => wishlist.includes(handle),
      toggleWishlist,
      clearWishlist: () => setWishlist([]),
    }),
    [wishlist, ready, toggleWishlist],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): LibraryValue {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used within a WishlistProvider");
  return context;
}
