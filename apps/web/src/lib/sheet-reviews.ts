"use client";

/**
 * Reviews — Google Sheet se.
 *
 *   Submit  → `Reviews` tab me row (Status = pending, owner publish karega)
 *   Display → `?action=reviews&handle=…` sirf **published** reviews deta hai
 *             (naam, rating, title, text) — koi phone/email kabhi nahi.
 *
 * Sheet na mile to site ke apne (Trustoo sync) reviews hi dikhte hain.
 */

import { sheetWebAppUrl } from "./sheet-config";
import { relayRows } from "./sheet-relay";

export type SheetReview = {
  name: string;
  rating: number;
  title?: string;
  body: string;
  date?: string;
};

export function submitReview(input: {
  handle: string;
  productTitle: string;
  name: string;
  rating: number;
  body: string;
}): void {
  relayRows([
    {
      sheet: "Reviews",
      row: {
        Timestamp: new Date().toISOString(),
        Handle: input.handle,
        Product: input.productTitle,
        Name: input.name,
        Rating: input.rating,
        Title: "",
        Body: input.body,
        Status: "pending",
        Source: "website",
      },
    },
  ]);
}

export async function fetchPublishedReviews(handle: string): Promise<SheetReview[]> {
  const url = sheetWebAppUrl();
  if (!url || typeof window === "undefined") return [];
  try {
    const response = await fetch(`${url}?action=reviews&handle=${encodeURIComponent(handle)}`, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { ok?: boolean; reviews?: SheetReview[] };
    if (!body?.ok || !Array.isArray(body.reviews)) return [];
    return body.reviews.filter((review) => review && review.body);
  } catch {
    // CORS / offline — sirf local reviews
    return [];
  }
}
