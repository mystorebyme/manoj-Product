"use client";

/**
 * Product ki **main photo Sheet se**.
 *
 * Owner `MainImage` tab me `Handle` + `Image URL` daalta hai, aur site us
 * product ki pehli photo wahi dikhati hai (home rails, collection cards,
 * product page — sab jagah). Kuch na daala ho to catalog ki apni photo.
 *
 *   Sheet `MainImage`     →  ?action=products_public  →  { handle: imageUrl }
 *   Sheet `ProductImages` →  ?action=images_public    →  { handle: { "1": url, "3": "delete" } }
 *
 * `ProductImages` se admin kisi bhi photo ko **badal** (naya URL), **hata**
 * (`delete`) ya **jod** (nayi position) sakta hai — site turant wahi gallery dikhati hai.
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

/* ───────────────────── saari photos (ProductImages tab) ───────────────────── */

/** ek product ke liye position → image URL ya "delete" */
export type GalleryOverrides = Record<string, string>;

const GALLERY_CACHE_KEY = "trends:product-images:v1";
let galleryMemory: { at: number; items: Record<string, GalleryOverrides> } | null = null;
let galleryInflight: Promise<Record<string, GalleryOverrides>> | null = null;

function readGalleryCache(): { at: number; items: Record<string, GalleryOverrides> } | null {
  if (galleryMemory) return galleryMemory;
  try {
    const raw = window.localStorage.getItem(GALLERY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; items: Record<string, GalleryOverrides> };
    if (!parsed?.items || typeof parsed.items !== "object") return null;
    galleryMemory = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export async function fetchProductImageOverrides(): Promise<Record<string, GalleryOverrides>> {
  if (typeof window === "undefined") return {};
  const cached = readGalleryCache();
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.items;
  if (galleryInflight) return galleryInflight;

  const url = sheetWebAppUrl();
  if (!/^https:\/\/script\.google\.com\//.test(url)) return cached?.items ?? {};

  galleryInflight = (async () => {
    try {
      const response = await fetch(`${url}?action=images_public`, { cache: "no-store" });
      if (!response.ok) return cached?.items ?? {};
      const body = (await response.json()) as {
        ok?: boolean;
        items?: Record<string, Record<string, unknown>>;
      };
      if (!body?.ok || !body.items) return cached?.items ?? {};
      const items: Record<string, GalleryOverrides> = {};
      for (const [handle, positions] of Object.entries(body.items)) {
        if (!handle || !positions || typeof positions !== "object") continue;
        const clean: GalleryOverrides = {};
        for (const [position, value] of Object.entries(positions)) {
          const slot = Number(position);
          if (!Number.isFinite(slot) || slot < 1) continue;
          const text = String(value ?? "").trim();
          if (text === "delete") clean[String(slot)] = "delete";
          else {
            const image = cleanImageUrl(text);
            if (image) clean[String(slot)] = image;
          }
        }
        if (Object.keys(clean).length) items[handle] = clean;
      }
      galleryMemory = { at: Date.now(), items };
      try {
        window.localStorage.setItem(GALLERY_CACHE_KEY, JSON.stringify(galleryMemory));
      } catch {
        /* storage band */
      }
      return items;
    } catch {
      return cached?.items ?? {};
    } finally {
      galleryInflight = null;
    }
  })();

  return galleryInflight;
}

/**
 * Catalog ki photos + sheet ke overrides.
 *   position ka naya URL  → wo photo replace
 *   position = "delete"   → wo photo hat gayi
 *   nayi position         → gallery ke aakhir me jud gayi
 */
export function mergeGallery(fallback: string[], overrides?: GalleryOverrides): string[] {
  if (!overrides || !Object.keys(overrides).length) return fallback;
  const positions = Object.keys(overrides)
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!positions.length) return fallback;
  const last = Math.max(fallback.length, ...positions);
  const out: string[] = [];
  for (let position = 1; position <= last; position += 1) {
    const override = overrides[String(position)];
    if (override === "delete") continue;
    if (override) {
      out.push(override);
      continue;
    }
    const original = fallback[position - 1];
    if (original) out.push(original);
  }
  return out.length ? out : fallback;
}

/** ek product ki poori gallery — sheet me rows hain to wahi, warna catalog */
export function useSheetGallery(handle: string, fallback: string[]): string[] {
  const [images, setImages] = useState(fallback);

  useEffect(() => {
    let alive = true;
    void fetchProductImageOverrides().then((items) => {
      const overrides = items[handle];
      if (alive && overrides) setImages(mergeGallery(fallback, overrides));
    });
    return () => {
      alive = false;
    };
    // fallback array har render par naya ho sakta hai — isliye join ko dependency banaya
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, fallback.join("|")]);

  return images;
}
