"use client";

import { useStoreSettings } from "@/components/store-settings-provider";

/**
 * "Buy protected" — bharosa block product page par.
 *
 * Yahan wahi baatein likhi hain jo store ki asli policy hai (koi banaya hua
 * vaada nahi):
 *   - order WhatsApp par confirm hota hai, isliye galat order ka risk nahi
 *   - 7 day return (refund policy)
 *   - free shipping — owner ke Google Sheet `Settings` tab se (`free_shipping`)
 *   - dispatch 1–3 working days
 *
 * Shipping line live settings se aati hai, isliye sheet me `free_shipping`
 * false karte hi yahan bhi "Shipping ₹X" dikhne lagta hai.
 */
const items = [
  {
    title: "Order protected",
    text: "Order WhatsApp par confirm hota hai — galat item ya galat size ka risk nahi.",
    icon: (
      <path d="M12 3 4 6.5v5c0 4.4 3.2 8.2 8 9.5 4.8-1.3 8-5.1 8-9.5v-5L12 3Zm-1.2 12.4-3-3 1.4-1.4 1.6 1.6 4-4L16.2 10l-5.4 5.4Z" />
    ),
  },
  {
    title: "7 day return",
    text: "Delivery ke 7 din ke andar return — tags intact hone chahiye.",
    icon: <path d="M4 12a8 8 0 1 1 3 6.2M4 12V6m0 6h6" />,
  },
  {
    title: "Free shipping",
    text: "Poore India me free delivery, dispatch 1–3 working days me.",
    icon: <path d="M3 7h11v8H3V7Zm11 3h4l3 3v2h-7v-5ZM6.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />,
  },
  {
    title: "No online payment",
    text: "Site par payment nahi — order ke baad team WhatsApp par UPI details bhejti hai.",
    icon: <path d="M3 6h18v12H3V6Zm4 6h4m-4 3h7" />,
  },
];

export function BuyProtected({ compact = false }: { compact?: boolean }) {
  const { freeShipping } = useStoreSettings();
  return (
    <div
      className={`mt-4 border border-[#ece1d3] bg-[#fdfaf5] ${compact ? "p-3" : "p-4"}`}
      data-testid="buy-protected"
    >
      <p className="text-[10px] font-semibold tracking-[.16em] text-[#6f1d2b] uppercase">Buy protected</p>
      <ul className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.title} className="flex gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mt-0.5 shrink-0 text-[#b08a4a]"
              aria-hidden
            >
              {item.icon}
            </svg>
            <div>
              <p className="text-[11.5px] font-semibold text-[#3d332c]">{item.title}</p>
              <p className="text-[11px] leading-snug text-[#8a7d72]">
                {item.title === "Free shipping" && !freeShipping
                  ? "Shipping charge checkout par dikhta hai, dispatch 1–3 working days me."
                  : item.text}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
