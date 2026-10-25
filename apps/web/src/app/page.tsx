import Link from "next/link";
import type { Metadata } from "next";
import { RotatingRail } from "@/components/rotating-rail";
import { CategoryCircles } from "@/components/category-circles";
import { ReviewsStrip } from "@/components/reviews-strip";
import { EditorialBand, OccasionStrip } from "@/components/occasion-strip";
import { Reveal } from "@/components/reveal";
import { getProducts, getCollection } from "@/lib/store";
import { RAILS, type RailKey, railPool } from "@/lib/rails";
import { compactProduct, rotatePick, rotationBucket } from "@/lib/rotation";
import { bestSellers } from "@/lib/best-sellers";
import { BestSellersRail } from "@/components/best-sellers-rail";
import { imageUrl } from "@/lib/format";
import { heroBanners, siteConfig } from "@/config/site";
import { whatsappLink, whatsappNumber } from "@/lib/whatsapp";
import { SafeImage } from "@/components/safe-image";

/** Home ke rails har 10 minute me badalte hain — page bhi utni hi der me refresh hota hai */
export const revalidate = 600;

export const metadata: Metadata = {
  title: "TRENDS YOUNIQUE | Designer Anarkali Suits, Lehenga Choli & Suit Sets",
  description:
    "Shop designer Anarkali suits, lehanga choli and printed suit sets at TRENDS YOUNIQUE. Hand-finished pieces, free shipping within India and express delivery on prepaid orders.",
  alternates: { canonical: "/" },
};

/**
 * Hero — premium editorial.
 *
 * Artwork (owner ke liye generate ki gayi editorial shoot) par koi text bake nahi
 * hai; headline HTML me hai — isliye SEO/accessibility dono theek aur copy badalna
 * aasan. Device ke hisaab se alag crop aata hai (ek hi file download hoti hai):
 *   - <768px   → 4:5 portrait (mobile)
 *   - 768–1023 → 4:3 (tablet)
 *   - ≥1024px  → 16:9 wide (desktop, model right + left me copy ke liye space)
 */
const HERO_HREF = "/collections/new-arrivals";
const SECONDARY_HREF = "/collections/sale";

