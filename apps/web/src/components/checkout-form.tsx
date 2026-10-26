"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart-provider";
import { formatPrice, imageUrl } from "@/lib/format";
import { SafeImage } from "@/components/safe-image";
import { useStoreSettings } from "@/components/store-settings-provider";
import { addressStates, verifyAddress, type AddressVerdict } from "@/lib/address-check";
import {
  checkoutWhatsAppMessage,
  logWhatsAppEnquiry,
  whatsappLink,
  whatsappNumber,
} from "@/lib/whatsapp";
import { newOrderRef, relayOrderToSheet, relayRows } from "@/lib/sheet-relay";

const indianStates = [
  "Andhra Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Delhi", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jammu & Kashmir", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

export function CheckoutForm() {
  const { lines, subtotal, count, isOpen, closeCart, removeLine } = useCart();
  // campaign/sale price already final hai — koi extra coupon nahi
  const { whatsapp, blockedStates, blockedPincodes } = useStoreSettings();
  const [whatsappHref, setWhatsappHref] = useState<string | null>(null);
  // ek hi submission par ek hi enquiry/order row (dobara click se duplicate na bane)
  const enquiryLogged = useRef(false);
  const orderRefOnce = useRef<string | null>(null);
  // OTP step hata diya gaya hai (owner request) — order sirf details par
  const [error, setError] = useState<string | null>(null);
  // delivery check — PIN ka asli state (India Post data) + owner ke blocks
  /**
   * PIN check ka result us **state+PIN ke saath** rakhte hain jiske liye aaya tha.
   * Isse render me hi pata chal jaata hai ki check chal raha hai ya nahi
   * (effect me `setPinBusy(true)` / `setPinStatus(null)` karne ki zaroorat nahi —
   * wo cascading render karta tha).
   */
  const [pinCheck, setPinCheck] = useState<{ key: string; verdict: AddressVerdict } | null>(null);
  const [states, setStates] = useState<string[]>(indianStates);
  const [form, setForm] = useState({
    customerName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "Rajasthan",
    pincode: "",
    notes: "",
  });

  useEffect(() => {
    if (isOpen) closeCart();
  }, [isOpen, closeCart]);

  // state list seedha India Post data se (jo state pincode data me hai wahi dropdown me)
  useEffect(() => {
    let alive = true;
    void addressStates().then((list) => {
      if (alive && list.length) setStates(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * PIN + state ka mel yahin check hota hai:
   *   - PIN India Post me hai?
   *   - Owner ne wo state/PIN block kiya hai?
   *   - PIN ka state aur chuna hua state ek hai? (Rajasthan address + Kerala PIN = block)
   * Har check sheet ke `AddressCheck` tab me log hota hai, taaki owner dekh sake
   * kis state/PIN par galat address aa rahe hain.
   */
  const pinKey = `${form.state}|${form.pincode}`;
  /** 6 digit PIN bharte hi check shuru — result aane tak "Checking delivery…" */
  const pinBusy = form.pincode.length === 6 && pinCheck?.key !== pinKey;
  const pinStatus = pinCheck?.key === pinKey ? pinCheck.verdict : null;

  useEffect(() => {
    const pin = form.pincode;
    if (pin.length !== 6) return undefined;
    const key = `${form.state}|${pin}`;
    let active = true;
    const timer = setTimeout(() => {
      void verifyAddress(form.state, pin, {
        states: blockedStates,
        pincodes: blockedPincodes,
      })
        .then((verdict) => {
          if (!active) return;
          setPinCheck({ key, verdict });
          // verification ka record owner ki sheet me (sirf admin dekhta hai)
          if (verdict.pinState) {
            relayRows([
              {
                sheet: "AddressCheck",
                row: {
                  Timestamp: new Date().toISOString(),
                  Result: verdict.ok ? "ok" : verdict.mismatch ? "state-mismatch" : verdict.blocked ? `blocked-${verdict.blocked}` : "unknown-pin",
                  Customer: form.customerName,
                  Phone: form.phone,
                  Address: form.address,
                  City: form.city,
                  "State chosen": form.state,
                  PIN: pin,
                  "PIN state": verdict.pinState,
                  District: verdict.district,
                  Blocked: verdict.blocked ?? "",
                  "Source page": "/checkout",
                },
              },
            ]);
          }
        })
        .catch(() => undefined);
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pincode, form.state, blockedStates, blockedPincodes]);

  const discount = 0;
  const total = Math.max(0, subtotal - discount);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  /**
   * **Primary flow: order seedha WhatsApp par.**
   *
   * Customer details bharta hai → "Send order on WhatsApp" dabata hai →
   * poora order (item link, colour, size, qty, price + address) owner ke
   * WhatsApp par chala jaata hai, aur usi waqt DB + Google Sheet me row save hoti hai.
   */
  function sendOrderOnWhatsApp(): void {
    if (lines.length === 0) return;
    const missing = validateDetails();
    if (missing) {
      setError(missing);
      return;
    }
    setError(null);

    // ek hi cart ke liye ek hi ref — dobara click par wahi ref, nayi row nahi
    const firstSend = orderRefOnce.current === null;
    const orderRef = orderRefOnce.current ?? newOrderRef();
    orderRefOnce.current = orderRef;
    const payload = lines.map((line) => ({
      title: line.title,
      handle: line.handle,
      colour: line.colour ?? null,
      size: line.size ?? null,
      quantity: line.quantity,
      price: line.price,
    }));

    // 1) SHEET SABSE PEHLE — order ki row kisi API/WhatsApp par depend nahi karti.
    //    (Pehle ye enquiry log ke baad chalta tha; wahan kuch bhi throw ho jaye to
    //    sheet me order pahunchta hi nahi tha.)
    if (firstSend) {
      try {
        relayOrderToSheet({
          orderRef,
          customerName: form.customerName,
          phone: form.phone,
          email: form.email,
          address: form.address,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          notes: form.notes,
          items: lines.map((line) => ({
            title: line.title,
            handle: line.handle,
            colour: line.colour ?? null,
            size: line.size ?? null,
            quantity: line.quantity,
            price: line.price,
            image: line.image,
          })),
          total,
        });
      } catch {
        /* relay khud queue me daal deta hai; yahan kuch na karo */
      }
    }

    // 2) Enquiry log (cart/checkout ka snapshot — sheet + server dono)
    if (firstSend && !enquiryLogged.current) {
      enquiryLogged.current = true;
      try {
        logWhatsAppEnquiry({
          type: "checkout",
          items: payload,
          total,
          customer: form.customerName,
          phone: form.phone,
          note: [form.address, form.city, form.state, form.pincode, form.notes]
            .filter(Boolean)
            .join(", ")
            .slice(0, 480),
        });
      } catch {
        /* enquiry log fail ho to bhi order row ja chuki hai */
      }
    }

    // 2) WhatsApp — poora detail pre-filled
    const href = whatsappLink(
      checkoutWhatsAppMessage({
        items: payload,
        total,
        name: form.customerName,
        phone: form.phone,
        email: form.email,
        address: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        notes: form.notes,
        orderRef,
      }),
      whatsappNumber(whatsapp),
    );
    setWhatsappHref(href);
    window.open(href, "_blank", "noopener");
  }

  /** WhatsApp se pehle zaroori fields — customer ko saaf message */
  function validateDetails(): string | null {
    if (form.customerName.trim().length < 2) return "Poora naam daaliye.";
    if (form.phone.replace(/\D/g, "").length !== 10) return "10 digit WhatsApp number daaliye (is par hum confirm karenge).";
    if (form.address.trim().length < 10) return "Poora address daaliye — house number, street, area.";
    if (form.city.trim().length < 2) return "City daaliye.";
    if (form.pincode.replace(/\D/g, "").length !== 6) return "6 digit pincode daaliye.";
    return null;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lines.length === 0) return;
    if (!pinStatus) {
      setError("Please check your delivery pincode first — we only ship to verified pincodes.");
      return;
    }
    if (!pinStatus.ok) {
      setError(
        pinStatus.mismatch
          ? `${pinStatus.message} (Address ka state aur PIN code ek hi state ka hona chahiye.)`
          : pinStatus.message,
      );
      return;
    }
    setError(null);
    setWhatsappHref(null);
    enquiryLogged.current = false;
    orderRefOnce.current = null;

    // Online payment / card / UPI website par nahi hai — order seedha WhatsApp par.
    // (Har hosting par yahi ek rasta hai: owner WhatsApp par confirm karta hai.)
    sendOrderOnWhatsApp();
  }

  if (lines.length === 0) {
    return (
      <div className="border border-[#ece1d3] px-6 py-20 text-center">
        <p className="text-sm text-[#6f6259]">Your cart is empty — add a suit set to checkout.</p>
        <Link
          href="/collections/party-wear-gown"
          className="mt-5 inline-block bg-[#6f1d2b] px-7 py-3 text-[11px] font-semibold tracking-[.16em] text-white uppercase"
        >
          Shop now
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <section>
          <h2 className="text-[11px] font-semibold tracking-[.16em] text-[#6f1d2b] uppercase">Contact</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Full name" required value={form.customerName} onChange={(v) => update("customerName", v)} />
            <Field
              label="Mobile number"
              required
              type="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={(v) => update("phone", v)}
            />
            <Field
              label="Email"
              required
              type="email"
              className="sm:col-span-2"
              value={form.email}
              onChange={(v) => update("email", v)}
            />
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold tracking-[.16em] text-[#6f1d2b] uppercase">Shipping address</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              label="Address (house, street, area)"
              required
              className="sm:col-span-2"
              value={form.address}
              onChange={(v) => update("address", v)}
            />
            <Field label="City" required value={form.city} onChange={(v) => update("city", v)} />
            <div>
              <label className="text-[10.5px] tracking-[.12em] text-[#6f6259] uppercase">State</label>
              <select
                value={form.state}
                onChange={(event) => update("state", event.target.value)}
                className="mt-1 h-11 w-full border border-[#ded1c0] bg-white px-3 text-[13px] outline-none focus:border-[#6f1d2b]"
              >
                {states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Field
                label="Pincode"
                required
                inputMode="numeric"
                value={form.pincode}
                onChange={(v) => update("pincode", v.replace(/\D/g, "").slice(0, 6))}
              />
              {pinBusy ? <p className="mt-1 text-[11px] text-[#8a7d72]">Checking delivery…</p> : null}
              {pinStatus ? (
                <p
                  className={`mt-1 text-[11px] leading-relaxed ${pinStatus.ok ? "text-[#2f7a3f]" : "text-[#a11d1d]"}`}
                  data-testid="pincode-status"
                >
                  {pinStatus.ok
                    ? `Deliverable${pinStatus.district ? ` — ${pinStatus.district}, ${pinStatus.pinState}` : ""}. Free shipping, 4-7 business days.`
                    : pinStatus.message}
                </p>
              ) : null}
              {pinStatus?.mismatch && pinStatus.pinState ? (
                <button
                  type="button"
                  onClick={() => update("state", pinStatus.pinState!)}
                  data-testid="fix-state"
                  className="mt-1.5 inline-flex items-center border border-[#6f1d2b] px-3 py-1.5 text-[10.5px] font-semibold tracking-[.12em] text-[#6f1d2b] uppercase"
                >
                  State {pinStatus.pinState} kariye
                </button>
              ) : null}
            </div>
            <Field label="Order notes (optional)" value={form.notes} onChange={(v) => update("notes", v)} />
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold tracking-[.16em] text-[#6f1d2b] uppercase">Payment</h2>
          <div className="mt-3 border border-[#e5dbd0] bg-[#fdf8f7] p-3.5">
            <p className="text-[12.5px] font-medium">No online payment on the website</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[#8a7d72]">
              Aap order WhatsApp par bhejiye — owner khud confirm karke payment ki detail (UPI / bank) wahin
              WhatsApp par bhejenge. Website par koi card / UPI / gateway detail nahi maangi jaati.
            </p>
          </div>
        </section>
      </div>

      <aside className="h-fit border border-[#ece1d3] bg-[#fdfaf5] p-5 lg:sticky lg:top-[92px]">
        <h2 className="text-[11px] font-semibold tracking-[.16em] uppercase">Order summary ({count})</h2>
        <ul className="mt-3 divide-y divide-[#ece1d3]">
          {lines.map((line) => (
            <li key={line.key} className="flex gap-2.5 py-2.5">
              <SafeImage
                src={imageUrl(line.image, 240)}
                alt={line.title}
                className="h-20 w-14 shrink-0 object-cover"
              />
              <div className="flex-1">
                <p className="line-clamp-2 text-[11.5px] leading-snug">{line.title}</p>
                <p className="mt-0.5 text-[10.5px] text-[#8a7d72]">
                  {line.size}
                  {line.colour ? ` · ${line.colour}` : ""} · Qty {line.quantity}
                </p>
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  data-testid="summary-remove"
                  aria-label={`Remove ${line.title} from order`}
                  className="mt-1 text-[10px] tracking-[.06em] text-[#9a8f85] uppercase underline transition hover:text-[#6f1d2b]"
                >
                  Remove
                </button>
              </div>
              <span className="text-[11.5px] font-medium">{formatPrice(line.price * line.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-2 border-t border-[#e7ddd2] pt-3 text-[12.5px]">
          <div className="flex justify-between">
            <span className="text-[#6f6259]">Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6f6259]">Shipping</span>
            <span className="text-[#2f7a3f]">Free</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#e7ddd2] pt-2.5 text-[14.5px] font-semibold">
            <span>Total</span>
            <span className="text-[#6f1d2b]">{formatPrice(total)}</span>
          </div>
        </div>

        {error ? <p className="mt-3 text-[11.5px] text-[#b3261e]">{error}</p> : null}

        {whatsappHref ? (
          <div className="mt-3 border border-[#c9dcc9] bg-[#eef7ee] p-3" data-testid="checkout-whatsapp">
            <p className="text-[11.5px] leading-relaxed text-[#2f6b3f]">
              <strong>Order ready!</strong> WhatsApp khul gaya hai — bas <em>Send</em> dabaiye. Nahi khula to neeche
              wale button se bhej dein. Order confirm hone par payment ki detail owner WhatsApp par bhejenge.
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#2f6b3f]" data-testid="checkout-email-note">
              Order ki poori detail aapke email par bhi pahunch jayegi — aur har update (confirm, packed, shipped,
              delivered) par nayi email aayegi.
            </p>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              data-testid="checkout-whatsapp-link"
              className="mt-2.5 inline-flex h-11 w-full items-center justify-center gap-2 bg-[#25D366] px-4 text-[10.5px] font-semibold tracking-[.12em] text-white uppercase sm:w-auto"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1a11.6 11.6 0 0 1-5.9-5.2c-.4-.7-.6-1.4-.6-2 0-.6.3-1.2.6-1.6.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.6l-.4.5c-.1.1-.2.3-.1.5a7.5 7.5 0 0 0 3.3 2.9c.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.4 0 .2 0 .9-.2 1.4Z" />
              </svg>
              Open WhatsApp again
            </a>
          </div>
        ) : null}

        {/* Main CTA — order WhatsApp par (owner wahin confirm karta hai) */}
        <button
          type="button"
          onClick={sendOrderOnWhatsApp}
          data-testid="checkout-whatsapp-send"
          className="mt-4 flex w-full items-center justify-center gap-2 bg-[#25D366] py-3.5 text-[11.5px] font-semibold tracking-[.14em] text-white uppercase transition hover:bg-[#1eb757]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1a11.6 11.6 0 0 1-5.9-5.2c-.4-.7-.6-1.4-.6-2 0-.6.3-1.2.6-1.6.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.6l-.4.5c-.1.1-.2.3-.1.5a7.5 7.5 0 0 0 3.3 2.9c.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.4 0 .2 0 .9-.2 1.4Z" />
          </svg>
          Send order on WhatsApp · {formatPrice(total)}
        </button>
        <p className="mt-1.5 text-center text-[10.5px] leading-relaxed text-[#8a7d72]">
          Detail (item link, colour, size, qty, address) pre-filled jaati hai — bas Send dabaiye.
        </p>

        <p className="mt-2 text-center text-[10.5px] leading-relaxed text-[#8a7d72]">
          Final price is already sale price — no coupon needed. By placing this order you agree to our{" "}
          <Link href="/policies/terms-and-conditions" className="underline">
            Terms &amp; Conditions
          </Link>
          ,{" "}
          <Link href="/policies/refund-and-return-policy" className="underline">
            Refund &amp; Return
          </Link>{" "}
          and{" "}
          <Link href="/policies/privacy-policy" className="underline">
            Privacy
          </Link>{" "}
          policies.
        </p>
      </aside>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  className = "",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  className?: string;
  inputMode?: "numeric" | "text" | "tel" | "email";
}) {
  return (
    <div className={className}>
      <label className="text-[10.5px] tracking-[.12em] text-[#6f6259] uppercase">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        inputMode={inputMode}
        className="mt-1 h-11 w-full border border-[#ded1c0] bg-white px-3 text-[13px] outline-none focus:border-[#6f1d2b]"
      />
    </div>
  );
}
