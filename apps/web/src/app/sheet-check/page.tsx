import type { Metadata } from "next";
import { SheetCheckClient } from "@/components/sheet-check-client";

/**
 * Diagnostics page — owner ke liye. Search me nahi aani chahiye (isi liye noindex),
 * kyunki isme Apps Script URL aur token ka hissa dikhta hai.
 */
export const metadata: Metadata = {
  title: "Google Sheet connection test",
  description: "Owner-only diagnostics: browser se Google Sheet tak ka write path test karta hai.",
  robots: { index: false, follow: false, nocache: true },
};

export default function SheetCheckPage() {
  return <SheetCheckClient />;
}
