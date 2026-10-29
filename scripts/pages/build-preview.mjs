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
/** custom domain (jaise `trendsyounique.fashion`) — Pages artifact me CNAME banti hai */
const CUSTOM_DOMAIN = (process.env.PAGES_CUSTOM_DOMAIN ?? "")
  .trim()
  .replace(/^https?:\/\//, "")
  .replace(/\/+$/, "");
/** site ka public URL — legacy redirects isi par bhejte hain */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
/**
 * Purane base paths (`/manoj-Product`, `/tannu-product`, ...) — jab site project-site
 * path se root domain par shift hui thi, tab ke share/Google links toot gaye the.
 * In sabke liye chhote redirect pages banti hain, taaki purane link bhi kaam karein.
 */
const LEGACY_BASE_PATHS = (process.env.PAGES_LEGACY_BASE_PATHS ?? "")
  .split(",")
  .map((value) => value.trim().replace(/^\/+|\/+$/g, ""))
  .filter(Boolean)
  .filter((value) => `/${value}` !== BASE_PATH.replace(/\/+$/, ""));

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

/** dist ke andar har prerendered page ka URL path (`""` = home) */
function listExportedPages(dist) {
  const pages = [];
  const skip = new Set(["images", "data", "_next", "_headers", ".nojekyll", ...LEGACY_BASE_PATHS]);
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!prefix && skip.has(entry.name)) continue;
        walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      } else if (entry.name === "index.html") {
        pages.push(prefix.replace(/\/$/, ""));
      }
    }
  };
  walk(dist, "");
  return pages;
}

/** chhota HTML redirect page — meta refresh + JS (query/hash bhi preserve) */
function redirectHtml(target) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Redirecting… | TRENDS YOUNIQUE</title>
<link rel="canonical" href="${target}">
<meta name="robots" content="noindex,follow">
<meta http-equiv="refresh" content="0; url=${target}">
<script>location.replace(${JSON.stringify(target)} + location.search + location.hash);</script>
</head>
<body style="font-family:system-ui,sans-serif;padding:24px;text-align:center">
<p>Ye page ab site ke naye address par hai.</p>
<p><a href="${target}">${target}</a></p>
</body>
</html>
`;
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
   * Custom domain ka CNAME. Pages dashboard me domain ek baar set ho gaya hai, par
   * artifact me CNAME hone se workflow se publish hone par bhi domain bana rehta hai.
   * (Bina iske GitHub Pages custom domain hata deta hai / 404 par bhej deta hai.)
   */
  if (CUSTOM_DOMAIN) {
    fs.writeFileSync(path.join(dist, "CNAME"), `${CUSTOM_DOMAIN}\n`);
  }

  /**
   * Purane `/<repo>/...` URLs → root domain. GitHub Pages project-site path par
   * bana har link/index/WhatsApp message ab bhi chalna chahiye; warna traffic
   * 404 par chala jaata hai. Har page ke liye ek chhota redirect file banate hain.
   */
  let legacyStubs = 0;
  if (SITE_URL && LEGACY_BASE_PATHS.length) {
    for (const page of listExportedPages(dist)) {
      const target = page ? `${SITE_URL}/${page}/` : `${SITE_URL}/`;
      for (const legacy of LEGACY_BASE_PATHS) {
        const file = path.join(dist, legacy, ...(page ? page.split("/") : []), "index.html");
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, redirectHtml(target));
        legacyStubs += 1;
      }
    }
    console.log(`legacy redirects: ${legacyStubs} files (${LEGACY_BASE_PATHS.join(", ")} → /)`);
  }


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
