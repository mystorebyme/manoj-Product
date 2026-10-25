"use client";

import { useState } from "react";
import { ProductCard } from "@/components/product-card";
import { fetchCatalogPage } from "@/lib/catalog-page";
import type { Product } from "@/types/catalog";

/**
 * Pehla page server se aata hai (fast paint), baaki products client-side
 * API se load hote hain — isliye 287 products ka HTML ek saath nahi bhejna padta.
 */
export function ProductGridWithMore({
  initial,
  total,
  query = "",
  pageSize = 24,
  columns = 4,
}: {
  initial: Product[];
  total: number;
  query?: string;
  pageSize?: number;
  columns?: 2 | 3 | 4;
}) {
  const [products, setProducts] = useState<Product[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gridClass =
    columns === 2
      ? "grid-cols-2"
      : columns === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(query);
      // static hosting (GitHub Pages / Netlify) par `/api/products` nahi hota —
      // `fetchCatalogPage` khud local `catalog-lite.json` par fallback karta hai.
      const payload = await fetchCatalogPage({
        handle: params.get("collection"),
        sort: params.get("sort"),
        price: params.get("price"),
        q: params.get("q"),
        offset: products.length,
        limit: pageSize,
      });
      setProducts((current) => [...current, ...payload.data]);
    } catch {
      setError("Aur products load nahi hue. Internet check kar ke dobara try kariye.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className={`grid gap-x-2.5 gap-y-7 sm:gap-x-5 ${gridClass}`}>
        {products.map((product) => (
          <ProductCard key={product.handle} product={product} />
        ))}
      </div>

      {products.length < total ? (
        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="border border-[#6f1d2b] px-8 py-3 text-[11px] font-semibold tracking-[.18em] text-[#6f1d2b] uppercase transition hover:bg-[#6f1d2b] hover:text-white disabled:opacity-60"
          >
            {loading ? "Loading…" : "Load more products"}
          </button>
          <p className="text-[10.5px] tracking-[.12em] text-[#a3948a] uppercase">
            Showing {products.length} of {total} products
          </p>
          {error ? <p className="text-[11px] text-[#b3261e]">{error}</p> : null}
        </div>
      ) : total > pageSize ? (
        <p className="mt-8 text-center text-[10.5px] tracking-[.12em] text-[#a3948a] uppercase">
          All {total} products shown
        </p>
      ) : null}
    </div>
  );
}
