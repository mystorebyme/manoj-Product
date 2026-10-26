"use client";

import { readJson } from "@/lib/http-json";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useScrollPast } from "@/lib/client-env";
import { useCallback, useEffect, useRef, useState } from "react";
import { navigationCollections } from "@/lib/collections";
import { formatPrice, imageUrl } from "@/lib/format";
import { useCart } from "@/components/cart-provider";
import { useWishlist } from "@/components/wishlist-provider";
import type { SearchHit } from "@/types/catalog";
import { useStoreSettings } from "@/components/store-settings-provider";
import { SafeImage } from "@/components/safe-image";
import { BrandLockup } from "@/components/brand-lockup";
import { cartWhatsAppMessage, logWhatsAppEnquiry, whatsappLink, whatsappNumber } from "@/lib/whatsapp";
import { activeCampaign } from "@/lib/campaign";

/**
 * Desktop nav — sirf wahi categories jo sach me products rakhti hain (khaali
 * collection par link nahi). Labels chhote hain taaki 1024px par bhi logo aur
 * icons ke beech me poora fit ho, koi overlap na ho.
 */
const quickLinks = [
  { label: "HOME", href: "/" },
  { label: "SHOP", href: "/collections" },
  { label: "ANARKALI", href: "/collections/party-wear-gown" },
  { label: "LEHENGA", href: "/collections/lehnga-choli" },
  { label: "SUIT SETS", href: "/collections/suit-set-gown" },
  { label: "PRINTED", href: "/collections/printed-suit-set" },
  { label: "WEDDING", href: "/collections/weddin-collection" },
  { label: "NEW IN", href: "/collections/new-arrivals" },
  { label: "SALE", href: "/collections/sale" },
  { label: "CONTACT", href: "/pages/contact" },
];

// Fallback copy — admin → Settings se announcement set ho to wahi dikhta hai
const defaultAnnouncements = [
  ...(activeCampaign ? [activeCampaign.announcement] : []),
  "New season 2026 — the couture edit is live",
  "Free shipping across India — every order",
  "Same-day dispatch on prepaid orders",
  "Order on WhatsApp — instant size & price help",
];

