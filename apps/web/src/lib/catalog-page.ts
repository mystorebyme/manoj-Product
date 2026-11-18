import type { Product } from "../types/catalog";
import { assetUrl } from "./format";
import { readJson } from "./http-json";
import { filterLocalCatalog, loadLocalCatalog, type LocalCatalogQuery } from "./local-catalog";

/**
 * Ek page products laao — pehle real API, aur agar hosting par API hi na ho
 * (GitHub Pages / Netlify static export) to `catalog-lite.json` se.
 *
 * Ye chhota wrapper pichhle bug ki yaad dilata hai: `readJson()` **poora object**
 * `{data, error}` deta hai, array nahi. Us par seedha `Array.isArray()` lagana
 * hamesha false hota tha, isliye static hosting par "Load more" kabhi kaam nahi karta tha.
 */
export async function fetchCatalogPage(
  query: LocalCatalogQuery,
): Promise<{ data: Product[]; total: number }> {
  const params = new URLSearchParams();
  if (query.handle) params.set("collection", query.handle);
  if (query.sort) params.set("sort", query.sort);
  if (query.price) params.set("price", query.price);
  if (query.q) params.set("q", query.q);
  params.set("offset", String(query.offset ?? 0));
  params.set("limit", String(query.limit ?? 24));

  try {
    const response = await fetch(`/api/products?${params.toString()}`);
    if (!response.ok) throw new Error(`api ${response.status}`);
    const parsed = await readJson<{ data: Product[]; total: number }>(response);
    const payload = parsed.data;
    if (!payload || !Array.isArray(payload.data)) throw new Error(parsed.error ?? "bad payload");
    return { data: payload.data, total: Number(payload.total ?? payload.data.length) };
  } catch (apiError) {
    // API nahi hai (static export) → local catalogue se wahi result banao
    try {
      const all = await loadLocalCatalog(assetUrl);
      const page = filterLocalCatalog(all, query);
      if (!page.data.length && page.total > 0) throw new Error("local page empty");
      return page;
    } catch {
      throw apiError;
    }
  }
}

/** Search page (static hosting) — query param se local results */
export async function fetchCatalogPageLocal(
  query: LocalCatalogQuery,
): Promise<{ data: Product[]; total: number }> {
  const all = await loadLocalCatalog(assetUrl);
  return filterLocalCatalog(all, query);
}
