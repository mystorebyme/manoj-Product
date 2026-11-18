/**
 * Responsive brand + hero assets — owner ke diye hue original files se.
 *
 * Rule: **koi redraw nahi**. Sirf crop / trim / resize / WebP compression.
 *
 * Inputs (repo me committed — owner ke uploads):
 *   assets/source/logo-original.png           (1322×1190, transparent, official full logo)
 *   assets/source/hero-wide-original.png      (2043×770 — header baked hai)
 *   assets/source/hero-portrait-original.png  (1024×1536 poster — mobile/tablet)
 *
 * Campaign (Winter Sale) hero input — owner ke hi posters, sirf campaign text badla
 * gaya hai ("HAPPY Diwali SALE" → "WINTER SALE", tagline → "Wrap Up In Style This Winter");
 * models, logo, 70% badge aur background wahi hain:
 *   assets/source/hero-wide-winter.png        (1376×768 wide winter banner)
 *   assets/source/hero-portrait-winter.png    (843×1264 portrait winter poster)
 *
 * Purane Diwali source files logo crop ke liye repo me hain — banner ab winter
 * sources se bante hain. Campaign badalne par sirf in 2 files + ye script update karo.
 *
 * Header logo kahan se aata hai
 * -----------------------------
 * Owner ke mockup me header ka logo **flat orange/black** version hai (gold ring +
 * gown + DESIGNER CLOTHING), jo unki hi bheji hui wide banner ke header me already
 * hai. Wahi crop karke teen device files banate hain — isliye screen par wahi logo
 * dikhta hai jo owner ne mockup me dikhaya, aur letter shapes bilkul original hain.
 * 3D gradient version (`logo-original.png`) official full logo hai — invoice,
 * favicon/PWA mark aur social card usi se bante hain.
 *
 * Output (apps/web/public/images/):
 *   brand/logo-mobile.png    <768px    compact horizontal (mark chhota, wordmark bada)
 *   brand/logo-tablet.png    768–1023  horizontal, mark bada
 *   brand/logo-desktop.png   ≥1024px   full horizontal lockup (highest resolution)
 *   brand/logo-fluid.png     stacked (mark upar, wordmark neeche) — footer / any size
 *   brand/logo-mark-{128,192,512}.png  square mark on black (favicon, PWA, admin, invoice)
 *   banners/banner-mobile.webp   860×1290 portrait  (<768px)
 *   banners/banner-tablet.webp   1200×900  4:3      (768–1023px)
 *   banners/banner-desktop.webp  1779×594  wide     (≥1024px)
 *   banners/banner-fluid.webp    1600 wide (flexible containers)
 *   images/og-image.jpg          1200×630 social card (winter banner se)
 *
 * Run: npm run assets:brand   (ya node scripts/brand/build-responsive-assets.mjs)
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SRC = path.join(ROOT, "assets/source");
const OUT = path.join(ROOT, "apps/web/public/images");
const BRAND = path.join(OUT, "brand");
const BANNER = path.join(OUT, "banners");

const LOGO_3D = path.join(SRC, "logo-original.png");
const WIDE = path.join(SRC, "hero-wide-original.png");
const PORTRAIT = path.join(SRC, "hero-portrait-original.png");
/** Winter Sale campaign sources (owner ke posters ka winter edition) */
const WIDE_WINTER = path.join(SRC, "hero-wide-winter.png");
const PORTRAIT_WINTER = path.join(SRC, "hero-portrait-winter.png");

await fs.mkdir(BRAND, { recursive: true });
await fs.mkdir(BANNER, { recursive: true });

/* ───────────────────── flat header logo (wide banner se) ───────────────────── */

/** wide banner ke header me jo logo hai — usi ka exact crop (measure kiya hua) */
const FLAT_BOX = { left: 148, top: 56, width: 378, height: 118 };
/** mark (gold ring + gown) kahan khatam hota hai aur wordmark kahan se — measured split */
const FLAT_SPLIT = { markRight: 0.29, wordLeft: 0.31 };

/** safed background ko transparent karna (letters ke andar ka safed bhi, jaisa logo me hai) */
async function keyOutWhite(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const min = Math.min(r, g, b);
    // 242+ = safed background (banner ka paper white); 232–242 = soft edge
    const alpha = min >= 242 ? 0 : min <= 232 ? 255 : Math.round(((242 - min) / 10) * 255);
    data[i + 3] = alpha;
  }
  return sharp(data, { raw: { width, height, channels } }).png({ compressionLevel: 9 }).toBuffer();
}

