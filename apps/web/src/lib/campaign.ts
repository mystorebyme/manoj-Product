import type { Product } from "@liksha/types";

/**
 * Campaign engine — Diwali sale (75% off) aur mahine-ke-baad rotate hone wala flow.
 *
 * Owner ki requirement: "changes hote rehte hain every month rotate karna".
 * Isliye offer ek hi jagah config me hai, aur:
 *   • dates ke andar hi chalta hai (expired offer apne aap gayab),
 *   • price **sach me** MRP se 75% off hoti hai (koi banaya hua MRP nahi),
 *   • banner ke teen breakpoint assets yahin se aate hain,
 *   • agla campaign add karna = ek object.
 *
 * Env overrides (build ke waqt):
 *   NEXT_PUBLIC_CAMPAIGN_ID      — `off` karne ke liye `none`
 *   NEXT_PUBLIC_CAMPAIGN_START   — ISO date
 *   NEXT_PUBLIC_CAMPAIGN_END     — ISO date
 */

export type Campaign = {
  id: string;
  name: string;
  headline: string;
  subline: string;
  /** poore catalogue par lagne wali discount (MRP se) */
  discountPercent: number;
  /** MRP se price nikalne ka rule — hamesha `discountPercent` ke barabar */
  startAt: string;
  endAt: string;
  announcement: string;
  href: string;
  banners: { desktop: string; tablet: string; mobile: string };
  ratios: { desktop: number; tablet: number; mobile: number };
};

const ASSET_BASE = process.env.NEXT_PUBLIC_PAGES_BASE_PATH ?? "";

export const DIWALI_2026: Campaign = {
  id: "diwali-2026",
  name: "Diwali Sale",
  headline: "Diwali Sale",
  subline: "Flat 75% off — lehenga, anarkali & suit sets",
  discountPercent: 75,
  // Diwali 2026 ke aas-paas; owner env se badal sakta hai (ya naya campaign add kar sakta hai)
  startAt: process.env.NEXT_PUBLIC_CAMPAIGN_START ?? "2026-10-24T00:00:00+05:30",
  endAt: process.env.NEXT_PUBLIC_CAMPAIGN_END ?? "2026-11-30T23:59:59+05:30",
  announcement: "Diwali Sale — flat 75% off, free shipping across India",
  href: "/collections/sale",
  banners: {
    desktop: `${ASSET_BASE}/images/banners/trends-younique-diwali-75-off-desktop.webp`,
    tablet: `${ASSET_BASE}/images/banners/trends-younique-diwali-75-off-tablet.webp`,
    mobile: `${ASSET_BASE}/images/banners/trends-younique-diwali-75-off-mobile.webp`,
  },
  ratios: { desktop: 1920 / 1081, tablet: 1280 / 960, mobile: 1024 / 1536 },
};

/**
 * Campaign registry — **mahine ke hisaab se rotate** karne ke liye.
 *
 * Naya mahina = is array me ek naya object (banner, dates, discount). Dates ke
 * andar wala campaign apne aap live ho jaata hai, purana apne aap band. Ek hi
 * waqt me ek campaign chalta hai (jo pehle match kare).
 */
export const CAMPAIGNS: Campaign[] = [DIWALI_2026];

/** Ab kaun sa campaign chal raha hai (koi nahi → `null`) */
export const activeCampaign: Campaign | null = (() => {
  const forced = (process.env.NEXT_PUBLIC_CAMPAIGN_ID ?? "").trim().toLowerCase();
  if (forced === "none" || forced === "off") return null;
  const now = Date.now();
  const pool = forced ? CAMPAIGNS.filter((item) => item.id === forced) : CAMPAIGNS;
  return (
    pool.find((campaign) => now >= Date.parse(campaign.startAt) && now <= Date.parse(campaign.endAt)) ?? null
  );
})();

/** Agla campaign (owner ko pata rahe kab kya aayega) */
export const upcomingCampaign: Campaign | null =
  CAMPAIGNS.filter((campaign) => Date.parse(campaign.startAt) > Date.now()).sort(
    (a, b) => Date.parse(a.startAt) - Date.parse(b.startAt),
  )[0] ?? null;

/**
 * Campaign price — MRP ka `(100 - discountPercent)`%.
 *
 * Poora rupee par round hota hai (50 paise se zyada ka farq nahi), isliye discount
 * hamesha asli rehta hai; MRP ko chhed kar "accha number" nahi banaya jaata.
 */
export function campaignPrice(mrpPaise: number, discountPercent: number): number {
  if (!Number.isFinite(mrpPaise) || mrpPaise <= 0) return mrpPaise;
  const keep = Math.max(1, 100 - discountPercent) / 100;
  return Math.max(1, Math.round((mrpPaise * keep) / 100) * 100);
}

/** Campaign price ke saath ek product (price + har size ka price) */
export function withCampaignPricing<T extends Product>(product: T, campaign: Campaign | null): T {
  if (!campaign) return product;
  const mrp = product.compareAtPrice ?? product.price;
  if (!mrp || mrp <= product.price) return product; // MRP hi nahi to discount nahi dikha sakte
  const price = campaignPrice(mrp, campaign.discountPercent);
  if (price >= mrp) return product;
  const sizePricing = Object.fromEntries(
    Object.entries(product.sizePricing ?? {}).map(([size, entry]) => [
      size,
      {
        ...entry,
        price: entry.price === product.price ? price : Math.min(entry.price, price),
        compareAtPrice: entry.compareAtPrice && entry.compareAtPrice > price ? entry.compareAtPrice : mrp,
      },
    ]),
  );
  return { ...product, price, sizePricing: sizePricing as T["sizePricing"] };
}

/** Campaign price lagane ke baad asli discount % (badge isi se banta hai) */
export function realDiscountPercent(price: number, compareAtPrice: number | null | undefined): number {
  if (!compareAtPrice || compareAtPrice <= price) return 0;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}
