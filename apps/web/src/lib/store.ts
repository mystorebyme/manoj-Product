import "server-only";

import type { Catalog, Collection, ColourGroup, ColourOption, Product } from "@liksha/types";
import catalog from "@/data/catalog.json";
import { listAdminProducts, toCatalogProduct } from "./product-db";
import { activeCampaign, withCampaignPricing } from "./campaign";

/**
 * Catalog ek build-time JSON hai (database/seeds/catalog.json se generate hota hai).
 * Isliye har page static render ho sakta hai — koi DB call nahi, TTFB fast.
 *
 * Admin panel se owner jo naye products daalta hai woh `.data/products.json` me
 * rehte hain aur yahan merge ho jaate hain (`liveProducts()`). Isliye naya product
 * add karte hi storefront par dikhta hai — rebuild ki zaroorat nahi.
 */
const data = catalog as unknown as Catalog;

/**
 * Build-time catalogue.
 *
 * Campaign chal raha ho (jaise Diwali 75% off) to price yahin, ek hi jagah par
 * MRP se nikal jaati hai — card, PDP, cart, checkout, invoice aur WhatsApp message
 * sab isi price ko padhte hain, isliye kahin bhi mismatch nahi hota.
 */
export const catalogueProducts: Product[] = data.products.map((product) =>
  withCampaignPricing(product, activeCampaign),
);
export const collections: Collection[] = data.collections;
export const catalogMeta = data.meta;
export const colourGroups: Record<string, ColourGroup> = data.colourGroups ?? {};

/**
 * Admin se aaye products, catalogue ke saath merge — naye product pehle.
 * File mtime cache: har request par disk read nahi hota.
 */
let adminCache: { key: string; products: Product[] } | null = null;

export function adminProducts(): Product[] {
  const records = listAdminProducts({ publishedOnly: true });
  const key = records.map((record) => `${record.handle}:${record.updatedAt}`).join("|");
  if (adminCache && adminCache.key === key) return adminCache.products;
  const products = records.map((record) => withCampaignPricing(toCatalogProduct(record), activeCampaign));
  adminCache = { key, products };
  return products;
}

/** catalogue + owner ke upload kiye products (naya pehle) */
export function liveProducts(): Product[] {
  const extra = adminProducts();
  if (!extra.length) return catalogueProducts;
  return [...extra, ...catalogueProducts.filter((item) => !extra.some((added) => added.handle === item.handle))];
}

export const products: Product[] = liveProducts();

export function isAdminProduct(handle: string): boolean {
  return adminProducts().some((product) => product.handle === handle);
}


/**
 * Ek hi design ke alag colours store par alag products hain — listing par sirf
 * representative card dikhta hai (duplicate cards nahi), PDP par swatch se colour badalta hai.
 */
export function isRepresentative(product: Product): boolean {
  const group = product.colourGroup ? colourGroups[product.colourGroup] : null;
  return !group || group.handle === product.handle;
}

export function listed<T extends Product>(list: T[]): T[] {
  return list.filter(isRepresentative);
}

export function colourGroupFor(product: Product): ColourGroup | null {
  return product.colourGroup ? (colourGroups[product.colourGroup] ?? null) : null;
}

/** PDP ke swatches: is product ka colour pehle, phir baaki */
export function colourOptionsFor(product: Product): ColourOption[] {
  const group = colourGroupFor(product);
  if (!group) return [];
  const own = group.colours.find((option) => option.handle === product.handle);
  return own ? [own, ...group.colours.filter((option) => option.handle !== product.handle)] : group.colours;
}

/** listed products — colour groups ka sirf ek card */
export async function getProducts(): Promise<Product[]> {
  return listed(liveProducts());
}

export async function getProduct(handle: string): Promise<Product | undefined> {
  return liveProducts().find((product) => product.handle === handle);
}

