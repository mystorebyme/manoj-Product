"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { API_AVAILABLE, API_BASE, LIVE_STORE_URL } from "@/lib/api-base";
import { useStoreSettings } from "@/components/store-settings-provider";

/**
 * Order tracking form.
 *
 * Server wale build par seedha `/orders/<number>` khulta hai. GitHub Pages
 * (static preview) par order pages nahi hote — wahan form 404 par nahi bhejta,
 * live store ka direct link + WhatsApp support deta hai.
 */
export function TrackOrderForm() {
  const { whatsapp } = useStoreSettings();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<string | null>(null);
  /** live store reachable hai? — dead link dikhane se behtar honest message */
  const [liveStatus, setLiveStatus] = useState<"unknown" | "up" | "down">("unknown");
  const router = useRouter();
  const wa = whatsapp.replace(/\D/g, "").slice(-10);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const orderNumber = value.trim().toUpperCase();
    if (!orderNumber) {
      setError("Please enter your order number (for example LK-1A2B3C).");
      return;
    }
    if (!/^LK-[A-Z0-9]{4,12}$/.test(orderNumber)) {
      setError("Order numbers start with LK- followed by 4–12 letters or digits.");
      return;
    }
    setError(null);

    if (API_AVAILABLE) {
      router.push(`/orders/${encodeURIComponent(orderNumber)}`);
      return;
    }
    // static preview: /orders/* yahan exist nahi karta
    setResolved(orderNumber);
    setLiveStatus("unknown");
    // live store ka health check (2.5s) — down ho to link ki jagah WhatsApp batao
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2500);
    fetch(`${LIVE_STORE_URL}/api/health`, { signal: controller.signal, cache: "no-store" })
      .then((response) => setLiveStatus(response.ok ? "up" : "down"))
      .catch(() => setLiveStatus("down"))
      .finally(() => window.clearTimeout(timer));
  }

  return (
    <form onSubmit={submit} className="mt-4" data-testid="track-order-form">
      <label htmlFor="order-number" className="text-[10.5px] tracking-[.12em] text-[#6f6259] uppercase">
        Order number
      </label>
      <div className="mt-1 flex">
        <input
          id="order-number"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="LK-1A2B3C"
          autoComplete="off"
          className="h-11 w-full min-w-0 border border-[#ded1c0] bg-white px-3 text-[13px] outline-none focus:border-[#6f1d2b]"
        />
        <button
          type="submit"
          className="shrink-0 bg-[#6f1d2b] px-5 text-[10.5px] font-semibold tracking-[.14em] text-white uppercase"
        >
          Track
        </button>
      </div>
      {error ? <p className="mt-1.5 text-[11.5px] text-[#b3261e]">{error}</p> : null}

      {resolved ? (
        <div className="mt-4 border border-[#e6d3a8] bg-[#fdf9ee] p-4" data-testid="track-static-help">
          <p className="text-[12.5px] leading-relaxed text-[#3d332c]">
            <strong>{resolved}</strong> — tracking status (payment, courier aur AWB) WhatsApp par turant
            milta hai. Neeche se order number bhejiye:
          </p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {API_BASE ? (
              liveStatus === "down" ? (
                <span className="inline-flex h-10 items-center bg-[#f1e6d8] px-4 text-[10.5px] font-semibold tracking-[.12em] text-[#7b5a2a] uppercase">
                  Live store abhi offline hai
                </span>
              ) : (
                <a
                  href={`${LIVE_STORE_URL}/orders/${encodeURIComponent(resolved)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center bg-[#6f1d2b] px-4 text-[10.5px] font-semibold tracking-[.12em] text-white uppercase"
                >
                  {liveStatus === "up" ? "Open live tracking" : "Open live tracking ↗"}
                </a>
              )
            ) : null}
            <a
              href={`https://wa.me/91${wa}?text=${encodeURIComponent(`Hi TRENDS YOUNIQUE, please share the status of order ${resolved}.`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center bg-[#25D366] px-4 text-[10.5px] font-semibold tracking-[.12em] text-white uppercase"
            >
              WhatsApp us
            </a>
          </div>
          <p className="mt-2 text-[11px] text-[#8a7d72]">
            Ya <Link href="/pages/contact" className="underline">contact page</Link> se message bhejiye — team
            status reply karti hai.
          </p>
        </div>
      ) : null}
    </form>
  );
}
