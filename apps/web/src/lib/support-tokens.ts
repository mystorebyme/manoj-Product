/**
 * Support detail tokens.
 *
 * Policy pages aur static content me number/email **hardcode nahi** hote.
 * Text me token likha jaata hai aur render ke waqt live settings se bharte hain:
 *
 *   {{whatsapp}}  → 77409 92663      (Google Sheet Settings → whatsapp)
 *   {{phone}}     → +91 77409 92663  (Settings → support_phone)
 *   {{email}}     → care@trendsyounique.com
 *
 * Isliye owner sheet me number badalte hi policy pages par bhi naya number
 * aata hai — koi redeploy nahi.
 */

export type SupportTokenValues = {
  whatsapp?: string;
  supportPhone?: string;
  supportEmail?: string;
};

/** `7740992663` / `+91 7740992663` → `77409 92663` */
export function prettyWhatsapp(value?: string): string {
  const digits = String(value ?? "").replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return String(value ?? "").trim();
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/** `7740992663` → `+91 77409 92663` */
export function prettyPhone(value?: string): string {
  const pretty = prettyWhatsapp(value);
  return /^\d{5} \d{5}$/.test(pretty) ? `+91 ${pretty}` : String(value ?? "").trim();
}

/** wa.me link ke liye sirf digits (91 + 10 digit) */
export function whatsappDigits(value?: string): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length > 10) return digits;
  return digits.length === 10 ? `91${digits}` : digits;
}

export function fillSupportTokens(text: string, values: SupportTokenValues): string {
  return String(text)
    .replace(/\{\{\s*whatsapp\s*\}\}/gi, prettyWhatsapp(values.whatsapp))
    .replace(/\{\{\s*phone\s*\}\}/gi, prettyPhone(values.supportPhone ?? values.whatsapp))
    .replace(/\{\{\s*email\s*\}\}/gi, String(values.supportEmail ?? "").trim());
}
