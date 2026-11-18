import type { Product } from "../types/catalog";

/**
 * Static hosting (GitHub Pages / Netlify / koi bhi CDN) par `/api/products` hota hi
 * nahi. Wahan "Load more" aur sort/price filter **`/catalog-lite.json`** se chalta
 * hai. Ye file wahi logic ek jagah rakhti hai, taaki:
 *
 *   • collection page, search page aur koi bhi grid same behaviour de,
 *   • server (`/api/products`) ke numbers se match kare,
 *   • aur ye logic test se cover ho (25 Oct ka bug: `readJson()` ka galat use —
 *     `Array.isArray(result)` hamesha false hota tha, isliye Pages par "Load more"
 *     har baar "Aur products load nahi hue" deta tha).
 */

export type LocalCatalogQuery = {
  /** collection handle — `all` / khaali = poora catalogue */
  handle?: string | null;
  sort?: string | null;
  price?: string | null;
  /** free-text search (title + colour + fabric + category) */
  q?: string | null;
  offset?: number;
  limit?: number;
};

const PRICE_FILTERS: Record<string, (product: Product) => boolean> = {
  "under-500": (product) => product.price < 50_000,
  "500-800": (product) => product.price >= 50_000 && product.price < 80_000,
  "800-1200": (product) => product.price >= 80_000 && product.price < 120_000,
  "above-1200": (product) => product.price >= 120_000,
};

/**
 * Ek colour group ka sirf ek card — warna ek hi dress 3 baar dikhti hai.
 *
 * `catalog-lite.json` me build ke waqt `listed` flag aa jaata hai (bilkul wahi
 * faisla jo server leta hai). Us case me dobara group-dedupe nahi karte, warna
 * count ek kam ho jaata hai ("Load more (1 left)" par kuch na aaye).
 */
export function dedupeColourGroups(products: Product[]): Product[] {
  const hasFlag = products.some(
    (product) => typeof (product as Product & { listed?: boolean }).listed === "boolean",
  );
  if (hasFlag) {
    return products.filter((product) => (product as Product & { listed?: boolean }).listed !== false);
  }
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const product of products) {
    const key = (product as Product & { colourGroup?: string | null }).colourGroup ?? product.handle;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(product);
  }
  return out;
}

export function sortLocalProducts(products: Product[], sort: string | null | undefined): Product[] {
  const sorted = [...products];
  switch (sort) {
    case "price-low":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-high":
      return sorted.sort((a, b) => b.price - a.price);
    case "discount":
      return sorted.sort(
        (a, b) =>
          (b.compareAtPrice ?? b.price) - b.price - ((a.compareAtPrice ?? a.price) - a.price),
      );
    case "title-asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "newest":
      return sorted.sort(
        (a, b) =>
          new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime(),
      );
    default:
      // featured pehle, baaki original order (server jaisa hi)
      return sorted.sort(
        (a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)),
      );
  }
}

/** `catalog-lite.json` ke array par wahi filter/sort/pagination jo API karta hai */
export function filterLocalCatalog(
  all: Product[],
  query: LocalCatalogQuery = {},
): { data: Product[]; total: number } {
  const offset = Math.max(0, Math.trunc(query.offset ?? 0) || 0);
  const limit = Math.max(1, Math.trunc(query.limit ?? 24) || 24);

  let list = dedupeColourGroups(all);

  const handle = (query.handle ?? "all").trim();
  if (handle && handle !== "all") {
    list = list.filter((product) => product.collections?.includes(handle));
  }

  const price = (query.price ?? "all").trim();
  const priceFilter = PRICE_FILTERS[price];
  if (priceFilter) list = list.filter(priceFilter);

  const term = (query.q ?? "").trim().toLowerCase();
  if (term) {
    const words = term.split(/\s+/).filter(Boolean);
    list = list.filter((product) => {
      const haystack = `${product.title} ${product.color ?? ""} ${product.fabric ?? ""} ${product.category ?? ""}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  }

  const sorted = sortLocalProducts(list, query.sort);
  return { data: sorted.slice(offset, offset + limit), total: sorted.length };
}

/** Ek hi baar download — sab grids share karte hain */
let cache: Promise<Product[]> | null = null;

/** tests / deploy ke baad cache saaf karna ho to */
export function resetLocalCatalogCache(): void {
  cache = null;
}

export async function loadLocalCatalog(assetUrl: (path: string) => string): Promise<Product[]> {
  if (!cache) {
    cache = (async () => {
      const response = await fetch(assetUrl("/catalog-lite.json"), { cache: "force-cache" });
      if (!response.ok) throw new Error(`catalog ${response.status}`);
      const text = await response.text();
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) throw new Error("catalog parse failed");
      return parsed as Product[];
    })().catch((error: unknown) => {
      cache = null; // agli koshish dobara network se
      throw error;
    });
  }
  return cache;
}
