"use client";

import { useState } from "react";
import { postJson } from "@/lib/http-json";
import { relayMessageToSheet } from "@/lib/sheet-relay";
import { apiUrl } from "@/lib/api-base";
import { DEFAULT_PUBLIC_SETTINGS, useStoreSettings } from "@/components/store-settings-provider";

/** fallback — live value Google Sheet / admin settings se aati hai (`Settings` tab) */
const FALLBACK_WHATSAPP = DEFAULT_PUBLIC_SETTINGS.whatsapp;

/**
 * WhatsApp fallback — website par support **email nahi** dikhta (owner ki request).
 * Server/API fail ho to customer seedha WhatsApp par hi message bhej deta hai.
 */
function whatsappHref(
  form: { name: string; email: string; phone: string; subject: string; message: string },
  whatsapp: string,
) {
  const body = [
    `*${form.subject}*`,
    form.name ? `Name: ${form.name}` : "",
    form.phone ? `Phone: ${form.phone}` : "",
    form.email ? `Email: ${form.email}` : "",
    "",
    form.message,
  ]
    .filter(Boolean)
    .join("\n");
  return `https://wa.me/91${whatsapp.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(body)}`;
}

export function ContactForm() {
  const { whatsapp } = useStoreSettings();
  const SUPPORT_WHATSAPP = whatsapp || FALLBACK_WHATSAPP;
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "Order enquiry", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setError(null);
    const message = { ...form };

    // 1) SABSE PEHLE sheet — sheet write kisi bhi API jawab par depend nahi karta.
    //    (Pehle ye API ke baad chalta tha; API slow/hang ho to message sheet me
    //    pahunchta hi nahi tha — wahi bug owner ko dikha.)
    relayMessageToSheet(message);

    // 2) Uske baad email/server copy (best effort — fail ho to bhi message safe hai)
    setForm({ name: "", email: "", phone: "", subject: "Order enquiry", message: "" });
    try {
      const result = await postJson<{ error?: string }>(apiUrl("/api/contact"), message);
      if (result.error) setError(null);
    } catch {
      /* server na ho to bhi message sheet me ja chuka hai */
    }
    setStatus("done");
  }

  if (status === "done") {
    return (
      <div className="border border-[#d6e8d9] bg-[#f2f8f3] p-6 text-center" data-testid="contact-success">
        <p className="font-display text-[21px] text-[#2f7a3f]">Message received!</p>
        <p className="mt-1 text-[12.5px] text-[#3d332c]">
          Our team will reply within 24 hours. For an instant reply, WhatsApp us on {SUPPORT_WHATSAPP}.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <a
            href={`https://wa.me/91${SUPPORT_WHATSAPP}?text=${encodeURIComponent("Hi TRENDS YOUNIQUE, I sent a message from the website.")}`}
            target="_blank"
            rel="noreferrer"
            className="bg-[#25d366] px-4 py-2 text-[11px] font-semibold tracking-[.12em] text-white uppercase"
          >
            WhatsApp us
          </a>

        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border border-[#ece1d3] bg-[#fdfaf5] p-5 sm:p-6">
      <h2 className="font-display text-[21px] font-medium text-[#6f1d2b]">Send us a message</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Your name *"
          className="h-11 w-full border border-[#ded1c0] bg-white px-3 text-[13px] outline-none focus:border-[#6f1d2b]"
        />
        <input
          required
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="Email *"
          className="h-11 w-full border border-[#ded1c0] bg-white px-3 text-[13px] outline-none focus:border-[#6f1d2b]"
        />
        <input
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
          placeholder="Phone / WhatsApp"
          className="h-11 w-full border border-[#ded1c0] bg-white px-3 text-[13px] outline-none focus:border-[#6f1d2b]"
        />
        <select
          value={form.subject}
          onChange={(event) => setForm({ ...form, subject: event.target.value })}
          className="h-11 w-full border border-[#ded1c0] bg-white px-3 text-[13px] outline-none focus:border-[#6f1d2b]"
        >
          {["Order enquiry", "Sizing help", "Return request", "Bulk / wholesale", "Other"].map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <textarea
          required
          rows={4}
          value={form.message}
          onChange={(event) => setForm({ ...form, message: event.target.value })}
          placeholder="How can we help? *"
          className="w-full border border-[#ded1c0] bg-white px-3 py-2.5 text-[13px] outline-none focus:border-[#6f1d2b] sm:col-span-2"
        />
      </div>
      {error ? (
        <div className="mt-2 text-[11.5px] text-[#b3261e]" role="alert">
          <p>{error}</p>
          {/* honest fallback — static preview / server down par message kho na jaye */}
          <p className="mt-1 text-[#3d332c]">
            Aap seedha{" "}
            <a href={whatsappHref(form, SUPPORT_WHATSAPP)} target="_blank" rel="noreferrer" className="underline">
              WhatsApp {SUPPORT_WHATSAPP}
            </a>{" "}
            par bhi bhej sakte hain.
          </p>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status === "loading"}
          data-testid="contact-submit"
          className="bg-[#6f1d2b] px-7 py-3 text-[11px] font-semibold tracking-[.16em] text-white uppercase disabled:opacity-60"
        >
          {status === "loading" ? "Sending…" : "Send message"}
        </button>
        <a
          href={whatsappHref(form, SUPPORT_WHATSAPP)}
          target="_blank"
          rel="noreferrer"
          data-testid="contact-whatsapp"
          className="text-[11.5px] text-[#3d332c] underline decoration-[#c9b9a8] underline-offset-4 hover:text-[#6f1d2b]"
        >
          or WhatsApp {SUPPORT_WHATSAPP}
        </a>
      </div>
    </form>
  );
}
