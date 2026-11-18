"use client";

import type { ReactNode } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { fillSupportTokens, prettyPhone, prettyWhatsapp, whatsappDigits } from "@/lib/support-tokens";
import { useStoreSettings } from "@/components/store-settings-provider";

/**
 * Support text jo **live settings** se bharta hai.
 *
 * Owner Google Sheet ke `Settings` tab me WhatsApp/phone/email badalta hai →
 * policy page, contact page aur footer ka text khud badal jaata hai
 * (`{{whatsapp}}`, `{{phone}}`, `{{email}}` tokens).
 */
export function SupportText({ text, className }: { text: string; className?: string }) {
  const { whatsapp, supportPhone, supportEmail } = useStoreSettings();
  return <span className={className}>{fillSupportTokens(text, { whatsapp, supportPhone, supportEmail })}</span>;
}

/** WhatsApp CTA button — number live settings se, hardcode nahi */
export function SupportWhatsAppLink({
  label,
  message = "",
  className = "",
}: {
  /** na do to live WhatsApp number hi label ban jaata hai */
  label?: string;
  message?: string;
  className?: string;
}) {
  const { whatsapp } = useStoreSettings();
  const suffix = message ? `?text=${encodeURIComponent(message)}` : "";
  return (
    <a
      href={`https://wa.me/${whatsappDigits(whatsapp)}${suffix}`}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      {label && label.length > 0 ? label : prettyWhatsapp(whatsapp)}
    </a>
  );
}

/** Policy markdown — tokens bharke render (settings live) */
export function SettingsMarkdown({ markdown }: { markdown: string }) {
  const { whatsapp, supportPhone, supportEmail } = useStoreSettings();
  const filled = fillSupportTokens(markdown, { whatsapp, supportPhone, supportEmail });
  return <>{renderMarkdown(filled) as ReactNode}</>;
}

/** Sirf live support phone number (label ke andar use karne ke liye) */
export function SupportPhone({ format = "pretty" }: { format?: "pretty" | "raw" }) {
  const { whatsapp, supportPhone } = useStoreSettings();
  const value = supportPhone || whatsapp;
  return <>{format === "raw" ? String(value).trim() : prettyPhone(value)}</>;
}
