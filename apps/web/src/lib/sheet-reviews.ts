"use client";

/**
 * Reviews — Google Sheet se.
 *
 *   Submit  → `Reviews` tab me row (Status = pending, owner sheet se approve karega)
 *   Display → `?action=reviews&handle=…` sirf **approved** reviews deta hai
 *             (naam, rating, title, text) — koi phone/email kabhi nahi.
 *
 * Har review ke saath **product id** bhi jaata hai (`Product ID` column), kyunki
 * handle lambe hote hain aur badal bhi sakte hain. Sheet me review likhte waqt
 * sirf ID daalni pade to bhi site us review ko sahi product par dikha deti hai.
 *
 * Approval: Status `publish` / `approved` = site par live. Khaali ya `pending` =
 * chhupa hua (owner approve karega tabhi dikhega).
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
  /** product ki stable id (sheet ka `Product ID` column) */
  productId?: string;
  /** review kis product par hai (sheet ka `Handle`) */
  handle?: string;
};

type SheetReviewPayload = {
  ok?: boolean;
  reviews?: SheetReview[];
  version?: string;
};

async function requestReviews(query: string): Promise<SheetReview[]> {
  const url = sheetWebAppUrl();
  if (!url || typeof window === "undefined") return [];
  try {
    const response = await fetch(`${url}?${query}`, { cache: "no-store" });
    if (!response.ok) return [];
    const body = (await response.json()) as SheetReviewPayload;
    if (!body?.ok || !Array.isArray(body.reviews)) return [];
    return body.reviews.filter((review) => review && review.body);
  } catch {
    // CORS / offline — sirf local reviews
    return [];
  }
}

export function submitReview(input: {
  handle: string;
  productId?: string;
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
        "Product ID": input.productId ?? "",
      },
    },
  ]);
}

/** ek product ke approved reviews (handle ya product id se) */
export async function fetchPublishedReviews(handle: string, productId?: string): Promise<SheetReview[]> {
  const query = new URLSearchParams({ action: "reviews", handle });
  if (productId) query.set("id", productId);
  return requestReviews(query.toString());
}

/** home page ticker ke liye — saare products ke approved reviews, naye pehle */
export async function fetchAllPublishedReviews(limit = 60): Promise<SheetReview[]> {
  return requestReviews(new URLSearchParams({ action: "reviews_all", limit: String(limit) }).toString());
}
