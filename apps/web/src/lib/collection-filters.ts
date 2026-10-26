/**
 * Collection page ke URL filters — `?sort=…&price=…`.
 *
 * Shared link (`/collections/sale?price=under-500`) se aaye filters padhne ke liye.
 * Alag file me hai taaki unit test ho sake aur `collection-browser.tsx` me logic
 * duplicate na ho (static export me `useSearchParams()` ke liye Suspense chahiye hoti hai,
 * isliye URL seedha padhte hain).
 */

export const DEFAULT_SORT = "featured";
export const DEFAULT_PRICE = "all";

export type CollectionFilters = { sort: string; price: string };

/** `"?sort=price-low&price=under-500"` → `{sort, price}`; khaali/galat → defaults */
export function parseCollectionFilters(search: string | null | undefined): CollectionFilters {
  const params = new URLSearchParams(search ?? "");
  const sort = (params.get("sort") ?? "").trim();
  const price = (params.get("price") ?? "").trim();
  return {
    sort: sort || DEFAULT_SORT,
    price: price || DEFAULT_PRICE,
  };
}

/** dono default hain? (tab URL se kuch apply karne ki zaroorat nahi) */
export function isDefaultFilters(filters: CollectionFilters): boolean {
  return filters.sort === DEFAULT_SORT && filters.price === DEFAULT_PRICE;
}

/** URL me wapas likhne ke liye query (`?sort=…&price=…`), default values chhod kar */
export function collectionFiltersQuery(filters: CollectionFilters): string {
  const params = new URLSearchParams();
  if (filters.sort !== DEFAULT_SORT) params.set("sort", filters.sort);
  if (filters.price !== DEFAULT_PRICE) params.set("price", filters.price);
  const query = params.toString();
  return query ? `?${query}` : "";
}
