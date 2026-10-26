"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUrlSearch } from "@/lib/client-env";
import { collectionFiltersQuery, isDefaultFilters, parseCollectionFilters } from "@/lib/collection-filters";
import { readJson } from "@/lib/http-json";
import { fetchCatalogPage } from "@/lib/catalog-page";
import { CollectionToolbar } from "@/components/collection-toolbar";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/types/catalog";

const PAGE_SIZE = 24;

/**
 * Collection page ka interactive hissa.
 *
 * Page khud static HTML hai (no searchParams): pehle 24 products server se aate hain,
 * sort/price change par sirf grid fetch hota hai — full page reload nahi, URL
 * `replaceState` se sync rehta hai. Isliye PLP ka TTFB CDN edge se aata hai.
 *
 * Round 16 (speed):
 *   • agla page pehle se **prefetch** hota hai (idle me + sentinel ke paas scroll par),
 *     isliye "Load more"/infinite scroll par spinner nahi dikhta.
 *   • GitHub Pages (static export) par `/api/products` hota hi nahi — wahan product
 *     data `/catalog-lite.json` se client-side filter/sort hota hai, warna preview par
 *     "aur products load nahi hue" error aata tha.
 */
export function CollectionBrowser({
  handle,
  initial,
  initialTotal,
  emptyState,
}: {
  handle: string;
  initial: Product[];
  initialTotal: number;
  emptyState?: React.ReactNode;
}) {
  const [items, setItems] = useState<Product[]>(initial);
  const [total, setTotal] = useState(initialTotal);

  /**
   * Shared link (`?sort=price-low&price=under-500`) se aaye filters.
   * Pehle mount effect me `setSort()` / `setPrice()` hote the (sync setState in effect).
   * Ab URL snapshot se **derive** hote hain, aur user ke click par override state jeet ti hai.
   */
  const urlSearch = useUrlSearch();
  const urlFilters = useMemo(() => parseCollectionFilters(urlSearch), [urlSearch]);
  const [chosen, setChosen] = useState<{ sort: string; price: string } | null>(null);
  const sort = chosen?.sort ?? urlFilters.sort;
  const price = chosen?.price ?? urlFilters.price;
  const [loading, setLoading] = useState(false);
  const [appending, setAppending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRender = useRef(true);
  /** neeche tak scroll karte hi agle products khud load ho jaate hain */
  /** prefetched pages: "sort|price|offset" → payload */
  const pages = useRef(new Map<string, { data: Product[]; total: number }>());

  const buildQuery = useCallback(
    (nextSort: string, nextPrice: string) => {
      const params = new URLSearchParams({ collection: handle, sort: nextSort, price: nextPrice, limit: String(PAGE_SIZE) });
      return params.toString();
    },
    [handle],
  );

  /** GitHub Pages / Netlify fallback — static catalogue par wahi filter/sort/pagination */
  const localPage = useCallback(
    async (nextSort: string, nextPrice: string, offset: number) => {
      // 25 Oct ka bug: yahan `readJson()` ka poora object aata hai, array nahi —
      // isliye `Array.isArray()` hamesha false hota tha aur "Load more" har baar fail.
      // Ab logic ek jagah (`lib/catalog-page.ts`) hai aur unit-tested hai.
      return fetchCatalogPage({ handle, sort: nextSort, price: nextPrice, offset, limit: PAGE_SIZE });
    },
    [handle],
  );

  const fetchPage = useCallback(
    async (nextSort: string, nextPrice: string, offset: number) => {
      const key = `${nextSort}|${nextPrice}|${offset}`;
      const cached = pages.current.get(key);
      if (cached) return cached;

      const query = buildQuery(nextSort, nextPrice);
      try {
        const response = await fetch(`/api/products?${query}&offset=${offset}`);
        if (!response.ok) throw new Error("request failed");
        const parsed = await readJson<{ data: Product[]; total: number }>(response);
        if (!parsed.data?.data) throw new Error("request failed");
        pages.current.set(key, parsed.data);
        return parsed.data;
      } catch (apiError) {
        // static export (Pages) par API route nahi hota — local catalogue se serve karo
        try {
          const payload = await localPage(nextSort, nextPrice, offset);
          pages.current.set(key, payload);
          return payload;
        } catch {
          throw apiError;
        }
      }
    },
    [buildQuery, localPage],
  );

  const applyFilters = useCallback(
    async (nextSort: string, nextPrice: string) => {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchPage(nextSort, nextPrice, 0);
        setItems(payload.data);
        setTotal(payload.total);
      } catch {
        setError("Products load nahi hue. Internet check kar ke dobara try kariye.");
      } finally {
        setLoading(false);
      }
    },
    [fetchPage],
  );

  // shared link se aaye filters par pehla grid fetch (state already derived hai)
  useEffect(() => {
    if (!firstRender.current) return;
    firstRender.current = false;
    if (isDefaultFilters(urlFilters)) return;
    // next tick par — effect body me seedha fetch+setState na ho (cascading render)
    const timer = window.setTimeout(() => void applyFilters(urlFilters.sort, urlFilters.price), 0);
    return () => window.clearTimeout(timer);
  }, [applyFilters, urlFilters]);

  const syncUrl = useCallback((nextSort: string, nextPrice: string) => {
    const suffix = collectionFiltersQuery({ sort: nextSort, price: nextPrice });
    window.history.replaceState(null, "", suffix ? suffix : window.location.pathname);
  }, []);

  function handleSort(value: string) {
    setChosen({ sort: value, price });
    syncUrl(value, price);
    void applyFilters(value, price);
  }

  function handlePrice(value: string) {
    setChosen({ sort, price: value });
    syncUrl(sort, value);
    void applyFilters(sort, value);
  }

  async function loadMore() {
    setAppending(true);
    setError(null);
    try {
      const payload = await fetchPage(sort, price, items.length);
      setItems((current) => [...current, ...payload.data]);
      setTotal(payload.total);
      // agle page ki request abhi se — scroll karte hi instantly dikhega
      void fetchPage(sort, price, items.length + payload.data.length).catch(() => undefined);
    } catch {
      setError("Aur products load nahi hue. Dobara try kariye.");
    } finally {
      setAppending(false);
    }
  }

  const hasMore = items.length < total;

  return (
    <div className="container-liksha">
      <CollectionToolbar
        total={total}
        sort={sort}
        priceRange={price}
        loading={loading}
        onSortChange={handleSort}
        onPriceChange={handlePrice}
      />

      <div className="pt-5 pb-12">
        {items.length === 0 ? (
          (emptyState ?? (
            <div className="py-20 text-center">
              <p className="font-display text-[24px] text-[#14100e]">No styles here just yet</p>
              <p className="mx-auto mt-2 max-w-[420px] text-[12.5px] leading-relaxed text-[#6f6259]">
                Try a different filter, or browse the edits our customers are loving right now.
              </p>
            </div>
          ))
        ) : (
          <>
            <div
              className={`grid grid-cols-2 gap-x-2.5 gap-y-7 transition-opacity sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4 ${
                loading ? "opacity-50" : "opacity-100"
              }`}
            >
              {items.map((product) => (
                <ProductCard key={product.handle} product={product} />
              ))}
            </div>

            {error ? <p className="mt-5 text-center text-[12px] text-[#a02020]">{error}</p> : null}

            {hasMore ? (
              /**
               * Sirf button se load — auto (scroll par) loading owner ki request par
               * hata di gayi hai, taaki customer khud decide kare kitne dekhe.
               */
              <div className="mt-10 text-center" data-testid="load-more">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={appending || loading}
                  data-testid="load-more-button"
                  className="border border-[#6f1d2b] px-8 py-3 text-[11px] font-semibold tracking-[.16em] text-[#6f1d2b] uppercase transition hover:bg-[#6f1d2b] hover:text-white disabled:opacity-50"
                >
                  {appending ? "Loading…" : `Load more (${total - items.length} left)`}
                </button>
                <p className="mt-2 text-[10.5px] text-[#a49a90]">
                  {items.length} / {total} styles
                </p>
              </div>
            ) : (
              <p className="mt-10 text-center text-[11px] tracking-[.14em] text-[#a49a90] uppercase">
                All {total} styles loaded
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
