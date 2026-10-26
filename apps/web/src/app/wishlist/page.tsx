"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { productsByHandles } from "@/lib/catalog-lite";
import { ProductCard } from "@/components/product-card";
import { useWishlist } from "@/components/wishlist-provider";
import type { Product } from "@/types/catalog";

/**
 * Wishlist — handles localStorage me, product data `/api/products?handles=…` se
 * (poora 1.2MB catalog client bundle me nahi jaata).
 */
export default function WishlistPage() {
  const { wishlist, ready, clearWishlist } = useWishlist();

  /**
   * Loaded products ke saath unka "key" bhi rakhte hain. Isse `loading` derive ho jaata hai
   * (`key === currentKey`), aur effect me synchronous setState nahi karna padta —
   * pehle `setLoading(true)` / `setItems([])` seedha effect body me the
   * (`react-hooks/set-state-in-effect`).
   */
  const [loaded, setLoaded] = useState<{ key: string; items: Product[] } | null>(null);
  const key = wishlist.join(",");

  useEffect(() => {
    if (!ready || !wishlist.length) return;
    let active = true;
    productsByHandles(wishlist)
      .then((products) => {
        if (active) setLoaded({ key, items: products });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [key, ready, wishlist]);

  const items = loaded?.key === key ? loaded.items : [];
  const loading = Boolean(ready && wishlist.length && loaded?.key !== key);

  return (
    <div className="container-liksha py-9 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium sm:text-[34px]">My wishlist</h1>
          <p className="mt-1 text-[11.5px] tracking-[.12em] text-[#a3948a] uppercase">
            {ready ? `${wishlist.length} ${wishlist.length === 1 ? "piece" : "pieces"} saved` : "Loading…"}
          </p>
        </div>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={clearWishlist}
            className="border border-[#ded1c0] px-4 py-2 text-[10.5px] font-semibold tracking-[.14em] text-[#6f6259] uppercase transition hover:border-[#6f1d2b] hover:text-[#6f1d2b]"
          >
            Clear wishlist
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="mt-10 border border-[#ece1d3] px-6 py-20 text-center">
          <p className="text-sm text-[#6f6259]">
            {ready && !loading ? "Aapki wishlist khaali hai — product card par heart icon dabaiye." : "Loading…"}
          </p>
          <Link
            href="/collections/party-wear-gown"
            className="mt-5 inline-block bg-[#6f1d2b] px-7 py-3 text-[11px] font-semibold tracking-[.16em] text-white uppercase"
          >
            Shop Anarkali suits
          </Link>
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-2 gap-x-2.5 gap-y-7 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((product) => (
            <ProductCard key={product.handle} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
