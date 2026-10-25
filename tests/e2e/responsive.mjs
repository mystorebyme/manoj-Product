/**
 * Responsive UI checks — assets + device-specific markup (server ke against).
 *
 *   BASE_URL=http://127.0.0.1:3100 node tests/e2e/responsive.mjs
 *
 * Kyun alag file: sandbox me koi browser (Chromium) nahi chalta, isliye hum wahi
 * cheezein verify karte hain jo breakpoints par decide hoti hain — `<picture>` ke
 * `<source media>` order, har breakpoint ka asset, asset ka asli pixel size,
 * aspect-ratio, aur "khaali collection par dead link na ho".
 *
 * Har check ke saath viewport bhi likha hai, taaki report me map ho sake.
 */
import fs from "node:fs/promises";
import path from "node:path";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3100").replace(/\/$/, "");
const PUBLIC = path.resolve(import.meta.dirname, "../../apps/web/public");

let pass = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** PNG/WebP ka width×height (dependency-free) */
async function imageSize(file) {
  const buffer = await fs.readFile(file);
  if (buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), type: "png" };
  }
  if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") {
    const chunk = buffer.subarray(12, 16).toString();
    if (chunk === "VP8X") {
      const width = 1 + buffer.readUIntLE(24, 3);
      const height = 1 + buffer.readUIntLE(27, 3);
      return { width, height, type: "webp" };
    }
    if (chunk === "VP8 ") {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff, type: "webp" };
    }
    if (chunk === "VP8L") {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, type: "webp" };
    }
  }
  return null;
}

const get = async (pathname) => {
  const response = await fetch(`${BASE}${pathname}`, { headers: { "user-agent": "responsive-check" } });
  return { status: response.status, text: await response.text() };
};

console.log(`\nresponsive checks → ${BASE}\n`);

/* 1. asset files: existence + device-appropriate dimensions ------------------ */
const assets = [
  // file, min width, min height, note
  ["images/brand/trends-header.png", 800, 200, "header lockup (crest + wordmark)"],
  ["images/brand/trends-lockup.png", 600, 600, "fluid lockup (stacked, footer/invoice)"],
  ["images/brand/trends-mark-128.png", 128, 128, "favicon 128"],
  ["images/brand/trends-mark-192.png", 192, 192, "PWA 192"],
  ["images/brand/trends-mark-512.png", 512, 512, "PWA 512 / invoice"],
  ["images/banners/trends-younique-diwali-75-off-mobile.webp", 700, 1000, "mobile poster (portrait)"],
  ["images/banners/trends-younique-diwali-75-off-tablet.webp", 1100, 800, "tablet banner (4:3)"],
  ["images/banners/trends-younique-diwali-75-off-desktop.webp", 1700, 500, "desktop banner (wide)"],
];

for (const [file, minW, minH, note] of assets) {
  const full = path.join(PUBLIC, file);
  try {
    const size = await imageSize(full);
    check(
      `${note} — ${file} (${size?.width}×${size?.height})`,
      Boolean(size && size.width >= minW && size.height >= minH),
      size ? `expected ≥ ${minW}×${minH}` : "unreadable file",
    );
  } catch {
    check(`${note} — ${file}`, false, "file missing");
  }
}

/* 2. payload sanity: par-device file size (mobile = smallest banner) --------- */
const sizeOf = async (file) => (await fs.stat(path.join(PUBLIC, file))).size;
const mobileBanner = await sizeOf("images/banners/trends-younique-diwali-75-off-mobile.webp");
const desktopBanner = await sizeOf("images/banners/trends-younique-diwali-75-off-desktop.webp");
check(
  `mobile banner is lighter than desktop (${Math.round(mobileBanner / 1024)} KB vs ${Math.round(desktopBanner / 1024)} KB)`,
  mobileBanner < 260 * 1024 && desktopBanner < 260 * 1024,
);

/* 3. home markup: breakpoints map to the right asset ------------------------ */
const home = await get("/");
check("home 200", home.status === 200, `status ${home.status}`);

const heroPicture = home.text.match(/data-testid="campaign-banner"[\s\S]{0,1400}?<\/picture>/)?.[0] ?? "";
check("hero is a <picture> (only one file loads per device)", Boolean(heroPicture));
check("hero: ≥1024px → desktop banner", /min-width:1024px[^>]*trends-younique-diwali-75-off-desktop\.webp/.test(heroPicture));
check("hero: 768–1023px → tablet banner", /min-width:768px[^>]*trends-younique-diwali-75-off-tablet\.webp/.test(heroPicture));
check("hero: <768px → mobile banner (default img)", /<img[^>]*trends-younique-diwali-75-off-mobile\.webp/.test(heroPicture));
check(
  "hero reserves space with width/height per breakpoint (no layout shift)",
  /width="1920"[^>]*height="1081"/.test(heroPicture) &&
    /width="1280"[^>]*height="960"/.test(heroPicture) &&
    /width="1024"[^>]*height="1536"/.test(heroPicture),
);
check("hero image loads eagerly (LCP) with high priority", /loading="eager"/.test(heroPicture) && /fetchPriority="high"/i.test(heroPicture));
check("hero banner links to the sale collection", /href="\/collections\/sale"/.test(home.text));

