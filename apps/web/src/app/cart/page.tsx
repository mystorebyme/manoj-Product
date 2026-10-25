"use client";

import Link from "next/link";
import { useCart } from "@/components/cart-provider";
import { formatPrice, imageUrl } from "@/lib/format";
import { SafeImage } from "@/components/safe-image";
import { cartWhatsAppMessage, logWhatsAppEnquiry, whatsappLink, whatsappNumber } from "@/lib/whatsapp";
import { useStoreSettings } from "@/components/store-settings-provider";

export default function CartPage() {
  const { lines, subtotal, setQuantity, removeLine, pendingRemove, notice, maxForSize } = useCart();
  const { whatsapp } = useStoreSettings();

  /** poora cart WhatsApp par — enquiry pehle DB + Sheet me, phir chat khulti hai */
  function sendCartOnWhatsApp() {
    if (!lines.length) return;
    const items = lines.map((line) => ({
      title: line.title,
      handle: line.handle,
      colour: line.colour ?? null,
      size: line.size ?? null,
      quantity: line.quantity,
      price: line.price,
    }));
    logWhatsAppEnquiry({ type: "cart", items, total: subtotal });
    window.open(
      whatsappLink(
        cartWhatsAppMessage(
          lines.map((line) => ({
            title: line.title,
            handle: line.handle,
            size: line.size,
            colour: line.colour,
            quantity: line.quantity,
            price: line.price,
          })),
        ),
        whatsappNumber(whatsapp),
      ),
      "_blank",
      "noopener",
    );
  }
  // campaign/sale price already final hai — koi coupon stack nahi hota
  const total = Math.max(0, subtotal);
  const freeShippingMet = true;

  return (
    <div className="container-liksha py-8 lg:py-12">
      <h1 className="font-display text-[28px] font-medium tracking-[.03em] sm:text-[34px]">Shopping cart</h1>
      <p className="mt-1 text-[11.5px] tracking-[.12em] text-[#a3948a] uppercase">
        {lines.length} {lines.length === 1 ? "item" : "items"} in your cart · max 15 pieces per order
      </p>

      {notice ? (
        <p
          role="status"
          className="mt-3 border border-[#e2cfa8] bg-[#fdf6e7] px-3 py-2 text-[11.5px] leading-snug text-[#7a5a1c]"
          data-testid="cart-notice"
        >
          {notice}
        </p>
      ) : null}

      {lines.length === 0 ? (
        <div className="mt-10 border border-[#ece1d3] px-6 py-20 text-center">
          <p className="text-sm text-[#6f6259]">Your cart is currently empty.</p>
          <Link
            href="/collections/party-wear-gown"
            className="mt-5 inline-block bg-[#6f1d2b] px-7 py-3 text-[11px] font-semibold tracking-[.16em] text-white uppercase"
          >
            Continue shopping
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <div className="hidden border-b border-[#ece1d3] pb-2 text-[10.5px] tracking-[.14em] text-[#a3948a] uppercase sm:grid sm:grid-cols-[1fr_120px_100px_90px]">
              <span>Product</span>
              <span className="text-center">Quantity</span>
              <span className="text-center">Total</span>
              <span />
            </div>
            <ul className="divide-y divide-[#f2e9dd]">
              {lines.map((line) => (
                <li key={line.key} className="grid grid-cols-[84px_1fr] gap-3 py-4 sm:grid-cols-[1fr_120px_100px_90px] sm:items-center">
                  <div className="col-span-2 flex gap-3 sm:col-span-1">
                    <Link href={`/products/${line.handle}`} className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <SafeImage src={line.image} alt={line.title} className="h-28 w-[84px] object-cover" />
                    </Link>
                    <div className="flex flex-col">
                      <Link
                        href={`/products/${line.handle}`}
                        className="text-[12.5px] font-medium leading-snug hover:text-[#6f1d2b]"
                      >
                        {line.title}
                      </Link>
                      <p className="mt-1 text-[11px] text-[#8a7d72]">
                        Size: {line.size}
                        {line.colour ? ` · Colour: ${line.colour}` : ""}
                      </p>
                      <p className="mt-1 text-[12px] font-semibold text-[#6f1d2b]">{formatPrice(line.price)}</p>
                    </div>
                  </div>
                  <div className="flex justify-start sm:justify-center">
                    <div className="flex items-center border border-[#e2d8cd]">
                      <button
                        type="button"
                        onClick={() => setQuantity(line.key, line.quantity - 1)}
                        className="h-8 w-8"
                        aria-label="Decrease"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-xs">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(line.key, line.quantity + 1)}
                        disabled={line.quantity >= maxForSize(line.size)}
                        className="h-8 w-8 disabled:cursor-not-allowed disabled:text-[#c9bfb4]"
                        aria-label="Increase"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="hidden text-center text-[12.5px] font-semibold sm:block">
                    {formatPrice(line.price * line.quantity)}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    data-testid="cart-remove"
                    aria-label={`Remove ${line.title} from cart`}
                    className={`inline-flex items-center gap-1.5 justify-self-start border px-2.5 py-1.5 text-[10px] font-medium tracking-[.08em] uppercase transition sm:justify-self-center ${
                      pendingRemove === line.key
                        ? "border-[#6f1d2b] bg-[#6f1d2b] text-white"
                        : "border-[#e2d8cd] text-[#8a7d72] hover:border-[#6f1d2b] hover:text-[#6f1d2b]"
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
                    </svg>
                    {pendingRemove === line.key ? "Confirm?" : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
            <Link
              href="/collections/new-arrivals"
              className="mt-5 inline-block border border-[#6f1d2b] px-5 py-2.5 text-[10.5px] font-semibold tracking-[.16em] text-[#6f1d2b] uppercase"
            >
              Continue shopping
            </Link>
          </div>

          <aside className="h-fit border border-[#ece1d3] bg-[#fdfaf5] p-5 lg:sticky lg:top-[92px]">
            <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Order summary</h2>
            <div className="mt-4 space-y-2 text-[12.5px]">
              <Row label="Subtotal" value={formatPrice(subtotal)} />
              <Row label="Shipping" value={freeShippingMet ? "Free" : "Calculated on WhatsApp"} />
              <div className="flex items-center justify-between border-t border-[#e7ddd2] pt-2.5 text-[14px] font-semibold">
                <span>Total</span>
                <span className="text-[#6f1d2b]">{formatPrice(total)}</span>
              </div>
            </div>

            <p className="mt-4 border border-[#eadfce] bg-[#fdf8f0] px-3 py-2.5 text-[11px] leading-relaxed text-[#8a7a5f]">
              Festive sale price already applied — <strong>no coupon needed</strong>. Free shipping on every order.
            </p>

            <Link
              href="/checkout"
              className="mt-5 block bg-[#6f1d2b] py-3 text-center text-[11.5px] font-semibold tracking-[.16em] text-white uppercase"
            >
              Proceed to checkout
            </Link>
            <button
              type="button"
              onClick={sendCartOnWhatsApp}
              data-testid="cart-whatsapp"
              className="btn-whatsapp mt-2.5 w-full py-2.5 text-[10.5px]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1a11.6 11.6 0 0 1-5.9-5.2c-.4-.7-.6-1.4-.6-2 0-.6.3-1.2.6-1.6.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.6l-.4.5c-.1.1-.2.3-.1.5a7.5 7.5 0 0 0 3.3 2.9c.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.4 0 .2 0 .9-.2 1.4Z" />
              </svg>
              Send cart on WhatsApp
            </button>
            <p className="mt-2.5 text-center text-[10.5px] text-[#8a7d72]">
              Payment link WhatsApp par milta hai · UPI, cards & netbanking
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#6f6259]">{label}</span>
      <span className={accent ? "font-medium text-[#2f7a3f]" : "text-[#3f3830]"}>{value}</span>
    </div>
  );
}
