"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandLockup } from "@/components/brand-lockup";
import { useStoreSettings } from "@/components/store-settings-provider";
import { siteConfig } from "@/config/site";
import { apiUrl } from "@/lib/api-base";
import { relayNewsletterToSheet } from "@/lib/sheet-relay";
import { API_AVAILABLE } from "@/lib/api-base";

/**
 * Footer — deep wine band, cream logo, support + menu columns:
 * deep wine band (#3a0f1b), cream logo, contact / follow /
 * CUSTOMER SUPPORT / Menu columns, phir copyright strip.
 */

const supportLinks = [
  { label: "Search", href: "/search" },
  { label: "Privacy Policy", href: "/policies/privacy-policy" },
  { label: "Replacement Policy", href: "/policies/refund-and-return-policy" },
  { label: "Shipping Policy", href: "/policies/shipping-policy" },
  { label: "Contact Information", href: "/pages/contact" },
  { label: "Track your order", href: "/track-order" },
  { label: "About Us", href: "/pages/about-us" },
  { label: "Terms and Conditions", href: "/policies/terms-and-conditions" },
];

const menuLinks = [
  { label: "HOME", href: "/" },
  { label: "TRENDS SIGNATURE", href: "/collections/best-seller" },
  { label: "ANARKALI SUIT", href: "/collections/party-wear-gown" },
  { label: "LEHENGA CHOLI", href: "/collections/lehnga-choli" },
  { label: "PRINTED SUIT SET", href: "/collections/printed-suit-set" },
  { label: "CONTACT US", href: "/pages/contact" },
  { label: "SALE", href: "/collections/sale" },
  { label: "SHOP ALL", href: "/collections" },
  { label: "WEDDING COLLECTION", href: "/collections/wedding-collection" },
];

/**
 * Social — abhi sirf WhatsApp ka working link hai. Instagram/Facebook/Pinterest
 * ke dummy links nahi dikhate: account na ho to jhootha link = trust kharab.
 * Owner apna Instagram handle de dein to ek line add karni hai.
 */