export function SiteHeader() {
  const { count, openCart, lines, removeLine, pendingRemove, setQuantity, subtotal } = useCart();
  const { wishlist } = useWishlist();
  const { whatsapp, supportPhone, announcement } = useStoreSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** scroll position ek external fact hai — `useSyncExternalStore` se (setState-in-effect nahi) */
  const scrolled = useScrollPast(40);
  const [bannerIndex, setBannerIndex] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  // owner (admin ya Google Sheet) se announcement badalte hi header par wahi dikhta hai
  const announcements = announcement ? [announcement, ...defaultAnnouncements] : defaultAnnouncements;

  /**
   * Route badalne par mobile drawer / search panel band. Pehle ye ek effect me
   * `setMobileOpen(false)` karta tha (sync setState in effect) — ab har link par
   * `closeOverlays` chalta hai, jo turant band karta hai aur navigation ke baad
   * bhi state saaf rehti hai.
   */
  const closeOverlays = useCallback(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const [results, setResults] = useState<SearchHit[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recommended, setRecommended] = useState<SearchHit[]>([]);
  // keyboard navigation (↑ ↓ Enter) + scroll-into-view — mobile par list ke end tak pahunchne ke liye
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  // search server par hoti hai -> client bundle me 400KB ka catalog nahi jaata
  useEffect(() => {
    if (!searchOpen) return;
    const term = query.trim();
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
          .then((response) => (response.ok ? readJson<{ results?: SearchHit[]; suggestions?: string[] }>(response) : null))
          .then((parsed) => parsed?.data ?? { results: [] })
          .then(
            (payload: {
              results?: SearchHit[];
              suggestions?: string[];
              recommended?: SearchHit[];
            }) => {
              setResults(payload.results ?? []);
              setSuggestions(payload.suggestions ?? []);
              setRecommended(payload.recommended ?? []);
            },
          )
          .catch(() => undefined);
      },
      term.length < 2 ? 0 : 220,
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, searchOpen]);

  /** query badalne par keyboard-selection reset — handler me hi (effect ki zaroorat nahi) */
  const changeQuery = useCallback((value: string) => {
    setQuery(value);
    setActiveIndex(-1);
  }, []);

  // active item ko panel ke andar scroll karo (page scroll nahi hota)
  useEffect(() => {
    const panel = searchPanelRef.current;
    if (!panel || activeIndex < 0) return;
    const items = panel.querySelectorAll<HTMLElement>("[data-search-item]");
    const item = items[activeIndex];
    if (!item) return;
    item.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  const onSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const panel = searchPanelRef.current;
      if (!panel) return;
      const items = panel.querySelectorAll<HTMLElement>("[data-search-item]");
      if (!items.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1 >= items.length ? 0 : current + 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => (current <= 0 ? items.length - 1 : current - 1));
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        items[activeIndex]?.click();
      } else if (event.key === "Escape") {
        setSearchOpen(false);
      }
    },
    [activeIndex],
  );

  const submitSearch = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (!query.trim()) return;
      setSearchOpen(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    },
    [query, router],
  );

  return (
    <>
      {/* utility bar — deep ink + gold, sirf ek patli line (premium, clone jaisa bright red nahi) */}
      <div className="bg-[#2a0b13] text-[#f0e2cd]">
        <div className="mx-auto flex min-h-9 max-w-[1400px] items-center justify-between gap-3 px-4 py-1.5">
          {/* phone — desktop/tablet par */}
          <a
            href={`tel:+91${supportPhone.replace(/\D/g, "").slice(-10)}`}
            className="hidden shrink-0 items-center gap-1.5 text-[11px] tracking-[.06em] md:flex"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M6 3h3l2 5-2 1a12 12 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2Z" />
            </svg>
            +91 {supportPhone.replace(/\D/g, "").slice(-10)}
          </a>

          {/* rotating announcement — sab screens par (mobile par akela) */}
          <p
            key={bannerIndex}
            className="animate-[fadeIn_.5s_ease] flex-1 text-center text-[10px] leading-tight tracking-[.22em] text-[#f0e2cd] uppercase sm:text-[10.5px]"
          >
            {announcements[bannerIndex]}
          </p>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <span className="text-[10px] tracking-[.18em] text-[#d9bb84] uppercase">Hand-finished in Jaipur</span>
            {announcements.map((item, index) => (
              <button
                key={item}
                type="button"
                aria-label={`Announcement ${index + 1}`}
                onClick={() => setBannerIndex(index)}
                className={`h-1.5 w-1.5 rounded-full transition ${bannerIndex === index ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        </div>
      </div>

      <header
        className={`sticky top-0 z-40 border-b border-[#e4d7c5] bg-[#fffdfa]/96 backdrop-blur-md transition-shadow ${
          scrolled ? "shadow-[0_8px_28px_rgba(74,18,32,0.10)]" : ""
        }`}
      >
        {/*
         * Signature layout — logo **bilkul beech me** (desktop + mobile),
         * nav uske neeche ek patli gold-hairline row me. Ye kisi template ka
         * copy nahi: left/right groups barabar width ke hain isliye logo text ke
         * length se hilta nahi (1fr auto 1fr grid).
         */}
        <div className="mx-auto grid h-[64px] max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:h-[72px] sm:px-5 lg:h-[82px] lg:px-8">
          <div className="flex items-center justify-start gap-1.5">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              data-testid="mobile-menu"
              className="flex h-10 w-10 shrink-0 items-center justify-center lg:hidden"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <Link
              href="/track-order"
              className="hidden text-[10px] font-medium tracking-[.18em] text-[#4a3f38] uppercase transition-colors hover:text-[#6f1d2b] lg:inline"
            >
              Track order
            </Link>
            <span className="hidden h-3 w-px bg-[#e4d7c5] lg:block" aria-hidden />
            <Link
              href="/pages/contact"
              className="hidden text-[10px] font-medium tracking-[.18em] text-[#4a3f38] uppercase transition-colors hover:text-[#6f1d2b] xl:inline"
            >
              Contact
            </Link>
          </div>

          <Link
            href="/"
            aria-label="TRENDS YOUNIQUE home"
            className="flex min-w-0 shrink-0 items-center justify-center px-1"
          >
            <BrandLockup />
          </Link>

          <div className="flex items-center justify-end gap-0.5 sm:gap-1.5">
            <button
              type="button"
              onClick={() => setSearchOpen((open) => !open)}
              aria-label="Search"
              data-testid="header-search"
              className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#f6f1ec] hover:text-[#6f1d2b]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
            <Link
              href="/account"
              aria-label="Account"
              className="hidden h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#f6f1ec] hover:text-[#6f1d2b] md:flex"
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
              </svg>
            </Link>
            <Link
              href="/wishlist"
              aria-label="Wishlist"
              data-testid="header-wishlist"
              className="relative hidden h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#f6f1ec] hover:text-[#6f1d2b] sm:flex"
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1Z" />
              </svg>
              {wishlist.length > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#6f1d2b] px-1 text-[9px] font-semibold text-white">
                  {wishlist.length}
                </span>
              ) : null}
            </Link>
            <button
              type="button"
              onClick={openCart}
              aria-label="Open cart"
              data-testid="header-cart"
              className="relative flex h-9 items-center gap-1.5 px-1.5 transition hover:text-[#6f1d2b]"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 7h12l1.2 13H4.8L6 7Z" />
                <path d="M9 7a3 3 0 0 1 6 0" />
              </svg>
              <span data-testid="cart-count" className="hidden text-[11px] font-medium tabular-nums sm:inline">
                {count}
                <span className="hidden xl:inline"> / {formatPrice(subtotal)}</span>
              </span>
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#6f1d2b] px-1 text-[9px] font-semibold text-white sm:hidden">
                {count}
              </span>
            </button>
          </div>
        </div>

        {/* nav — sirf desktop, logo ke neeche centered (gold hairline ke saath) */}
        <nav className="hidden border-t border-[#efe6d9] bg-[#fbf7f1]/70 lg:block">
          {/* 10 links — 1024–1279 par gap chhota, 1280+ par khula (koi overflow nahi) */}
          <div className="no-scrollbar mx-auto flex max-w-[1400px] items-center justify-center gap-3.5 overflow-x-auto px-6 xl:gap-6 xl:px-8">
            {quickLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative whitespace-nowrap py-2.5 text-[10px] font-medium tracking-[.16em] uppercase transition-colors hover:text-[#6f1d2b] xl:text-[10.5px] ${
                    active ? "text-[#6f1d2b]" : "text-[#3a2f29]"
                  } after:absolute after:bottom-0 after:left-0 after:h-[1.5px] after:w-0 after:bg-[#b08a4a] after:transition-all after:duration-300 hover:after:w-full ${
                    active ? "after:w-full" : ""
                  }`}
                >
                  {link.label}
                  {link.label === "SALE" ? (
                    <span className="absolute -right-3 -top-0.5 rounded-sm bg-[#6f1d2b] px-1 text-[8px] leading-[12px] font-bold text-[#f3e2c7]">
                      SALE
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>

        {searchOpen ? (
          <div
            ref={searchPanelRef}
            data-testid="search-panel"
            onKeyDown={onSearchKeyDown}
            /* panel apne andar scroll hota hai — bahut results hone par bhi user niche tak pahunch sakta hai */
            className="max-h-[calc(100svh-72px)] overflow-y-auto overscroll-contain border-t border-[#ece1d3] bg-white px-4 py-4 shadow-sm"
          >
            <form onSubmit={submitSearch} className="mx-auto max-w-[760px]">
              <div className="flex items-center gap-2 border border-[#d9cec3] px-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  autoFocus
                  data-testid="search-input"
                  aria-label="Search products"
                  value={query}
                  onChange={(event) => changeQuery(event.target.value)}
                  placeholder="Search for anarkali suits, lehenga, printed suits…"
                  className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-[#9c9289]"
                />
                <button type="submit" className="text-[11px] font-semibold tracking-[.14em] uppercase text-[#6f1d2b]">
                  Search
                </button>
              </div>
              {suggestions.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] tracking-[.14em] text-[#9c9289] uppercase">Suggestions</span>
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => changeQuery(suggestion)}
                      className="border border-[#ece3d9] px-2.5 py-1 text-[11.5px] text-[#3d332c] transition hover:border-[#6f1d2b] hover:text-[#6f1d2b]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}

              {results.length > 0 ? (
                <ul className="mt-2.5 divide-y divide-[#f0eae3] border border-[#f0eae3]" data-testid="search-suggestions">
                  {results.map((product, index) => (
                    <li key={product.handle}>
                      <Link
                        href={`/products/${product.handle}`}
                        data-search-item
                        aria-current={index === activeIndex ? "true" : undefined}
                        className="flex items-center gap-3 p-2 hover:bg-[#faf7f3] aria-[current=true]:bg-[#f6f1ec]"
                      >
                        <SafeImage src={imageUrl(product.images[0], 160)} alt={product.title} className="h-14 w-12 object-cover" />
                        <span className="flex-1 text-xs font-medium">{product.title}</span>
                        <span className="text-xs text-[#6f1d2b]">{formatPrice(product.price)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}

              {results.length > 0 ? (
                <Link
                  href={`/search?q=${encodeURIComponent(query.trim())}`}
                  onClick={() => setSearchOpen(false)}
                  className="mt-2 block text-center text-[11px] font-semibold tracking-[.12em] text-[#6f1d2b] uppercase"
                >
                  View all results
                </Link>
              ) : null}

              {query.trim().length >= 2 && results.length === 0 ? (
                <p className="mt-3 text-[11.5px] text-[#8a7d72]">
                  &ldquo;{query.trim()}&rdquo; ke liye kuch nahi mila — inhe try kariye:
                </p>
              ) : null}

              {recommended.length > 0 ? (
                <div className="mt-3">
                  <p className="text-[10px] tracking-[.14em] text-[#9c9289] uppercase">
                    {query.trim().length < 2 ? "Recommended for you" : "You may also like"}
                  </p>
                  <ul className="mt-1.5 divide-y divide-[#f0eae3] border border-[#f0eae3]">
                    {recommended.map((product, index) => (
                      <li key={product.handle}>
                        <Link
                          href={`/products/${product.handle}`}
                          onClick={() => setSearchOpen(false)}
                          data-search-item
                          aria-current={results.length + index === activeIndex ? "true" : undefined}
                          className="flex items-center gap-3 p-2 hover:bg-[#faf7f3] aria-[current=true]:bg-[#f6f1ec]"
                        >
                          <SafeImage src={imageUrl(product.images[0], 160)} alt={product.title} className="h-14 w-12 object-cover" />
                          <span className="flex-1 text-xs font-medium">{product.title}</span>
                          <span className="text-xs text-[#6f1d2b]">{formatPrice(product.price)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </form>
          </div>
        ) : null}
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-[340px] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#ece1d3] px-4 py-3">
              <Link href="/" onClick={() => setMobileOpen(false)} aria-label="TRENDS YOUNIQUE home">
                <BrandLockup size="compact" />
              </Link>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close" className="p-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M5 5l14 14M19 5 5 19" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between border-b border-[#f4efe9] px-5 py-3.5 text-[12.5px] font-medium tracking-[.09em]"
                >
                  {link.label}
                  {link.label === "SALE" ? (
                    <span className="rounded-sm bg-[#e02020] px-1.5 py-0.5 text-[9px] font-bold text-white">HOT</span>
                  ) : (
                    <span className="text-[#c4b8ac]">›</span>
                  )}
                </Link>
              ))}
              <div className="flex divide-x divide-[#f0eae3] border-b border-[#f4efe9]">
                <Link
                  href="/wishlist"
                  onClick={closeOverlays}
                  className="flex flex-1 items-center justify-center gap-2 py-3 text-[12px] font-medium"
                >
                  Wishlist
                  {wishlist.length > 0 ? (
                    <span className="rounded-full bg-[#c2185b] px-1.5 text-[10px] font-semibold text-white">{wishlist.length}</span>
                  ) : null}
                </Link>
                <Link
                  href="/account"
                  onClick={closeOverlays}
                  className="flex flex-1 items-center justify-center gap-2 py-3 text-[12px] font-medium"
                >
                  Account
                </Link>
                <Link
                  href="/track-order"
                  onClick={closeOverlays}
                  className="flex flex-1 items-center justify-center gap-2 py-3 text-[12px] font-medium"
                >
                  Track order
                </Link>
              </div>
              <div className="px-5 py-4">
                <p className="mb-2 text-[11px] tracking-[.16em] text-[#9c9289] uppercase">Collections</p>
                <div className="flex flex-wrap gap-2">
                  {navigationCollections.slice(0, 6).map((collection) => (
                    <Link
                      key={collection.handle}
                      href={`/collections/${collection.handle}`}
                      onClick={closeOverlays}
                      className="border border-[#e5dbd0] px-2.5 py-1 text-[11px]"
                    >
                      {collection.title}
                    </Link>
                  ))}
                </div>
              </div>
            </nav>
            <div className="border-t border-[#ece1d3] px-5 py-4 text-[11.5px] text-[#3d332c]">
              <p className="font-medium text-[#6f1d2b]">WhatsApp {whatsapp}</p>
              <p className="mt-1">Call {supportPhone}</p>
            </div>
          </div>
        </div>
      ) : null}

      <CartDrawer
        count={count}
        subtotal={subtotal}
        lines={lines}
        removeLine={removeLine}
        pendingRemove={pendingRemove}
        setQuantity={setQuantity}
      />
    </>
  );
}

function CartDrawer({
  count,
  subtotal,
  lines,
  removeLine,
  pendingRemove,
  setQuantity,
}: {
  count: number;
  subtotal: number;
  lines: ReturnType<typeof useCart>["lines"];
  removeLine: (key: string) => void;
  pendingRemove: string | null;
  setQuantity: (key: string, quantity: number) => void;
}) {
  const { isOpen, closeCart, lastAdded, notice, maxForSize } = useCart();
  const listRef = useRef<HTMLDivElement>(null);
  const { whatsapp } = useStoreSettings();

  /** drawer se poora cart WhatsApp par — pehle enquiry DB/Sheet me, phir chat */
  function sendCartOnWhatsApp() {
    if (!lines.length) return;
    logWhatsAppEnquiry({
      type: "cart",
      items: lines.map((line) => ({
        title: line.title,
        handle: line.handle,
        colour: line.colour ?? null,
        size: line.size ?? null,
        quantity: line.quantity,
        price: line.price,
      })),
      total: subtotal,
    });
    const message = cartWhatsAppMessage(
      lines.map((line) => ({
        title: line.title,
        handle: line.handle,
        size: line.size,
        colour: line.colour,
        quantity: line.quantity,
        price: line.price,
      })),
    );
    window.open(whatsappLink(message, whatsappNumber(whatsapp)), "_blank", "noopener");
  }

  // naya item list ke sabse upar aata hai — drawer bhi top par scroll ho jaye
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [lastAdded?.key, lastAdded?.quantity]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" data-testid="cart-drawer" role="dialog" aria-modal="true" aria-label="Cart">
      <button type="button" aria-label="Close cart" onClick={closeCart} className="absolute inset-0 bg-black/45" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#ece1d3] px-5 py-4">
          <h2 className="text-[13px] font-semibold tracking-[.16em] uppercase">Your cart ({count})</h2>
          <button type="button" onClick={closeCart} aria-label="Close cart" className="p-1.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M5 5l14 14M19 5 5 19" />
            </svg>
          </button>
        </div>
        {notice ? (
          <p
            role="status"
            className="mx-5 mt-3 border border-[#e2cfa8] bg-[#fdf6e7] px-3 py-2 text-[11.5px] leading-snug text-[#7a5a1c]"
            data-testid="cart-notice"
          >
            {notice}
          </p>
        ) : null}

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-[#6f6259]">Your cart is empty.</p>
            <Link
              href="/collections/party-wear-gown"
              onClick={closeCart}
              className="bg-[#6f1d2b] px-6 py-3 text-[11px] font-semibold tracking-[.16em] text-white uppercase"
            >
              Shop Anarkali Suits
            </Link>
          </div>
        ) : (
          <>
            <div ref={listRef} className="flex-1 overflow-y-auto px-5">
              {lines.map((line) => (
                <div
                  key={line.key}
                  data-testid={line.key === lastAdded?.key ? "cart-just-added" : undefined}
                  className={`flex gap-3 border-b border-[#f2e9dd] py-4 ${
                    line.key === lastAdded?.key ? "bg-[#fdf7f5]" : ""
                  }`}
                >
                  <Link href={`/products/${line.handle}`} onClick={closeCart} className="shrink-0">
                    <SafeImage src={line.image} alt={line.title} className="h-24 w-20 object-cover" />
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <Link
                      href={`/products/${line.handle}`}
                      onClick={closeCart}
                      className="text-[12.5px] font-medium leading-snug hover:text-[#6f1d2b]"
                    >
                      {line.title}
                    </Link>
                    {line.key === lastAdded?.key ? (
                      <span className="mt-1 w-max bg-[#eaf5ec] px-1.5 py-0.5 text-[9.5px] font-semibold tracking-[.08em] text-[#2f7a3f] uppercase">
                        Just added
                      </span>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-[#8a7d72]">
                      Size: {line.size}
                      {line.colour ? ` · ${line.colour}` : ""}
                    </p>
                    <p className="mt-1 text-[12.5px] font-semibold text-[#6f1d2b]">{formatPrice(line.price)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center border border-[#e2d8cd]">
                        <button
                          type="button"
                          onClick={() => setQuantity(line.key, line.quantity - 1)}
                          className="h-7 w-7 text-sm"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="w-7 text-center text-xs">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(line.key, line.quantity + 1)}
                          disabled={line.quantity >= maxForSize(line.size)}
                          className="h-7 w-7 text-sm disabled:cursor-not-allowed disabled:text-[#c9bfb4]"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className={`text-[10.5px] tracking-[.08em] uppercase underline transition ${
                          pendingRemove === line.key
                            ? "font-semibold text-[#6f1d2b] no-underline"
                            : "text-[#9a8f85]"
                        }`}
                        aria-label={
                          pendingRemove === line.key
                            ? `Confirm removing ${line.title}`
                            : `Remove ${line.title}`
                        }
                      >
                        {pendingRemove === line.key ? "Confirm remove?" : "Remove"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-[#ece1d3] px-5 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="tracking-[.1em] uppercase">Subtotal</span>
                <span className="font-semibold text-[#6f1d2b]">{formatPrice(subtotal)}</span>
              </div>
              <p className="mt-1 text-[11px] text-[#8a7d72]">
                Free shipping across India · prepaid orders dispatch same day
              </p>
              <Link
                href="/cart"
                onClick={closeCart}
                className="mt-3 block border border-[#6f1d2b] py-3 text-center text-[11px] font-semibold tracking-[.16em] text-[#6f1d2b] uppercase"
              >
                View cart
              </Link>
              <Link
                href="/checkout"
                onClick={closeCart}
                className="mt-2 block bg-[#6f1d2b] py-3 text-center text-[11px] font-semibold tracking-[.16em] text-white uppercase"
              >
                Checkout
              </Link>
              <button
                type="button"
                onClick={sendCartOnWhatsApp}
                data-testid="drawer-whatsapp"
                className="btn-whatsapp mt-2 w-full py-3 text-[11px]"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1a11.6 11.6 0 0 1-5.9-5.2c-.4-.7-.6-1.4-.6-2 0-.6.3-1.2.6-1.6.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.6l-.4.5c-.1.1-.2.3-.1.5a7.5 7.5 0 0 0 3.3 2.9c.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.4 0 .2 0 .9-.2 1.4Z" />
                </svg>
                Send cart on WhatsApp
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