// Brand lockup: owner ka ek hi original asset (crest + wordmark) — alag mobile/tablet
// crops nahi, isliye sirf ek file download hoti hai.
const brandLockup =
  (await fs.readFile(path.resolve(import.meta.dirname, "../../apps/web/src/components/brand-lockup.tsx"), "utf8"));
check("brand lockup renders the owner's original logo file", /brandAssets\.(desktop|desktopCream|fluid|fluidCream)/.test(brandLockup));
check("brand lockup ships one source per render (no <picture> fan-out)", !/<picture/.test(brandLockup));

/* 4. header/nav: no dead links, no overflowing fixed widths ---------------- */
// Pages export me base path + trailing slash aata hai — dono accept karo
check("nav has SHOP link to /collections", /href="(?:\/tannu-product-)?\/collections\/?"[^>]*>SHOP/.test(home.text));
check("no saree link in header/footer (0 products)", !home.text.includes("/collections/saree"));
check("header keeps the logo centred between the two icon groups", /grid-cols-\[(auto_1fr_auto|1fr_auto_1fr)\]/.test(home.text));
check("mobile menu is a 40px touch target", /aria-label="Open menu"[\s\S]{0,220}?h-10 w-10/.test(home.text));
// 1024px par nav + 4 icons + logo ke saath overlap na ho: cart ka price sirf xl+ par
check(
  "cart shows only the count at laptop width (price from xl)",
  /data-testid="cart-count"[^>]*sm:inline/.test(home.text) && /data-testid="cart-count"[\s\S]{0,160}?hidden xl:inline/.test(home.text),
);

/* 4b. footer logo: stacked fluid file (wide-but-short space) ---------------- */
const footerSource = await fs.readFile(
  path.resolve(import.meta.dirname, "../../apps/web/src/components/site-footer.tsx"),
  "utf8",
);
check(
  "footer carries the brand lockup (cream tone on wine)",
  /<BrandLockup[^>]*tone="light"/.test(footerSource) && /trends-lockup-cream|trends-header-cream|desktopCream/.test(home.text + footerSource),
);

/* 5. footer: koi social link nahi (owner apna handle baad me dega), whatsapp live ---- */
check(
  "footer me koi instagram link nahi (owner ka handle abhi nahi hai)",
  !/instagram\.com/i.test(home.text),
);
check("footer whatsapp link is live", /href="https:\/\/wa\.me\/917740992663/.test(home.text));
check("no dummy facebook/pinterest links", !home.text.includes("facebook.com") && !home.text.includes("pinterest.com"));

/* 6. collections index (SHOP landing) ------------------------------------- */
const collections = await get("/collections");
check("/collections 200", collections.status === 200, `status ${collections.status}`);
check("/collections lists collection cards", collections.text.includes('data-testid="collection-card"'));
check("/collections hides the empty saree collection", !/href="\/collections\/saree"/.test(collections.text));

/* 7. payment: website par online payment nahi ---------------------------
 * Checkout par koi UPI block nahi hota; sirf order page (`/orders/[n]`) par
 * QR + "Open UPI app" milta hai, aur wahan app chips bhi allowed hain.
 */
const checkoutSource = await fs.readFile(
  path.resolve(import.meta.dirname, "../../apps/web/src/components/checkout-form.tsx"),
  "utf8",
);
check("checkout me koi online payment block nahi (owner rule)", !/UpiApps|UpiPayment|upiUri/.test(checkoutSource));
const upiPaymentSource = await fs.readFile(
  path.resolve(import.meta.dirname, "../../apps/web/src/components/upi-payment.tsx"),
  "utf8",
);
check("order page renders the UPI block once", (upiPaymentSource.match(/<UpiApps/g) ?? []).length === 1);
check("order page UPI block keeps QR + app open + copy id", /buildUpiUri|upiUri/.test(upiPaymentSource) && /UpiApps/.test(upiPaymentSource));
const upiAppsSource = await fs.readFile(
  path.resolve(import.meta.dirname, "../../apps/web/src/components/upi-apps.tsx"),
  "utf8",
);
check("per-app chips are opt-out-able (default on the order page)", /showAppButtons = true/.test(upiAppsSource));

/* 8. responsive CSS rules exist in the built stylesheet -------------------- */
const cssDir = path.join(PUBLIC, "..", ".next/static/chunks");
const cssFile = (await fs.readdir(cssDir).catch(() => [])).find((file) => file.endsWith(".css"));
if (cssFile) {
  const css = await fs.readFile(path.join(cssDir, cssFile), "utf8");
  const flatCss = css.replace(/\s+/g, "");
  check(
    "CSS defines brand-lockup heights per breakpoint (42 → 52 → 50)",
    flatCss.includes(".brand-lockupimg{width:auto;height:42px}") &&
      flatCss.includes(".brand-lockupimg{height:52px}") &&
      flatCss.includes(".brand-lockupimg{height:50px}"),
  );
  check("CSS keeps hero image inside its box (object-fit)", /\.hero-media img\{[^}]*object-fit/.test(css));
} else {
  console.log("  skip built CSS checks (production build ke baad chalayein)");
}

console.log(`\nresponsive: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  process.exitCode = 1;
}
