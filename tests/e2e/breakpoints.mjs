/**
 * Breakpoint verifier — bina browser ke, served HTML/CSS se.
 *
 *   BASE_URL=http://127.0.0.1:3100 node tests/e2e/breakpoints.mjs
 *
 * Kaise: page ka HTML padh kar har requested viewport ke liye decide karte hain ki
 * kaunsa `<source media="…">` match hoga (browser ka rule "pehla matching source
 * jeetta hai"), aur us asset ka asli pixel size nikalte hain.
 *
 * Hero = teen assets wala `<picture>` (320–767 mobile, 768–1023 tablet, 1024+ desktop).
 * Brand lockup = owner ka ek hi original logo file — har width par wahi file,
 * isliye logo par koi extra download nahi hota (sirf height CSS se badalti hai).
 *
 * Note: sandbox me Chromium available nahi hai (Playwright download blocked),
 * isliye real screenshot-based visual diff yahan nahi hota; ye checks markup +
 * asset dimensions par hain. Manual browser check ke liye: `npm run dev`.
 */
import fs from "node:fs/promises";
import path from "node:path";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3100").replace(/\/$/, "");
const PUBLIC = path.resolve(import.meta.dirname, "../../apps/web/public");
const BASE_PATH = process.env.PAGES_BASE_PATH ?? "";

const VIEWPORTS = [
  { name: "iPhone SE · portrait", w: 320, h: 568, expect: "mobile" },
  { name: "Android small · portrait", w: 360, h: 800, expect: "mobile" },
  { name: "iPhone 12/13 · portrait", w: 390, h: 844, expect: "mobile" },
  { name: "iPhone 14 Pro Max", w: 430, h: 932, expect: "mobile" },
  { name: "iPad mini · portrait", w: 768, h: 1024, expect: "tablet" },
  { name: "iPad Air · portrait", w: 820, h: 1180, expect: "tablet" },
  { name: "iPad landscape / small laptop", w: 1024, h: 768, expect: "desktop" },
  { name: "Laptop", w: 1280, h: 800, expect: "desktop" },
  { name: "Laptop 1366", w: 1366, h: 768, expect: "desktop" },
  { name: "Desktop", w: 1440, h: 900, expect: "desktop" },
  { name: "Full HD", w: 1920, h: 1080, expect: "desktop" },
  // intermediate widths (resize ke dauraan koi gap na ho)
  { name: "intermediate 480", w: 480, h: 800, expect: "mobile" },
  { name: "intermediate 640", w: 640, h: 900, expect: "mobile" },
  { name: "intermediate 767 (last mobile px)", w: 767, h: 900, expect: "mobile" },
  { name: "intermediate 900", w: 900, h: 1000, expect: "tablet" },
  { name: "intermediate 1023 (last tablet px)", w: 1023, h: 900, expect: "tablet" },
  { name: "intermediate 1100", w: 1100, h: 800, expect: "desktop" },
  { name: "intermediate 1600", w: 1600, h: 900, expect: "desktop" },
];

let pass = 0;
const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const html = await (await fetch(`${BASE}/`)).text();

/** hero ka `<picture>` block */
function pictureBlock(marker) {
  const start = html.indexOf(marker);
  if (start === -1) return "";
  const end = html.indexOf("</picture>", start);
  return html.slice(start, end + "</picture>".length);
}

const hero = pictureBlock('data-testid="campaign-banner"');

/** `<source media="(min-width:Xpx)">` + default `<img src>` parse */
function parsePicture(block) {
  const sources = [...block.matchAll(/<source[^>]*media="\(min-width:(\d+)px\)"[^>]*srcSet="([^"]+)"/g)].map((m) => ({
    min: Number(m[1]),
    src: m[2],
  }));
  const img = block.match(/<img[^>]*src="([^"]+)"/)?.[1] ?? "";
  const width = Number(block.match(/<img[^>]*width="(\d+)"/)?.[1] ?? 0);
  const height = Number(block.match(/<img[^>]*height="(\d+)"/)?.[1] ?? 0);
  return { sources: sources.sort((a, b) => b.min - a.min), img, width, height };
}

const heroPic = parsePicture(hero);

