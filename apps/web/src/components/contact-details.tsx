"use client";

import { useStoreSettings } from "@/components/store-settings-provider";

/**
 * Contact details — owner ki Google Sheet / admin settings se (real time).
 * Sheet me number badla -> site par bhi badal jaata hai, redeploy nahi.
 */
export function ContactDetails() {
  const { whatsapp, supportPhone, supportEmail } = useStoreSettings();
  const wa = whatsapp.replace(/\D/g, "").slice(-10);

  return (
    <div className="grid gap-3 sm:grid-cols-3" data-testid="contact-details">
      <a
        href={`https://wa.me/91${wa}`}
        target="_blank"
        rel="noreferrer"
        className="flex flex-col gap-1 border border-[#ece1d3] bg-white p-4 transition hover:border-[#6f1d2b]"
      >
        <span className="text-[10px] tracking-[.14em] text-[#a3948a] uppercase">WhatsApp</span>
        <span className="text-[14px] font-medium break-words text-[#6f1d2b]">{whatsapp}</span>
      </a>
      <a
        href={`tel:${supportPhone.replace(/[^\d+]/g, "")}`}
        className="flex flex-col gap-1 border border-[#ece1d3] bg-white p-4 transition hover:border-[#6f1d2b]"
      >
        <span className="text-[10px] tracking-[.14em] text-[#a3948a] uppercase">Call</span>
        <span className="text-[14px] font-medium break-words">{supportPhone}</span>
      </a>
      <a
        href={`mailto:${supportEmail}`}
        className="flex flex-col gap-1 border border-[#ece1d3] bg-white p-4 transition hover:border-[#6f1d2b]"
      >
        <span className="text-[10px] tracking-[.14em] text-[#a3948a] uppercase">Email</span>
        <span className="text-[14px] font-medium break-all">{supportEmail}</span>
      </a>
      <p className="text-[12px] text-[#6f6259] sm:col-span-3">
        Customer care hours: Monday to Saturday, 10:00 AM – 8:00 PM IST
      </p>
    </div>
  );
}

/** Compact WhatsApp + email row (track page, order page ke liye) */
export function SupportChannels({ className = "" }: { className?: string }) {
  const { whatsapp, supportEmail } = useStoreSettings();
  const wa = whatsapp.replace(/\D/g, "").slice(-10);
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <a
        href={`https://wa.me/91${wa}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-9 items-center gap-1.5 bg-[#25D366] px-3 text-[10.5px] font-semibold tracking-[.1em] text-white uppercase"
      >
        WhatsApp {whatsapp}
      </a>
      <a
        href={`mailto:${supportEmail}`}
        className="inline-flex h-9 items-center border border-[#6f1d2b] px-3 text-[10.5px] font-semibold tracking-[.1em] text-[#6f1d2b] uppercase"
      >
        Email us
      </a>
    </div>
  );
}
