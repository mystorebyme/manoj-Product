"use client";

import { useEffect } from "react";
import { flushSheetQueue, pendingRelayCount, sheetRelayEnabled } from "@/lib/sheet-relay";

/**
 * Page khulte hi jo rows sheet tak nahi pahunchi thi, unhe bhej deta hai.
 *
 * Kyun zaroori: customer ka internet kata, tab band hua, ya Apps Script thodi der
 * down tha — row browser ke localStorage queue me padi rehti hai. Ab har visit par
 * (aur wapas online hone par) khud retry hoti hai, isliye data gum nahi hota.
 */
export function SheetQueueBoot() {
  useEffect(() => {
    if (!sheetRelayEnabled() || pendingRelayCount() === 0) return;
    const send = () => void flushSheetQueue().catch(() => undefined);
    const timer = window.setTimeout(send, 1500);
    window.addEventListener("online", send);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", send);
    };
  }, []);

  return null;
}
