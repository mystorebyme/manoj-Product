import Link from "next/link";
import type { Metadata } from "next";
import { TrackOrderForm } from "@/components/track-order-form";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "My account & order tracking",
  description: "Track your TRENDS YOUNIQUE order, download your invoice or get help on WhatsApp.",
  robots: { index: true, follow: true },
};

const helpLinks = [
  { label: "Size guide", href: "/pages/size-guide" },
  { label: "Shipping & delivery", href: "/policies/shipping-policy" },
  { label: "Returns & refunds", href: "/policies/refund-and-return-policy" },
  { label: "Contact us", href: "/pages/contact" },
];

export default function AccountPage() {
  return (
    <div className="container-liksha py-10 lg:py-14">
      <div className="mx-auto max-w-[900px]">
        <div className="text-center">
          <h1 className="font-display text-[30px] font-medium tracking-[.03em] sm:text-[36px]">
            Track your order
          </h1>
          <p className="mt-1 text-[11px] tracking-[.14em] text-[#a3948a] uppercase">
            Order number WhatsApp par milta hai
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <div className="border border-[#ece1d3] bg-[#fdfaf5] p-5 sm:p-6">
            <h2 className="text-[11px] font-semibold tracking-[.16em] text-[#6f1d2b] uppercase">
              Order status
            </h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#6f6259]">
              Apna order number daal kar live status, items aur delivery address dekh lein.
            </p>
            <TrackOrderForm />
            <p className="mt-3 text-[11px] text-[#8a7d72]">
              Order number nahi mila? WhatsApp{" "}
              <a href={`https://wa.me/91${siteConfig.whatsapp}`} className="text-[#6f1d2b]">
                {siteConfig.whatsapp}
              </a>
            </p>
          </div>

          <div className="border border-[#ece1d3] p-5 sm:p-6">
            <h2 className="text-[11px] font-semibold tracking-[.16em] text-[#6f1d2b] uppercase">
              Need help?
            </h2>
            <ul className="mt-3 space-y-2">
              {helpLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[12.5px] text-[#3d332c] hover:text-[#6f1d2b]">
                    {link.label} →
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-[#f0eae3] pt-3 text-[12px] text-[#6f6259]">
              <p>WhatsApp: {siteConfig.phone}</p>
              <p className="mt-1 text-[11px] text-[#8a7d72]">
                Account login (saved addresses, wishlist) Phase 2 me aa raha hai.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