const flatRaw = await sharp(WIDE).extract(FLAT_BOX).png().toBuffer();
const flat = await sharp(await keyOutWhite(flatRaw)).trim({ threshold: 1 }).png().toBuffer();
const flatMeta = await sharp(flat).metadata();
const flatH = flatMeta.height ?? 0;
const flatW = flatMeta.width ?? 0;
if (!flatW || !flatH) throw new Error("flat header logo crop failed");
console.log(`flat header logo: ${flatW} × ${flatH}`);

/** mark + wordmark, dono flat logo ke andar se (koi scaling-distortion nahi) */
async function flatPieces() {
  const mark = await sharp(flat)
    .extract({ left: 0, top: 0, width: Math.round(flatW * FLAT_SPLIT.markRight), height: flatH })
    .png()
    .toBuffer()
    .then((buffer) => sharp(buffer).trim({ threshold: 1 }).png().toBuffer());
  const word = await sharp(flat)
    .extract({ left: Math.round(flatW * FLAT_SPLIT.wordLeft), top: 0, width: flatW - Math.round(flatW * FLAT_SPLIT.wordLeft), height: flatH })
    .png()
    .toBuffer()
    .then((buffer) => sharp(buffer).trim({ threshold: 1 }).png().toBuffer());
  return { mark, word };
}

const { mark: flatMark, word: flatWord } = await flatPieces();