export function SiteFooter() {
  const { whatsapp, supportPhone } = useStoreSettings();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function subscribe(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    // static hosting (GitHub Pages) par server nahi hota — seedha sheet me save karo
    if (!API_AVAILABLE) {
      relayNewsletterToSheet(email.trim(), "footer");
      setStatus("done");
      setEmail("");
      return;
    }
    try {
      const response = await fetch(apiUrl("/api/newsletter"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus(response.ok ? "done" : "error");
      if (response.ok) {
        relayNewsletterToSheet(email.trim(), "footer");
        setEmail("");
      }
    } catch {
      // server tak nahi pahuncha to bhi sheet me chala jaye
      relayNewsletterToSheet(email.trim(), "footer");
      setStatus("done");
      setEmail("");
    }
  }

  return (
    <footer className="mt-16 bg-[#3a0f1b] text-white">
      <div className="mx-auto max-w-[1400px] px-4 pt-12 pb-8 lg:px-6">
        {/* logo — footer me bhi exactly centre (medallion frame ke saath) */}
        <div className="flex flex-col items-center text-center">
          <Link
            href="/"
            aria-label="TRENDS YOUNIQUE home"
            className="group inline-flex flex-col items-center justify-center"
          >
            <span className="flex h-[112px] w-[112px] items-center justify-center rounded-full border border-[#6b3a3f] bg-[#4a1220]/60 transition-colors duration-500 group-hover:border-[#b08a4a] sm:h-[124px] sm:w-[124px]">
              <BrandLockup tone="light" size="compact" />
            </span>
            <span className="mt-4 font-display text-[19px] tracking-[.3em] text-[#f4e7d2] uppercase sm:text-[21px]">
              Trends Younique
            </span>
          </Link>
          <p className="mt-4 text-center font-display text-[15px] italic tracking-[.06em] text-[#e9d3ae]">
            Couture for the woman who arrives
          </p>
          <div className="mt-5 flex items-center gap-3">
            <span className="h-px w-12 bg-[#6b3a3f]" />
            <span className="h-1 w-1 rotate-45 bg-[#b08a4a]" />
            <span className="h-px w-12 bg-[#6b3a3f]" />
          </div>
        </div>

        <div className="mt-9 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {/* Contact us */}
          <div>
            <h3 className="text-[11px] font-semibold tracking-[.22em] text-[#d9bb84] uppercase">Contact us</h3>
            <ul className="mt-4 space-y-2.5 text-[13.5px] text-[#ececec]">
              <li className="flex items-start gap-2">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 shrink-0" aria-hidden>
                  <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
                </svg>
                <a
                  href={`https://wa.me/91${whatsapp.replace(/\D/g, "").slice(-10)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-[#e1d256]"
                >
                  WhatsApp {whatsapp}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 shrink-0" aria-hidden>
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .7-.2 1l-2.3 2.2Z" />
                </svg>
                <a href={`tel:${supportPhone.replace(/[^\d+]/g, "")}`} className="transition hover:text-[#e1d256]">
                  {supportPhone}
                </a>
              </li>
            </ul>

            <p className="mt-5 text-[15px] font-medium text-white">Connect with us :</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {/* WhatsApp — customer isi par order/query bhejta hai */}
              <a
                href={`https://wa.me/91${whatsapp.replace(/\D/g, "").slice(-10)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat on WhatsApp"
                className="flex h-8 items-center gap-2 rounded-full border border-white/35 px-3 text-[12px] text-white transition hover:border-[#e1d256] hover:text-[#e1d256]"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M20 12a8 8 0 0 1-11.7 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z" />
                  <path d="M9 9c.5 3 2.5 5 5.5 5.5" />
                </svg>
                WhatsApp
              </a>
            </div>
          </div>

          {/* Customer support */}
          <div>
            <h3 className="text-[15px] font-medium text-white">CUSTOMER SUPPORT</h3>
            <ul className="mt-4 space-y-2.5 text-[13.5px] text-[#ececec]">
              {supportLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-[#e1d256]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Menu */}
          <div>
            <h3 className="text-[15px] font-medium text-white">Menu</h3>
            <ul className="mt-4 space-y-2.5 text-[13.5px] text-[#ececec]">
              {menuLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-[#e1d256]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-[15px] font-medium text-white">Sale alerts</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#f1dede]">
              Join the TRENDS YOUNIQUE list for early access to new drops and festive sale prices.
            </p>
            <form onSubmit={subscribe} className="mt-3">
              <div className="flex border border-white/40 bg-white">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Your email"
                  aria-label="Email address"
                  className="h-10 w-full bg-transparent px-2.5 text-[12.5px] text-[#14100e] outline-none"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="bg-[#222] px-3.5 text-[10.5px] font-semibold tracking-[.12em] text-white uppercase disabled:opacity-60"
                >
                  Join
                </button>
              </div>
              {status === "done" ? (
                <p className="mt-1.5 text-[11.5px] text-[#d9f0d9]">You&apos;re in! Sale alerts on the way.</p>
              ) : null}
              {status === "error" ? (
                <p className="mt-1.5 text-[11.5px] text-[#ffd6cf]">
                  Signup abhi save nahi hua.{" "}
                  <a
                    href={`https://wa.me/91${whatsapp.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(
                      `Hi TRENDS YOUNIQUE! Please add me to the sale list: ${email}`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    WhatsApp par email bhejein
                  </a>
                  .
                </p>
              ) : null}
            </form>

            <div className="mt-5 space-y-1.5 text-[13px] text-[#ececec]">
              <p>
                <Link href="/wishlist" className="transition hover:text-[#e1d256]">
                  My Wishlist
                </Link>
              </p>
              <p>
                <Link href="/track-order" className="transition hover:text-[#e1d256]">
                  Track your order
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/20">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 px-4 py-4 text-[11.5px] text-[#f3e2e2] sm:flex-row lg:px-6">
          <p>© {new Date().getFullYear()}, TRENDS YOUNIQUE. All rights reserved.</p>
          <p className="text-[10.5px] tracking-[.1em] uppercase">Secure prepaid payments</p>
        </div>
      </div>
    </footer>
  );
}
