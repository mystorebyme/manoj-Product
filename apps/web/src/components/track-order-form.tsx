"use client";

import { useState } from "react";
import { useStoreSettings } from "@/components/store-settings-provider";
import { SafeImage } from "@/components/safe-image";
import { imageUrl } from "@/lib/format";
import {
  ORDER_STEPS,
  groupOrderUpdates,
  stepIndex,
  trackOrder,
  type OrderTrackResult,
} from "@/lib/sheet-orders";

const STEP_COPY: Record<string, { label: string; hint: string }> = {
  placed: { label: "Order placed", hint: "Aapka order site par aaya" },
  confirmed: { label: "Confirmed", hint: "Team ne order confirm kiya" },
  packed: { label: "Packed", hint: "Item pack ho gaya" },
  shipped: { label: "Shipped", hint: "Courier ko diya gaya" },
  delivered: { label: "Delivered", hint: "Aap tak pahunch gaya" },
};

function formatWhen(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
    " · " +
    date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

/**
 * Order tracking — **sab kuch Google Sheet se**.
 *
 * Customer order number + apna mobile daalta hai. Sheet ke `Orders` tab se
 * status/courier/AWB, `Order Items` se items aur `Order Updates` se team ke
 * messages aate hain. Owner sheet me kuch bhi badale, yahan turant dikhta hai.
 */
export function TrackOrderForm() {
  const { whatsapp } = useStoreSettings();
  const [order, setOrder] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderTrackResult | null>(null);
  const wa = whatsapp.replace(/\D/g, "").slice(-10);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    const wanted = order.trim().toUpperCase();
    if (!wanted) {
      setError("Order number daaliye (jaise LK-1A2B3C).");
      return;
    }
    if (phone.replace(/\D/g, "").length !== 10) {
      setError("Order ke waqt diya 10 digit mobile number daaliye.");
      return;
    }
    setBusy(true);
    const answer = await trackOrder(wanted, phone);
    setBusy(false);
    if (!answer.ok) {
      setError(answer.error ?? "Order nahi mila.");
      return;
    }
    setResult(answer);
  }

  const current = result?.order ? stepIndex(result.order.status) : -1;
  const cancelled = current === -1;
  const groups = groupOrderUpdates(result?.updates ?? []);
  const groupedCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div data-testid="track-order-form">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label htmlFor="order-number" className="text-[10.5px] tracking-[.12em] text-[#6f6259] uppercase">
            Order number
          </label>
          <input
            id="order-number"
            value={order}
            onChange={(event) => setOrder(event.target.value)}
            placeholder="LK-1A2B3C"
            autoComplete="off"
            className="mt-1 h-11 w-full border border-[#ded1c0] bg-white px-3 text-[13px] outline-none focus:border-[#6f1d2b]"
          />
        </div>
        <div>
          <label htmlFor="order-phone" className="text-[10.5px] tracking-[.12em] text-[#6f6259] uppercase">
            Registered mobile
          </label>
          <input
            id="order-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            placeholder="98XXXXXXXX"
            autoComplete="tel"
            className="mt-1 h-11 w-full border border-[#ded1c0] bg-white px-3 text-[13px] outline-none focus:border-[#6f1d2b]"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="h-11 self-end bg-[#6f1d2b] px-6 text-[10.5px] font-semibold tracking-[.14em] text-white uppercase disabled:opacity-60"
        >
          {busy ? "Checking…" : "Track"}
        </button>
      </form>

      {error ? (
        <div className="mt-4 border border-[#e2c7c0] bg-[#fdf4f2] p-4 text-[12.5px] text-[#a11d1d]" data-testid="track-error">
          <p>{error}</p>
          <a
            href={`https://wa.me/91${wa}?text=${encodeURIComponent(
              `Hi TRENDS YOUNIQUE, order ${order || "—"} ka status bata dijiye.`,
            )}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex h-9 items-center bg-[#25D366] px-4 text-[10.5px] font-semibold tracking-[.12em] text-white uppercase"
          >
            WhatsApp par poochhein
          </a>
        </div>
      ) : null}

      {result?.order ? (
        <div className="mt-6" data-testid="track-result">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ece1d3] pb-3">
            <div>
              <p className="text-[10px] tracking-[.16em] text-[#a3948a] uppercase">Order</p>
              <p className="font-display text-[20px] text-[#6f1d2b]">{result.order.orderNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] tracking-[.16em] text-[#a3948a] uppercase">Current status</p>
              <p className={`text-[13px] font-semibold ${cancelled ? "text-[#a11d1d]" : "text-[#2f7a3f]"}`}>
                {cancelled
                  ? "Cancelled / Return"
                  : STEP_COPY[ORDER_STEPS[Math.max(0, current)]!]?.label ?? result.order.status}
              </p>
            </div>
          </div>

          {/* 5 step timeline — sheet ke Status column se */}
          <ol className="mt-5 grid grid-cols-5 gap-1" data-testid="track-steps">
            {ORDER_STEPS.map((step, index) => {
              const done = !cancelled && current >= index;
              const active = !cancelled && current === index;
              const stamp = (result.updates ?? []).find((update) => stepIndex(update.status) === index);
              return (
                <li key={step} className="flex flex-col items-center text-center">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${
                      done ? "bg-[#6f1d2b] text-white" : "bg-[#efe7dd] text-[#a49a90]"
                    } ${active ? "ring-2 ring-[#c8a75f] ring-offset-2" : ""}`}
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  <span className="mt-1.5 text-[9.5px] leading-tight tracking-[.06em] text-[#6f6259] uppercase">
                    {STEP_COPY[step]?.label ?? step}
                  </span>
                  {stamp?.at ? (
                    <span className="mt-0.5 text-[9px] text-[#a49a90]">{formatWhen(stamp.at)}</span>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {result.order.note ? (
            <div className="mt-5 border-l-2 border-[#6f1d2b] bg-[#faf6f2] px-4 py-3">
              <p className="text-[10.5px] font-semibold tracking-[.14em] text-[#6f1d2b] uppercase">
                Team ka message
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[#4a423b]">{result.order.note}</p>
            </div>
          ) : null}

          {groupedCount ? (
            <div className="mt-5 space-y-2.5" data-testid="track-updates">
              <p className="text-[10px] tracking-[.16em] text-[#a3948a] uppercase">
                Team ke updates (sheet se)
              </p>
              {groups.map((group) => {
                const done = !cancelled && current >= group.step;
                const label = STEP_COPY[group.key]?.label ?? group.key;
                return (
                  <div key={group.key} className="border border-[#ece1d3] bg-[#fdfaf5]">
                    <div className="flex items-center justify-between gap-2 border-b border-[#f1e7da] px-4 py-2">
                      <p className="text-[11px] font-semibold tracking-[.1em] text-[#6f1d2b] uppercase">
                        {group.step + 1}. {label}
                      </p>
                      <span
                        className={`text-[9.5px] tracking-[.1em] uppercase ${done ? "text-[#2f7a3f]" : "text-[#a49a90]"}`}
                      >
                        {done ? "✓ Done" : "Pending"}
                      </span>
                    </div>
                    <ul className="divide-y divide-[#f4ece1]">
                      {group.items.slice(0, 3).map((item, index) => (
                        <li key={`${group.key}-${index}-${item.at}`} className="px-4 py-2.5">
                          {item.at ? (
                            <p className="text-[9.5px] tracking-[.1em] text-[#a49a90] uppercase">
                              {formatWhen(item.at)}
                            </p>
                          ) : null}
                          <p className="mt-0.5 text-[12px] leading-relaxed text-[#4a423b]">
                            {item.message || label}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : null}

          {result.order.courier || result.order.awb ? (
            <div className="mt-4 border border-[#ece1d3] p-4 text-[12.5px] text-[#3d332c]">
              <p>
                Courier: <strong>{result.order.courier || "—"}</strong>
                <br />
                AWB / Tracking no: <strong>{result.order.awb || "—"}</strong>
              </p>
              {result.order.trackingUrl ? (
                <a
                  href={result.order.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-[11px] font-semibold tracking-[.12em] text-[#6f1d2b] uppercase underline"
                >
                  Courier site par track karein ↗
                </a>
              ) : null}
            </div>
          ) : null}

          {(result.items ?? []).length ? (
            <div className="mt-4 border border-[#ece1d3]">
              <p className="border-b border-[#ece1d3] px-4 py-2.5 text-[10px] tracking-[.16em] text-[#a3948a] uppercase">
                Items ({result.order.qty || result.items!.length})
              </p>
              <ul className="divide-y divide-[#f2e9dd]">
                {result.items!.map((item, index) => (
                  <li key={`${item.handle}-${item.size}-${index}`} className="flex gap-3 p-3">
                    <div className="h-20 w-14 shrink-0 overflow-hidden bg-[#f6f1ec]">
                      {item.image ? (
                        <SafeImage
                          src={imageUrl(item.image, 240)}
                          alt={item.product}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-medium text-[#3d332c]">{item.product}</p>
                      <p className="text-[11px] text-[#8a7d72]">
                        {[item.colour, item.size].filter(Boolean).join(" · ")} · Qty {item.qty}
                      </p>
                      <p className="text-[11px] text-[#6f6259]">
                        Rs. {Math.round(item.price).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-4 text-[11px] text-[#8a7d72]" data-testid="track-source">
            Status seedha store ke Google Sheet se aata hai — team jo update karti hai, wahi yahan dikhta hai.
          </p>
        </div>
      ) : null}
    </div>
  );
}
