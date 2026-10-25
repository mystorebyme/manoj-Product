"use client";

/**
 * Product ki **main photo Sheet se**.
 *
 * Owner `MainImage` tab me `Handle` + `Image URL` daalta hai, aur site us
 * product ki pehli photo wahi dikhati hai (home rails, collection cards,
 * product page — sab jagah). Kuch na daala ho to catalog ki apni photo.
 *
 *   Sheet `MainImage`  →  ?action=products_public  →  { handle: imageUrl }
 *
 * Cache 5 minute ka (localStorage) — isliye har page par network call nahi
 * jaati, aur sheet badalne par thodi der me site par asar dikhta hai.
 */

import { useEffect, useState } from "react";
import { sheetWebAppUrl } from "./sheet-config";

const CACHE_KEY = "trends:main-images:v1";
const CACHE_TTL = 5 * 60 * 1000;

export type MainImageMap = Record<string, string>;

type Cached = { at: number; images: MainImageMap };

let memory: Cached | null = null;
let inflight: Promise<MainImageMap> | null = null;

function readCache(): Cached | null {
  if (memory) return memory;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    if (!parsed?.images || typeof parsed.images !== "object") return null;
    memory = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(images: MainImageMap) {
  memory = { at: Date.now(), images };
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(memory));
  } catch {
    /* storage band — koi baat nahi */
  }
}

/** sirf http(s) image links — sheet me galat text ho to fallback hi rahega */
function cleanImageUrl(value: unknown): string | null {
  const url = String(value ?? "").trim();
  if (!/^https?:\/\//i.test(url) || /\s/.test(url)) return null;
  return url;
}

export async function fetchMainImages(): Promise<MainImageMap> {
  if (typeof window === "undefined") return {};
  const cached = readCache();
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.images;
  if (inflight) return inflight;

  const url = sheetWebAppUrl();
  if (!/^https:\/\/script\.google\.com\//.test(url)) return cached?.images ?? {};

  inflight = (async () => {
    try {
      const response = await fetch(`${url}?action=products_public`, { cache: "no-store" });
      if (!response.ok) return cached?.images ?? {};
      const body = (await response.json()) as { ok?: boolean; images?: Record<string, unknown> };
      if (!body?.ok || !body.images) return cached?.images ?? {};
      const images: MainImageMap = {};
      for (const [handle, value] of Object.entries(body.images)) {
        const clean = cleanImageUrl(value);
        if (handle && clean) images[handle] = clean;
      }
      writeCache(images);
      return images;
    } catch {
      return cached?.images ?? {};
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** ek product ki main image — sheet se aayi ho to wahi, warna catalog wali */
export function useSheetMainImage(handle: string, fallback: string): string {
  const [image, setImage] = useState(fallback);

  useEffect(() => {
    let alive = true;
    void fetchMainImages().then((images) => {
      const override = images[handle];
      if (alive && override) setImage(override);
    });
    return () => {
      alive = false;
    };
  }, [handle]);

  return image;
}
