/**
 * TRENDS YOUNIQUE — brand + asset config (ek hi jagah).
 *
 * Logo owner ke original file (`assets/source/trends-younique-logo-original.png`)
 * se banta hai — `python3 scripts/brand/build-trends-assets.py`. Koi redraw nahi.
 *
 * Assets (sab local, isliye kisi CDN par depend nahi):
 *   - `brand/trends-header.png`          crest + wordmark (header, light bg)
 *   - `brand/trends-header-cream.png`    same, cream (maroon/dark bg)
 *   - `brand/trends-lockup.png`          stacked full lockup (footer, invoices, about)
 *   - `brand/trends-mark-{64,128,192,512}.png` square crest (favicon, PWA, WhatsApp thumb)
 */
const ASSET_BASE = process.env.NEXT_PUBLIC_PAGES_BASE_PATH ?? "";

export const brandAssets = {
  /** crest + wordmark horizontal — site header */
  desktop: `${ASSET_BASE}/images/brand/trends-header.png`,
  tablet: `${ASSET_BASE}/images/brand/trends-header.png`,
  mobile: `${ASSET_BASE}/images/brand/trends-header.png`,
  /** cream version — maroon footer / dark hero */
  desktopCream: `${ASSET_BASE}/images/brand/trends-header-cream.png`,
  /** stacked lockup */
  fluid: `${ASSET_BASE}/images/brand/trends-lockup.png`,
  /** stacked, cream (dark background) */
  fluidCream: `${ASSET_BASE}/images/brand/trends-lockup-cream.png`,
  /** square crest */
  mark: `${ASSET_BASE}/images/brand/trends-mark-512.png`,
  mark192: `${ASSET_BASE}/images/brand/trends-mark-192.png`,
  mark128: `${ASSET_BASE}/images/brand/trends-mark-128.png`,
} as const;

/**
 * Hero — premium editorial visuals (account/collection ke hisaab se alag crop).
 * Har file ka ratio config me hi hai, isliye layout shift zero rehta hai.
 */
export const heroBanners = {
  desktop: `${ASSET_BASE}/images/banners/hero-desktop.webp`,
  tablet: `${ASSET_BASE}/images/banners/hero-tablet.webp`,
  mobile: `${ASSET_BASE}/images/banners/hero-mobile.webp`,
  fluid: `${ASSET_BASE}/images/banners/hero-desktop.webp`,
} as const;

export const HERO_RATIO = {
  desktop: 16 / 9,
  tablet: 4 / 3,
  mobile: 4 / 5,
} as const;

/** brand palette — design tokens Tailwind classes me bhi yahi (`globals.css`) */
export const palette = {
  ink: "#14100e",
  plum: "#4a1220",
  wine: "#6b1f2a",
  gold: "#b98b3c",
  goldSoft: "#d9b877",
  cream: "#faf6ef",
  sand: "#efe4d4",
  rich: "#2a1017",
} as const;

export const logoUrl = brandAssets.fluid;
export const logoLockupUrl = brandAssets.desktop;
export const logoSmall = brandAssets.mark128;
export const logoWhiteUrl = brandAssets.fluidCream;
export const logoFallback = brandAssets.fluid;
export const logoMark = brandAssets.mark;

/**
 * Site ka apna URL — WhatsApp / invoice / canonical links isi se banate hain.
 * Domain lagne ke baad `NEXT_PUBLIC_SITE_URL` set kar dijiye.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/$/, "") ??
  "https://trendsyounique.fashion";

export const siteConfig = {
  name: "TRENDS YOUNIQUE",
  shortName: "Trends Younique",
  url: siteUrl,
  ogImage: `${ASSET_BASE}/images/og-image.jpg`,
  tagline: "Couture for the woman who arrives",
  description:
    "TRENDS YOUNIQUE — designer anarkali suits, lehenga choli and printed suit sets, hand-finished for weddings and festivals. Order on WhatsApp, free shipping across India.",
  phone: "+91 8005900581",
  /** 10 digit — `91` app khud lagata hai */
  whatsapp: "8005900581",
  email: "care@trendsyounique.com",
  address: "Jaipur, Rajasthan, India",
  /** owner-confirmed domain (2026) — env se override ho sakta hai */
  domain: "trendsyounique.fashion",
  socials: {
    // Instagram handle owner baad me dega — tab yahan add karna hai
    instagram: "",
    instagramHandle: "",
  },
  currency: "INR",
} as const;

export const ORDER_STATUS_COPY: Record<string, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};