export default async function HomePage() {
  const products = await getProducts();
  const byCollection = (handle: string) => products.filter((product) => product.collections.includes(handle));

  /**
   * Har rail ka set 10-minute window se banta hai (server par bhi wahi algorithm
   * jo client par hai) — refresh par naye products, aur client bhi 10 min me
   * khud badal jaata hai.
   */
  const bucket = rotationBucket();
  const rail = (key: RailKey) => {
    const pool = railPool(key, products);
    const picks = rotatePick(pool, `${key}:${bucket}`, RAILS[key].count);
    return {
      initial: picks.map(compactProduct),
      // fallback pool (static preview ke liye) — chhota rakha hai
      pool: rotatePick(pool, `pool:${bucket}`, 24).map(compactProduct),
    };
  };
  const trendy = rail("trendy");
  const newArrivalsRail = rail("newArrivals");
  const lehnga = rail("lehnga");
  const explore = rail("explore");

  // best sellers — asli orders se ranked (orders empty ho to curated edit)
  const bestSellerPicks = (await bestSellers(8)).map(({ product }) => compactProduct(product));

  const anarkaliCollection = await getCollection("party-wear-gown");
  const lehngaCollection = await getCollection("lehnga-choli");
  const printedCollection = await getCollection("printed-suit-set");
  const newArrivalsCollection = await getCollection("new-arrivals");
  const saleCollection = await getCollection("sale");
  const choiceCollection = await getCollection("trends-signature");

  // "Shop by edit" circles — ek line me, live store ka style
  const circleItems = [
    { href: "/collections/party-wear-gown", title: "Anarkali Suit", image: anarkaliCollection?.image, count: byCollection("party-wear-gown").length },
    { href: "/collections/lehnga-choli", title: "Lehnga Choli", image: lehngaCollection?.image, count: byCollection("lehnga-choli").length },
    { href: "/collections/printed-suit-set", title: "Printed Suit Set", image: printedCollection?.image, count: byCollection("printed-suit-set").length },
    { href: "/collections/new-arrivals", title: "New Arrivals", image: newArrivalsCollection?.image, count: byCollection("new-arrivals").length },
    { href: "/collections/trends-signature", title: "Trends Signature", image: choiceCollection?.image, count: byCollection("trends-signature").length },
    { href: "/collections/sale", title: "Sale", image: saleCollection?.image, count: byCollection("sale").length },
    { href: "/collections/wedding-collection", title: "Wedding", image: undefined, count: byCollection("weddin-collection").length },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: siteConfig.name,
    url: siteConfig.url,
    image: siteConfig.ogImage,
    description: siteConfig.description,
    telephone: siteConfig.phone,
    email: siteConfig.email,
    address: { "@type": "PostalAddress", addressLocality: "Jaipur", addressRegion: "Rajasthan", addressCountry: "IN" },
    priceRange: "₹499 - ₹699",
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── hero: editorial banner + overlay copy (device-specific crop) ── */}
      <section className="relative bg-[#efe4d4]" data-testid="hero-banner" aria-label="TRENDS YOUNIQUE new season">
        <div className="mx-auto max-w-[1920px]">
          <div className="hero-media hero-scrim hero-frame relative aspect-[4/5] w-full overflow-hidden bg-[#efe4d4] md:aspect-[4/3] lg:aspect-[16/9]">
            <picture>
              <source media="(min-width:1024px)" srcSet={heroBanners.desktop} width={1920} height={1080} />
              <source media="(min-width:768px)" srcSet={heroBanners.tablet} width={1280} height={960} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroBanners.mobile}
                alt="Model in a hand-embroidered wine anarkali suit from the TRENDS YOUNIQUE new season edit"
                width={1000}
                height={1250}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="animate-kenburns"
              />
            </picture>

            {/* vertical signature — editorial magazine jaisa side label */}
            <span className="hero-side">Hand-finished in Jaipur · Est. 2026</span>

            {/* overlay copy — mobile par neeche, desktop par left me */}
            <div className="absolute inset-0 flex items-end justify-start sm:items-center">
              <div className="w-full max-w-[760px] px-6 pb-9 sm:px-10 sm:pb-0 lg:px-16">
                <p className="nyx-rule text-[10px] font-semibold tracking-[.34em] text-[#e6cb98] uppercase sm:text-[11px]">
                  New season · 2026
                </p>
                <h1 className="mt-3 font-display text-[34px] leading-[1.05] font-medium text-white sm:text-[46px] lg:text-[62px]">
                  Couture for the
                  <br className="hidden sm:block" /> woman who arrives
                </h1>
                <p className="mt-4 max-w-[42ch] text-[12.5px] leading-relaxed text-[#f2e6d6] sm:text-[13.5px]">
                  Hand-finished anarkali suits, lehenga choli and printed sets — made in limited runs,
                  delivered across India.
                </p>
                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <Link
                    href={HERO_HREF}
                    className="btn-primary w-full justify-center sm:w-auto"
                  >
                    Shop new arrivals
                  </Link>
                  <a
                    href={whatsappLink(
                      `Hi ${siteConfig.name}, I'd like help choosing an outfit. Please share your latest designs.`,
                      whatsappNumber(),
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 border border-white/70 px-7 py-[0.9rem] text-[11px] font-semibold tracking-[.18em] text-white uppercase transition hover:border-[#e6cb98] hover:text-[#e6cb98] sm:w-auto"
                  >
                    Order on WhatsApp
                  </a>
                </div>
                <p className="mt-4 text-[10.5px] tracking-[.16em] text-[#e7d9c6] uppercase">
                  Free shipping · 7 day exchange · WhatsApp ordering
                </p>
                <div className="mt-5 hidden items-center gap-4 border-t border-white/25 pt-4 sm:flex">
                  {[
                    { label: "Anarkali", href: "/collections/party-wear-gown" },
                    { label: "Lehenga", href: "/collections/lehnga-choli" },
                    { label: "Printed sets", href: "/collections/printed-suit-set" },
                    { label: "Sale", href: "/collections/sale" },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="text-[9.5px] tracking-[.2em] text-[#efe1cd]/85 uppercase underline-offset-4 transition hover:text-[#e6cb98] hover:underline"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* trust strip — premium brands jaise, hero ke turant neeche */}
          <div className="border-y border-[#e4d7c5] nyx-paper">
            <ul className="nyx-trust container-liksha grid grid-cols-2 text-center md:grid-cols-4">
              {[
                { title: "Hand-finished in Jaipur", note: "Zari, sequin & mirror work" },
                { title: "Free shipping pan-India", note: "Dispatched within 24 hours" },
                { title: "Order on WhatsApp", note: "Stylist help before you buy" },
                { title: "7 day easy exchange", note: "Size ya fit ka issue? Solved" },
              ].map((item) => (
                <li key={item.title} className="px-4 py-4 md:py-5">
                  <p className="text-[10.5px] font-semibold tracking-[.14em] text-[#4a1220] uppercase">{item.title}</p>
                  <p className="mt-1 text-[10.5px] text-[#8a7d72]">{item.note}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <CategoryCircles items={circleItems} />

      <ProductRail rail="trendy" products={trendy.initial} pool={trendy.pool} />

      <BestSellersRail initial={bestSellerPicks} />

      <ProductRail rail="newArrivals" products={newArrivalsRail.initial} pool={newArrivalsRail.pool} />

      <ProductRail rail="lehnga" products={lehnga.initial} pool={lehnga.pool} />

      <ReviewsStrip />

      <ProductRail rail="explore" products={explore.initial} pool={explore.pool} />
      <OccasionStrip />
      <EditorialBand />

      {/* WhatsApp ordering band — dukaan ka doosra "checkout" */}
      <section className="container-liksha pb-4" aria-labelledby="whatsapp-band">
        <div className="relative overflow-hidden bg-[#4a1220] px-6 py-10 text-center sm:px-12 sm:py-14">
          <div className="pointer-events-none absolute inset-0 opacity-[0.14]" aria-hidden>
            <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full border border-[#d9bb84]" />
            <div className="absolute -right-10 -bottom-24 h-72 w-72 rounded-full border border-[#d9bb84]" />
          </div>
          <span className="text-[10px] font-semibold tracking-[.32em] text-[#d9bb84] uppercase">
            Personal styling
          </span>
          <h2 id="whatsapp-band" className="mt-3 font-display text-[26px] leading-tight font-medium text-white sm:text-[34px]">
            Size, colour ya delivery — poochh lijiye WhatsApp par
          </h2>
          <p className="mx-auto mt-3 max-w-[52ch] text-[12.5px] leading-relaxed text-[#e9d9c8]">
            Cart bhariye ya seedha product page se hi order bhejiye — humari team wahi item,
            wahi size confirm karke payment link bhej deti hai. Bulk (10–30 pieces) ke liye bhi
            yahi number.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <a
              href={whatsappLink(
                `Hi ${siteConfig.name}, I need help with size / delivery.`,
                whatsappNumber(),
              )}
              target="_blank"
              rel="noreferrer"
              className="btn-whatsapp w-full justify-center sm:w-auto"
              data-testid="home-whatsapp"
            >
              Chat on WhatsApp
            </a>
            <Link
              href="/collections"
              className="inline-flex w-full items-center justify-center border border-white/60 px-7 py-[0.9rem] text-[11px] font-semibold tracking-[.18em] text-white uppercase transition hover:border-[#d9bb84] hover:text-[#d9bb84] sm:w-auto"
            >
              Browse all edits
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProductRail({
  rail,
  products,
  pool,
}: {
  rail: RailKey;
  products: Awaited<ReturnType<typeof getProducts>>;
  pool: Awaited<ReturnType<typeof getProducts>>;
}) {
  const { title, subtitle, href } = RAILS[rail];
  if (!products.length) return null;
  return (
    <section className="container-liksha py-11 lg:py-16">
      <Reveal className="flex flex-col items-center text-center">
        <span className="eyebrow">The edit</span>
        <h2 className="section-title mt-2 text-[27px] sm:text-[34px]">{title}</h2>
        <div className="mt-4 flex w-full max-w-[220px] items-center gap-3">
          <span className="h-px flex-1 bg-[#dcc9ad]" />
          <span className="h-1 w-1 rotate-45 bg-[#b08a4a]" />
          <span className="h-px flex-1 bg-[#dcc9ad]" />
        </div>
        <p className="mt-3 text-[11px] tracking-[.16em] text-[#a3948a] uppercase">{subtitle}</p>
      </Reveal>
      <Reveal className="mt-7" delay={80}>
        <RotatingRail rail={rail} initial={products} pool={pool} perView={3} />
      </Reveal>
      <div className="mt-9 flex justify-center">
        <Link href={href} className="btn-outline">
          View all
        </Link>
      </div>
    </section>
  );
}
