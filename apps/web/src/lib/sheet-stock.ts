"use client";

/**
 * Size-wise stock — seedha Google Sheet ke `Stock` tab se.
 *
 * Owner `Stock` tab me `Handle | Size | Qty` likhta hai. Jis product/size ki row
 * nahi hai wo **unlimited** maana jaata hai (site purani catalog logic hi dikhati
 * hai) — isliye sheet khaali hone par bhi kuch tootta nahi.
 *
 * Sheet purane version par ho (action support na kare) to chup-chaap `null`
 * milta hai — page par kuch extra nahi dikhta.
 */

import { useEffect, useState } from "react";
import { sheetWebAppUrl } from "./sheet-config";

/** `{ M: 2, L: 0 }` — sirf wahi sizes jinki sheet me row hai */
export type SheetStock = Record<string, number>;

export function useSheetStock(handle: string | undefined): SheetStock | null {
  /**
   * Result ke saath uska handle bhi rakhte hain — `handle` badle to purana stock na dikhe.
   * (Pehle effect ke shuru me `setStock(null)` hota tha, jo cascading render karta hai.)
   */
  const [loaded, setLoaded] = useState<{ handle: string; stock: SheetStock } | null>(null);
  const stock = handle && loaded?.handle === handle ? loaded.stock : null;

  useEffect(() => {
    const base = sheetWebAppUrl();
    if (!base || !handle) return undefined;
    let alive = true;
    const url = `${base}?action=stock&handle=${encodeURIComponent(handle)}`;
    fetch(url, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { ok?: boolean; stock?: Record<string, Record<string, number>> } | null) => {
        if (!alive || !body?.ok || !body.stock) return;
        const entry = body.stock[String(handle).toLowerCase()];
        if (!entry || typeof entry !== "object") return;
        const clean: SheetStock = {};
        for (const [size, qty] of Object.entries(entry)) {
          const value = Number(qty);
          if (Number.isFinite(value)) clean[size.toUpperCase()] = value;
        }
        setLoaded({ handle: String(handle), stock: clean });
      })
      .catch(() => {
        // sheet down / CORS — page normal chalta rahe
      });
    return () => {
      alive = false;
    };
  }, [handle]);

  return stock;
}
