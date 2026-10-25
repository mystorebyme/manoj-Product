#!/usr/bin/env node
/**
 * GitHub Pages static preview.
 *
 * Pages par Node server nahi chalta, isliye yahan sirf "dekhne layak" static build
 * banti hai: home, collections, product pages, cart/wishlist UI, policies.
 * Server wale hisse (API, order tracking, checkout submission) Render par chalte hain.
 *
 * Script build ke dauraan kuch files temporarily hataata hai aur build ke baad
 * hamesha wapas rakh deta hai (fail ho jaye to bhi).
 */
import fs from "node:fs";
import { writeLiteFiles } from "../build-catalog-lite.mjs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const APP = path.join(ROOT, "apps/web");
const APP_DIR = path.join(APP, "src/app");
const TMP = path.join(ROOT, ".pages-preview-tmp");
const BASE_PATH = process.env.PAGES_BASE_PATH ?? "";

const moved = [];
function moveAway(relative) {
  const from = path.join(APP_DIR, relative);
  if (!fs.existsSync(from)) return;
  const to = path.join(TMP, relative);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  moved.push({ from, to });
}

function restoreAll() {
  for (const { from, to } of moved.reverse()) {
    if (fs.existsSync(to)) {
      fs.mkdirSync(path.dirname(from), { recursive: true });
      fs.renameSync(to, from);
    }
  }
  moved.length = 0;
}

try {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });

  // server-only routes: Pages par nahi chal sakte
  moveAway("api");
  moveAway("orders");

  // search ko static client version se replace karo
  moveAway("search");
  fs.mkdirSync(path.join(APP_DIR, "search"), { recursive: true });
  fs.copyFileSync(
    path.join(ROOT, "scripts/pages/preview-search.tsx"),
    path.join(APP_DIR, "search/page.tsx"),
  );

  /**
   * Static export me `dynamicParams: true` / ISR (`revalidate`) allowed nahi hai
   * (build hi fail ho jaata hai). Server build par ye dono zaroori hain — admin se
   * naya product turant khule aur listing 60s me update ho. Isliye sirf preview
   * build ke dauraan in lines ko literal `false` kar dete hain (baad me restore).
   */
  const patchLiteral = [
    ["export const dynamicParams = true;", "export const dynamicParams = false;"],
    ["  export const revalidate = 60;", "  export const revalidate = false;"],
    ["export const revalidate = 60;", "export const revalidate = false;"],
  ];
  for (const relative of ["products/[handle]/page.tsx", "collections/[handle]/page.tsx"]) {
    const file = path.join(APP_DIR, relative);
    if (!fs.existsSync(file)) continue;
    const original = fs.readFileSync(file, "utf8");
    let patched = original;
    for (const [from, to] of patchLiteral) patched = patched.replaceAll(from, to);
    if (patched !== original) {
      const backup = path.join(TMP, `src-${relative.replaceAll("/", "_")}`);
      fs.writeFileSync(backup, original, "utf8");
      fs.writeFileSync(file, patched, "utf8");
      moved.push({ from: file, to: backup });
    }
  }

  // client-side search + wishlist ke liye chhote indexes (share logic)
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "database/seeds/catalog.json"), "utf8"));
  writeLiteFiles(catalog, path.join(ROOT, "apps/web"));

  execSync("npm run build --workspace @liksha/web", {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      PAGES_PREVIEW: "1",
      PAGES_BASE_PATH: BASE_PATH,
      NEXT_PUBLIC_PAGES_BASE_PATH: BASE_PATH,
      NEXT_PUBLIC_PREVIEW: "1",
    },
  });

  const out = path.join(APP, "out");
  const dist = path.join(ROOT, "dist");
  fs.rmSync(dist, { recursive: true, force: true });
  fs.cpSync(out, dist, { recursive: true });
  // GitHub Pages Jekyll ko bypass kare
  fs.writeFileSync(path.join(dist, ".nojekyll"), "");

  /**
   * Cloudflare Pages ke headers (`_headers`). Next static export `public/` ko
   * copy karta hai, par underscore se shuru hone wali files par bharosa nahi
   * karte — yahan guarantee ke liye dobara likh dete hain.
   */
  const headersFile = path.join(APP, "public/_headers");
  if (fs.existsSync(headersFile)) {
    fs.copyFileSync(headersFile, path.join(dist, "_headers"));
  }
  console.log(`static preview ready: ${dist} (${BASE_PATH || "/"})`);
} finally {
  fs.rmSync(path.join(APP_DIR, "search"), { recursive: true, force: true });
  restoreAll();
  fs.rmSync(path.join(APP, "public/catalog-index.json"), { force: true });
  fs.rmSync(TMP, { recursive: true, force: true });
}
