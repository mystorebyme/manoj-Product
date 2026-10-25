#!/usr/bin/env node
/**
 * `public/catalog-lite.json` + `public/catalog-index.json` banao — seed catalogue se.
 *
 * Kyun: GitHub Pages build inhe khud banata hai, par **normal `next build`**
 * (Render/Vercel/Docker) nahi banata tha. Wahan purani committed/leftover file
 * chalti rehti thi (galat title, purana price, hataye gaye duplicate products),
 * isliye card par ek price aur product page par doosra price dikh sakta tha.
 *
 * Ab `apps/web` ka `prebuild` yahi script chalata hai — har build par file fresh.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const APP = path.join(ROOT, "apps/web");

export function buildCatalogIndex(catalog) {
  return catalog.products
    .filter((product) => product.images?.length)
    .map((product) => ({
      handle: product.handle,
      title: product.title,
      price: product.price,
      image: `${product.images[0]}?width=400`,
      color: product.color ?? "",
      fabric: product.fabric ?? "",
      category: product.category ?? "",
    }));
}

export function buildCatalogLite(catalog) {
  return catalog.products.map((product) => ({
    handle: product.handle,
    title: product.title,
    price: product.price,
    compareAtPrice: product.compareAtPrice ?? null,
    images: product.images ?? [],
    sizes: product.sizes ?? [],
    sizePricing: product.sizePricing ?? {},
    inStock: product.inStock !== false,
    rating: product.rating ?? 0,
    reviewCount: product.reviewCount ?? 0,
    color: product.color ?? "",
    fabric: product.fabric ?? "",
    category: product.category ?? "anarkali",
    collections: product.collections ?? [],
    description: product.description ?? "",
    // listing ka sort/colour-group dedupe client par — server jaisa hi
    featured: product.featured === true,
    colourGroup: product.colourGroup ?? null,
    colourName: product.colourName ?? null,
  }));
}

export function writeLiteFiles(catalog, appDir = APP) {
  fs.mkdirSync(path.join(appDir, "public"), { recursive: true });
  fs.writeFileSync(path.join(appDir, "public/catalog-index.json"), JSON.stringify(buildCatalogIndex(catalog)));
  fs.writeFileSync(path.join(appDir, "public/catalog-lite.json"), JSON.stringify(buildCatalogLite(catalog)));
}

if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "database/seeds/catalog.json"), "utf8"));
  writeLiteFiles(catalog);
  console.log(`catalog-lite: ${catalog.products.length} products → apps/web/public/`);
}
