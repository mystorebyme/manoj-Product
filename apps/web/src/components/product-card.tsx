"use client";

import Link from "next/link";
import { useRef } from "react";
import { useCart } from "@/components/cart-provider";
import { useWishlist } from "@/components/wishlist-provider";
import { discountPercent, formatPrice, imageUrl } from "@/lib/format";
import type { Product } from "@/types/catalog";
import { SafeImage } from "@/components/safe-image";
import { Stars } from "@/components/stars";
import { colourSwatch } from "@/lib/colour";
import { coloursFor } from "@/lib/colour-index";
import { useSheetMainImage } from "@/lib/sheet-products";

/**
 * Product card — premium editorial layout:
 *  - hover par pehli image hat jaati hai aur doosri image cursor ke saath
 *    background me halki si move karti hai (parallax follow)
 *  - **sirf ek image** wale products par image badalti nahi — wahi image cursor ke
 *    saath halki si float karti hai (owner: "jo image hai vo hi rehni chahiye")
 *  - image ke **upar** wishlist (heart), niche "Add to cart" — clean, sirf zaroori
 *  - price ke niche colour swatches
 */
export function ProductCard({
  product,
  colours,
}: {
  product: Product;
  colours?: { name: string; handle: string }[];
}) {
  const { addItem } = useCart();
  const { isWished, toggleWishlist } = useWishlist();
  const wished = isWished(product.handle);
  const colourOptions = colours ?? coloursFor(product.handle);
  const off = discountPercent(product.price, product.compareAtPrice);
  // owner Sheet ke `MainImage` tab se main photo badal sakta hai
  const primary = useSheetMainImage(product.handle, product.images[0]);
  const hoverImage = product.images[1] ?? null;
  const mediaRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);

  /** cursor ke saath image move — CSS variable se, isliye re-render nahi hota */
  function follow(event: React.MouseEvent<HTMLDivElement>) {
    const node = mediaRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      node.style.setProperty("--cursor-x", `${(x * 22).toFixed(1)}px`);
      node.style.setProperty("--cursor-y", `${(y * 22).toFixed(1)}px`);
    });
  }

  function reset() {
    const node = mediaRef.current;
    if (!node) return;
    if (frame.current) cancelAnimationFrame(frame.current);
    node.style.removeProperty("--cursor-x");
    node.style.removeProperty("--cursor-y");
  }

  /**
   * Sirf wahi size bik sakta hai jo stock me hai. `sizePricing` na ho to
   * product-level `inStock` maano (purane catalog ke liye).
   */
  const availableSizes = product.sizes.filter((size) => {
    const pricing = product.sizePricing?.[size];
    return pricing ? pricing.available !== false : product.inStock;
  });
  const soldOut = !product.inStock || availableSizes.length === 0;
  const defaultSize = availableSizes[0] ?? product.sizes[0] ?? "Free Size";

  return (
    <div className="ty-card group relative flex flex-col">
      {/* ivory mat + gold hairline — card ko "framed print" jaisa premium look deta hai */}
      <div className="ty-card-frame relative overflow-hidden">
        <Link href={`/products/${product.handle}`} className="block" data-testid="product-card">
          <div
            ref={mediaRef}
            className={`card-media relative aspect-[3/4] w-full ${hoverImage ? "" : "is-single"}`}
            onMouseMove={follow}
            onMouseLeave={reset}
            onTouchEnd={reset}
          >
            <SafeImage
              src={imageUrl(primary, 600)}
              alt={product.title}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="card-media-primary absolute inset-0 h-full w-full object-cover"
            />
            {hoverImage ? (
              <SafeImage
                src={imageUrl(hoverImage, 600)}
                alt=""
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="card-media-alt absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
          </div>
        </Link>

        {off > 0 ? (
          <span className="ty-badge absolute left-2 top-2">{off}% off</span>
        ) : null}
        {soldOut ? (
          <span className="ty-badge absolute left-2 top-8 bg-[#14100e] text-[#f3e7d3]">Sold out</span>
        ) : null}

        {/* image ke upar sirf wishlist — compare/eye icon (purane template ka) hata diya */}
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => toggleWishlist(product.handle)}
            aria-label={wished ? `Remove ${product.title} from wishlist` : `Add ${product.title} to wishlist`}
            aria-pressed={wished}
            data-testid="wishlist-toggle"
            title={wished ? "In wishlist" : "Add to wishlist"}
            className={`flex h-8 w-8 items-center justify-center rounded-full border bg-white/95 shadow-sm backdrop-blur transition hover:scale-105 ${
              wished ? "border-[#c2185b]/30 text-[#c2185b]" : "border-transparent text-[#14100e] hover:border-[#b08a4a]/50"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={wished ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6">
              <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1Z" />
            </svg>
          </button>

        </div>

        <button
          type="button"
          disabled={soldOut}
          aria-disabled={soldOut}
          data-testid={soldOut ? "sold-out-button" : "quick-add"}
          title={soldOut ? "Sold out — next drop ke liye WhatsApp kariye" : undefined}
          onClick={() =>
            soldOut
              ? undefined
              : addItem({
              handle: product.handle,
              title: product.title,
              price: product.sizePricing?.[defaultSize]?.price ?? product.price,
              compareAtPrice: product.compareAtPrice,
              image: imageUrl(primary, 400),
              size: defaultSize,
              colour: product.colourName ?? product.color,
            })
          }
          className={`ty-quickadd absolute inset-x-2 bottom-2 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-semibold tracking-[.18em] uppercase transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100 max-sm:translate-y-0 max-sm:opacity-100 ${
            soldOut
              ? "cursor-not-allowed bg-[#3a322c]/95 text-white/80"
              : "bg-[#4a1220]/95 text-[#f6ecdc] hover:bg-[#6f1d2b]"
          }`}
        >
          {soldOut ? (
            "Sold out"
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M6 7h12l1.2 13H4.8L6 7Z" />
                <path d="M9 7a3 3 0 0 1 6 0" />
              </svg>
              Add to cart
            </>
          )}
        </button>
      </div>

      <div className="flex flex-1 flex-col px-0.5 pt-3 text-center">
        <Link
          href={`/products/${product.handle}`}
          className="line-clamp-2 font-display text-[13.5px] leading-snug tracking-[.01em] text-[#231a16] transition-colors hover:text-[#6f1d2b] sm:text-[14.5px]"
        >
          {product.title}
        </Link>
        {product.reviewCount > 0 ? (
          <p className="mt-1 flex items-center justify-center gap-1 text-[10px] text-[#8a7d72]">
            <Stars value={product.rating} size={10} />
            <span>
              {product.rating.toFixed(1)} ({product.reviewCount})
            </span>
          </p>
        ) : null}
        <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[12px]">
          {/* pehle sale price (jo dena hai), phir MRP struck — product page jaisa hi order */}
          <span className="font-semibold text-[#6f1d2b]">{formatPrice(product.price)}</span>
          {product.compareAtPrice && product.compareAtPrice > product.price ? (
            <span className="text-[#a49a90] line-through">{formatPrice(product.compareAtPrice)}</span>
          ) : null}
        </div>
        {colourOptions.length > 1 ? (
          <div className="mt-1.5 flex items-center justify-center gap-1.5">
            {colourOptions.slice(0, 6).map((colour) => (
              <Link
                key={colour.handle}
                href={`/products/${colour.handle}`}
                title={colour.name}
                aria-label={`View ${colour.name}`}
                className="h-3 w-3 rounded-full border border-black/10 transition hover:scale-110"
                style={{ backgroundColor: colourSwatch(colour.name) }}
              />
            ))}
            {colourOptions.length > 6 ? (
              <span className="text-[9.5px] text-[#a49a90]">+{colourOptions.length - 6}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ProductGrid({
  products,
  columns = 4,
  colourGroups = {},
}: {
  products: Product[];
  columns?: 2 | 3 | 4;
  /** product handle → uske colour options (card par swatch dots) */
  colourGroups?: Record<string, { name: string; handle: string }[]>;
}) {
  const gridClass =
    columns === 2
      ? "grid-cols-2"
      : columns === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  return (
    <div className={`grid gap-x-2.5 gap-y-7 sm:gap-x-5 ${gridClass}`}>
      {products.map((product) => (
        <ProductCard key={product.handle} product={product} colours={colourGroups[product.handle]} />
      ))}
    </div>
  );
}