export async function getCollections(): Promise<Collection[]> {
  return [...collections].sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Purane/short URLs jo live store par circulate ho chuke — clean handle par
 * resolve hote hain. Route dono par khulta hai, canonical sirf clean handle.
 */
export const COLLECTION_ALIASES: Record<string, string> = {
  "wedding-collection": "weddin-collection",
};

export function resolveCollectionHandle(handle: string): string {
  return COLLECTION_ALIASES[handle] ?? handle;
}

export async function getCollection(handle: string): Promise<Collection | undefined> {
  const canonical = resolveCollectionHandle(handle);
  return collections.find((collection) => collection.handle === canonical);
}

export async function getProductsByCollection(handle: string, limit?: number): Promise<Product[]> {
  const canonical = resolveCollectionHandle(handle);
  const list = listed(liveProducts().filter((product) => product.collections.includes(canonical)));
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

export async function getFeatured(limit = 8): Promise<Product[]> {
  return listed(liveProducts()).filter((product) => product.featured).slice(0, limit);
}

export async function getLatest(limit = 12): Promise<Product[]> {
  return listed(liveProducts()).slice(0, limit);
}

export async function getRelated(handle: string, limit = 8): Promise<Product[]> {
  const all = liveProducts();
  const current = all.find((product) => product.handle === handle);
  if (!current) return all.slice(0, limit);
  const sameCategory = listed(all).filter(
    (product) => product.handle !== handle && product.category === current.category,
  );
  const sameColor = sameCategory.filter((product) => product.color === current.color);
  return [...sameColor, ...sameCategory.filter((p) => !sameColor.includes(p))].slice(0, limit);
}

export function searchProducts(term: string, limit = 8) {
  const query = term.trim().toLowerCase();
  if (query.length < 2) return [];
  return listed(liveProducts())
    .filter((product) => {
      const haystack = `${product.title} ${product.color} ${product.fabric} ${product.category}`.toLowerCase();
      return query.split(/\s+/).every((word) => haystack.includes(word));
    })
    .slice(0, limit)
    .map((product) => ({
      handle: product.handle,
      title: product.title,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      images: product.images,
      color: product.color,
      fabric: product.fabric,
    }));
}

/** Search box ke "search suggestions" — curated phrases + live catalog se colours/categories. */
const CURATED_SEARCH_PHRASES = [
  "anarkali suit set",
  "designer anarkali",
  "wedding anarkali",
  "georgette anarkali",
  "silk anarkali",
  "printed suit set",
  "lehenga choli",
  "party wear gown",
  "sharara suit set",
  "saree",
  "sale",
];

let suggestionCache: string[] | null = null;

function allSearchPhrases(): string[] {
  if (suggestionCache) return suggestionCache;
  const colours = new Set<string>();
  const fabrics = new Set<string>();
  const categories = new Set<string>();
  for (const product of listed(liveProducts())) {
    if (product.color && product.color !== "As Shown") colours.add(product.color.toLowerCase());
    if (product.fabric && product.fabric !== "As Shown") fabrics.add(product.fabric.toLowerCase());
    if (product.category) categories.add(product.category.replace(/-/g, " "));
  }
  const collectionTitles = collections
    .filter((collection) => collection.handle !== "saree")
    .map((collection) => collection.title.toLowerCase());
  suggestionCache = Array.from(
    new Set([
      ...CURATED_SEARCH_PHRASES,
      ...collectionTitles,
      ...Array.from(colours).map((colour) => `${colour} anarkali`),
      ...Array.from(fabrics).map((fabric) => `${fabric} suit set`),
      ...Array.from(categories),
    ]),
  );
  return suggestionCache;
}

/** Typeahead terms — "ana" par "anarkali suit set", "anarkali suit set georgette" etc. */
export function searchSuggestions(term: string, limit = 6): string[] {
  const query = term.trim().toLowerCase();
  if (query.length < 2) return [];
  const words = query.split(/\s+/).filter(Boolean);
  return allSearchPhrases()
    .filter((phrase) => words.every((word) => phrase.includes(word)))
    .filter((phrase) => phrase !== query)
    .sort((a, b) => a.length - b.length)
    .slice(0, limit);
}

/** Search page ke liye "recommended" picks — trending pehle, phir TRENDS YOUNIQUE ka stylist pick. */
export function recommendedProducts(limit = 8): Product[] {
  const trending = listed(products).filter((product) => product.collections.includes("trending"));
  const picks = listed(products).filter((product) => product.collections.includes("trends-signature"));
  const newest = [...listed(products)].sort((a, b) =>
    String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? "")),
  );
  const merged: Product[] = [];
  for (const product of [...trending, ...picks, ...newest]) {
    if (merged.length >= limit) break;
    if (!merged.some((item) => item.handle === product.handle)) merged.push(product);
  }
  return merged;
}

export const SORT_KEYS = ["featured", "price-low", "price-high", "discount", "new", "title-asc"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export function isSortKey(value: string | undefined): value is SortKey {
  return Boolean(value) && (SORT_KEYS as readonly string[]).includes(value as string);
}

export function sortProducts(list: Product[], key: SortKey = "featured"): Product[] {
  const copy = [...list];
  switch (key) {
    case "price-low":
      return copy.sort((a, b) => a.price - b.price);
    case "price-high":
      return copy.sort((a, b) => b.price - a.price);
    case "discount":
      return copy.sort(
        (a, b) =>
          (b.compareAtPrice ?? b.price) - b.price - ((a.compareAtPrice ?? a.price) - a.price),
      );
    case "new":
      return copy;
    case "title-asc":
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return copy.sort((a, b) => Number(b.featured) - Number(a.featured));
  }
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  return getRelated(product.handle, limit);
}