/** horizontal lockup — mark left, wordmark right, height `h` */
async function horizontal(h, markRatio, gapRatio) {
  const mark = await sharp(flatMark).resize({ height: Math.round(h * markRatio), fit: "inside" }).toBuffer();
  const word = await sharp(flatWord).resize({ height: Math.round(h * markRatio), fit: "inside" }).toBuffer();
  const markMeta = await sharp(mark).metadata();
  const wordMeta = await sharp(word).metadata();
  const gap = Math.round(h * gapRatio);
  const canvasH = Math.max(h, markMeta.height ?? h, wordMeta.height ?? h);
  const width = (markMeta.width ?? 0) + gap + (wordMeta.width ?? 0);
  return sharp({ create: { width, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: mark, top: Math.round((canvasH - (markMeta.height ?? 0)) / 2), left: 0 },
      { input: word, top: Math.round((canvasH - (wordMeta.height ?? 0)) / 2), left: (markMeta.width ?? 0) + gap },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** stacked lockup — mark upar, wordmark neeche (footer / narrow-but-tall space) */
async function stacked(h) {
  const mark = await sharp(flatMark).resize({ height: Math.round(h * 0.42), fit: "inside" }).toBuffer();
  const word = await sharp(flatWord).resize({ width: Math.round(h * 1.9), fit: "inside" }).toBuffer();
  const markMeta = await sharp(mark).metadata();
  const wordMeta = await sharp(word).metadata();
  const width = Math.max(markMeta.width ?? 0, wordMeta.width ?? 0) + Math.round(h * 0.08) * 2;
  const gap = Math.round(h * 0.06);
  const height = (markMeta.height ?? 0) + gap + (wordMeta.height ?? 0) + Math.round(h * 0.08) * 2;
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: mark, top: Math.round(h * 0.08), left: Math.round((width - (markMeta.width ?? 0)) / 2) },
      {
        input: word,
        top: Math.round(h * 0.08) + (markMeta.height ?? 0) + gap,
        left: Math.round((width - (wordMeta.width ?? 0)) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Display heights CSS me 44 / 50 / 46px hain — files 2×–3× par banti hain (retina).
 * Mobile me mark chhota + wordmark bada (chhoti screen par naam padhne layak),
 * desktop par poora lockup high resolution.
 */
await fs.writeFile(path.join(BRAND, "logo-mobile.png"), await horizontal(112, 0.86, 0.09));
await fs.writeFile(path.join(BRAND, "logo-tablet.png"), await horizontal(130, 1, 0.1));
await fs.writeFile(path.join(BRAND, "logo-desktop.png"), await horizontal(150, 1, 0.1));
await fs.writeFile(path.join(BRAND, "logo-fluid.png"), await stacked(320));

/* square mark — favicon / PWA / invoice (official 3D mark on black plate) */
const logo3d = await sharp(LOGO_3D)
  .trim({ threshold: 1 })
  .extend({ top: 4, bottom: 4, left: 4, right: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const logo3dMeta = await sharp(logo3d).metadata();
const logo3dW = logo3dMeta.width ?? 0;
const logo3dH = logo3dMeta.height ?? 0;
const markCrop = await sharp(logo3d)
  .extract({ left: 0, top: 0, width: logo3dW, height: Math.round(logo3dH * 0.66) })
  .png()
  .toBuffer();
const markOnly = await sharp(markCrop).trim({ threshold: 1 }).png().toBuffer();

for (const size of [128, 192, 512]) {
  const glyph = await sharp(markOnly).resize({ height: Math.round(size * 0.92), fit: "inside" }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: "#000000" } })
    .composite([{ input: glyph, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(BRAND, `logo-mark-${size}.png`));
}

/* ─────────────────── hero banners (Winter Sale) ───────────────────
 * Campaign "Winter Sale" hai, isliye banner winter source posters se bante hain.
 * Original Diwali wide file upar sirf header-logo crop ke liye use hui hai.
 *
 * Device ratios pehle jaise hi hain (CSS: 1779/594, 4:3, 860/1290) — layout ya
 * responsive tests me koi change nahi. Wide winter source ~1.79:1 hai aur desktop
 * frame ~3:1, isliye poster ko poora (bina crop) beech me rakhte hain aur kinaare
 * usi poster ke blurred backdrop se bhare jaate hain (tablet wali technique).
 */
const DESK_W = 1779;
const DESK_H = 594;
const deskBackdrop = await sharp(WIDE_WINTER)
  .resize(DESK_W, DESK_H, { fit: "cover", position: "centre" })
  .blur(34)
  .modulate({ brightness: 0.95, saturation: 1.04 })
  .toBuffer();
const deskPoster = await sharp(WIDE_WINTER).resize({ height: DESK_H }).toBuffer();
const deskPosterMeta = await sharp(deskPoster).metadata();
const deskPosterW = deskPosterMeta.width ?? 1064;
console.log(`wide winter hero: ${DESK_W} × ${DESK_H} (poster ${deskPosterW}px centred)`);

/** Poster ke dono kinaare 110px me fade — hard edge nahi, blurred backdrop me mil jaata hai. */
const FEATHER = 110;
const { data: posterPixels, info: posterInfo } = await sharp(deskPoster)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
for (let y = 0; y < posterInfo.height; y += 1) {
  for (let x = 0; x < posterInfo.width; x += 1) {
    const i = (y * posterInfo.width + x) * 4;
    const edge = Math.min(x, posterInfo.width - 1 - x);
    posterPixels[i + 3] = Math.round(Math.min(1, edge / FEATHER) * 255);
  }
}
const softPoster = await sharp(posterPixels, {
  raw: { width: posterInfo.width, height: posterInfo.height, channels: 4 },
}).png().toBuffer();

const desktopBanner = await sharp(deskBackdrop)
  .composite([{ input: softPoster, left: Math.round((DESK_W - deskPosterW) / 2), top: 0 }])
  .webp({ quality: 84, effort: 6 })
  .toBuffer();
await fs.writeFile(path.join(BANNER, "banner-desktop.webp"), desktopBanner);
await sharp(desktopBanner)
  .resize({ width: 1600 })
  .webp({ quality: 80, effort: 6 })
  .toFile(path.join(BANNER, "banner-fluid.webp"));

/** Tablet: 4:3 frame — portrait poster poora beech me + usi poster ka blurred backdrop. */
const TAB_W = 1200;
const TAB_H = 900;
const tabBackdrop = await sharp(PORTRAIT_WINTER)
  .resize(TAB_W, TAB_H, { fit: "cover", position: "centre" })
  .blur(34)
  .modulate({ brightness: 0.92, saturation: 1.05 })
  .toBuffer();
const tabPoster = await sharp(PORTRAIT_WINTER).resize({ height: TAB_H }).toBuffer();
await sharp(tabBackdrop)
  .composite([{ input: tabPoster, gravity: "centre" }])
  .webp({ quality: 84, effort: 6 })
  .toFile(path.join(BANNER, "banner-tablet.webp"));

/** Mobile: portrait poster ka centre crop → 860×1290 (ratio 2:3) */
const posterMeta = await sharp(PORTRAIT_WINTER).metadata();
const posterW = posterMeta.width ?? 843;
const posterH = posterMeta.height ?? 1264;
const mobileW = Math.min(posterW, Math.round(posterH * (860 / 1290)));
await sharp(PORTRAIT_WINTER)
  .extract({ left: Math.round((posterW - mobileW) / 2), top: 0, width: mobileW, height: posterH })
  .resize({ width: 860, height: 1290, fit: "fill" })
  .webp({ quality: 82, effort: 6 })
  .toFile(path.join(BANNER, "banner-mobile.webp"));

await sharp(desktopBanner)
  .resize({ width: 1200, height: 630, fit: "cover", position: "centre" })
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(path.join(OUT, "og-image.jpg"));

for (const [dir, folder] of [
  [BANNER, "banners"],
  [BRAND, "brand"],
]) {
  for (const file of await fs.readdir(dir)) {
    const stat = await fs.stat(path.join(dir, file));
    console.log(`  ${folder}/${file}  ${(stat.size / 1024).toFixed(0)} KB`);
  }
}
