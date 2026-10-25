"use client";

import { readJson } from "@/lib/http-json";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { API_AVAILABLE, apiUrl } from "@/lib/api-base";
import { fetchSheetPublicSettings } from "@/lib/sheet-public-settings";

/**
 * Owner-editable store details (phone, WhatsApp, email, UPI ID, announcement).
 *
 * Source: admin settings (Postgres/JSON) + owner ki Google Sheet — server
 * `/api/settings` par merge karke deta hai. Client 60s me ek baar refresh karta
 * hai, isliye owner sheet me number badale to site thodi der me update ho jaati hai.
 *
 * API na ho (GitHub Pages static preview) to settings seedha **Google Sheet** ke
 * `Settings` tab se aati hain (`?action=public`) — owner wahan number/announcement
 * badalta hai aur site 1 minute me update ho jaati hai, redeploy ke bina.
 * Sheet bhi na mile to niche wale defaults dikhte hain — layout tootta nahi.
 */
export type PublicSettings = {
  announcement: string;
  upiId: string;
  upiName: string;
  supportPhone: string;
  supportEmail: string;
  whatsapp: string;
  freeShipping: boolean;
  /** owner sheet se quantity limits */
  maxQtyPerItem?: number;
  maxQtyBulk?: number;
  maxQtyPerOrder?: number;
  brandName?: string;
  tagline?: string;
  updatedAt?: string;
};

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  announcement: "",
  upiId: "dhakadgourav@fam",
  upiName: "TRENDS YOUNIQUE",
  supportPhone: "8005900581",
  supportEmail: "care@trendsyounique.com",
  whatsapp: "8005900581",
  freeShipping: true,
  maxQtyPerItem: 10,
  maxQtyBulk: 30,
  maxQtyPerOrder: 15,
  brandName: "TRENDS YOUNIQUE",
};

type ContextValue = {
  settings: PublicSettings;
  refresh: () => Promise<void>;
  /** pehli fetch ho chuki (defaults vs live farq batane ke liye) */
  ready: boolean;
};

const StoreSettingsContext = createContext<ContextValue>({
  settings: DEFAULT_PUBLIC_SETTINGS,
  refresh: async () => undefined,
  ready: false,
});

export function StoreSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
  const [ready, setReady] = useState(false);

  /** Sheet ke Settings tab se live values (server na ho tab bhi owner control rakhe) */
  const mergeSheetSettings = useCallback(async () => {
    const live = await fetchSheetPublicSettings();
    if (!live) return;
    setSettings((current) =>
      ({
        ...current,
        ...Object.fromEntries(
          Object.entries(live).filter(([, value]) => value !== undefined && value !== "" && value !== null),
        ),
      }) as PublicSettings,
    );
  }, []);

  const refresh = useCallback(async () => {
    if (!API_AVAILABLE) {
      await mergeSheetSettings();
      setReady(true);
      return;
    }
    try {
      const response = await fetch(apiUrl("/api/settings"), { cache: "no-store" });
      if (!response.ok) return;
      const parsed = await readJson<{ data?: Partial<PublicSettings> }>(response);
      const data = parsed.data?.data;
      if (!data) return;
      setSettings((current) => ({
        ...current,
        ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== "")),
      }) as PublicSettings);
    } catch {
      // offline / API down — sheet se try karo, warna defaults
      await mergeSheetSettings();
    } finally {
      setReady(true);
    }
  }, [mergeSheetSettings]);

  useEffect(() => {
    void refresh();
    // static hosting par bhi 60s refresh (sheet se live settings), warna kuch nahi
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <StoreSettingsContext.Provider value={{ settings, refresh, ready }}>{children}</StoreSettingsContext.Provider>
  );
}

export function useStoreSettings(): PublicSettings {
  return useContext(StoreSettingsContext).settings;
}

export function useStoreSettingsState(): ContextValue {
  return useContext(StoreSettingsContext);
}