/** brand lockup = ek hi plain `<img>` (owner ka original logo) */
const brandSrc = html.match(/class="brand-lockup[\s\S]{0,400}?<img[^>]*src="([^"]+)"/)?.[1] ?? "";

console.log(`\nbreakpoints → ${BASE}\n`);
console.log(`  hero sources: ${heroPic.sources.map((s) => `${s.min}px→${s.src.split("/").pop()}`).join(", ")} · default ${heroPic.img.split("/").pop()}`);
console.log(`  brand: ${brandSrc.split("/").pop() || "(missing)"}\n`);

check("hero is a <picture> with tablet + desktop sources", heroPic.sources.length === 2);
check("brand lockup ships one file for every width", Boolean(brandSrc) && !brandSrc.includes("undefined"));

/** browser jaisa: pehla matching (sabse badi min-width) source jeetta hai */
function pick(pic, width) {
  for (const source of pic.sources) if (width >= source.min) return source.src;
  return pic.img;
}

const label = (src) => (src.includes("banner") || src.includes("diwali") ? src.split("/").pop() : src);

for (const viewport of VIEWPORTS) {
  const heroSrc = pick(heroPic, viewport.w);
  const kind = /-mobile\.webp$/.test(heroSrc) ? "mobile" : /-tablet\.webp$/.test(heroSrc) ? "tablet" : "desktop";
  check(
    `${String(viewport.w).padStart(4)}×${viewport.h} ${viewport.name} → hero ${label(heroSrc)}`,
    kind === viewport.expect,
    `expected ${viewport.expect}`,
  );
}

/* asset ke asli pixel size + declared width/height */
function webpSize(buffer) {
  if (buffer.subarray(0, 4).toString() !== "RIFF") return { w: 0, h: 0 };
  const chunk = buffer.subarray(12, 16).toString();
  if (chunk === "VP8X") return { w: 1 + buffer.readUIntLE(24, 3), h: 1 + buffer.readUIntLE(27, 3) };
  if (chunk === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  return { w: buffer.readUInt16LE(26) & 0x3fff, h: buffer.readUInt16LE(28) & 0x3fff };
}

const sizes = {};
for (const src of new Set([heroPic.img, ...heroPic.sources.map((s) => s.src)])) {
  const rel = src.replace(BASE_PATH, "").replace(/^\//, "");
  try {
    const buffer = await fs.readFile(path.join(PUBLIC, rel));
    sizes[src] = { ...webpSize(buffer), bytes: buffer.length };
  } catch {
    sizes[src] = { w: 0, h: 0, bytes: 0 };
  }
  check(
    `asset exists: ${label(src)} (${sizes[src].w}×${sizes[src].h}, ${Math.round(sizes[src].bytes / 1024)} KB)`,
    sizes[src].w > 0,
    "missing/unreadable",
  );
}

/* declared width/height attributes asset se match karein (layout shift na ho) */
const declared = { mobile: heroPic, tablet: null, desktop: null };
for (const source of heroPic.sources) {
  const w = Number(hero.match(new RegExp(`srcSet="${source.src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*width="(\\d+)"`))?.[1] ?? 0);
  const h = Number(hero.match(new RegExp(`srcSet="${source.src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*height="(\\d+)"`))?.[1] ?? 0);
  const actual = sizes[source.src];
  check(
    `${label(source.src)}: declared ${w}×${h} matches the file`,
    w === actual.w && h === actual.h,
    `file is ${actual.w}×${actual.h}`,
  );
  declared[source.min >= 1024 ? "desktop" : "tablet"] = { w, h };
}

check(
  `mobile banner default img declared ${heroPic.width}×${heroPic.height} matches the file`,
  declared.mobile.width === sizes[heroPic.img]?.w && declared.mobile.height === sizes[heroPic.img]?.h,
);

/* har asset ~2x display ke liye kaafi bada + 300 KB se halka (instant load) */
for (const [src, size] of Object.entries(sizes)) {
  check(`${label(src)} is under 300 KB`, size.bytes > 0 && size.bytes < 300 * 1024, `${Math.round(size.bytes / 1024)} KB`);
}

/* brand asset readable + retina-crisp (header display height ~50px) */
const brandFile = brandSrc.replace(BASE_PATH, "").replace(/^\//, "");
try {
  const buffer = await fs.readFile(path.join(PUBLIC, brandFile));
  const isPng = buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
  const w = isPng ? buffer.readUInt32BE(16) : 0;
  const h = isPng ? buffer.readUInt32BE(20) : 0;
  check(`brand asset ${brandFile.split("/").pop()} is ${w}×${h} (≥2× of 50px)`, w >= 300 && h >= 100);
} catch {
  check(`brand asset readable: ${brandFile}`, false, "missing");
}

console.log(`\nbreakpoints: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  process.exitCode = 1;
}
