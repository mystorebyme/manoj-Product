"use client";

/**
 * Home ka review ticker — **har 1 second** next review (owner ki requirement).
 *
 * Item list server se aata hai (Trustoo sync) + mount ke baad Google Sheet ke
 * **approved** reviews (`?action=reviews_all`) bhi jud jaate hain — isliye sheet
 * me approve kiya hua naya review bhi apne aap rotation me aa jaata hai.
 * Hover/focus par rotation ruk jaati hai (padhne me dikkat na ho).
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Stars } from "@/components/stars";
import { fetchAllPublishedReviews } from "@/lib/sheet-reviews";

export type TickerReview = {
  id: string;
  author: string;
  rating: number;
  title?: string;
  body: string;
  productHandle?: string;
  productTitle?: string;
  date?: string;
};

const ROTATE_MS = 1000;

function normalize(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);
}

export function ReviewsTicker({ items }: { items: TickerReview[] }) {
  const [sheetItems, setSheetItems] = useState<TickerReview[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    void fetchAllPublishedReviews(80).then((reviews) => {
      if (!alive.current || !reviews.length) return;
      setSheetItems(
        reviews
          .filter((review) => review.body)
          .map((review, position) => ({
            id: `sheet-${position}`,
            author: review.name || "Customer",
            rating: Number(review.rating) || 5,
            title: review.title || undefined,
            body: review.body,
            date: review.date,
            productHandle: review.handle,
          })),
      );
    });
    return () => {
      alive.current = false;
    };
  }, []);

  const list = useMemo<TickerReview[]>(() => {
    const seen = new Set(items.map((review) => normalize(review.body)));
    const extra = sheetItems.filter((review) => !seen.has(normalize(review.body)));
    return [...extra, ...items];
  }, [items, sheetItems]);

  useEffect(() => {
    if (paused || list.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % list.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused, list.length]);

  useEffect(() => {
    // list badle to index range me rakho
    setIndex((current) => (list.length ? current % list.length : 0));
  }, [list.length]);

  if (!list.length) return null;
  const review = list[index % list.length]!;

  return (
    <div
      className="mt-6"
      data-testid="home-reviews-ticker"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <figure
        key={`${review.id}-${index}`}
        className="mx-auto min-h-[168px] max-w-[640px] border border-[#eadfce] bg-white p-5 text-center transition-opacity duration-500 sm:p-7"
        aria-live="polite"
      >
        <div className="flex items-center justify-center">
          <Stars value={review.rating} size={15} />
        </div>
        {review.title ? <p className="mt-2 text-[13px] font-medium">{review.title}</p> : null}
        <blockquote className="mt-2 line-clamp-5 text-[12.5px] leading-relaxed text-[#3d332c]">
          {review.body}
        </blockquote>
        <figcaption className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10.5px] tracking-[.08em] text-[#8a7d72] uppercase">
          <span>{review.author}</span>
          {review.productHandle ? (
            <>
              <span aria-hidden>·</span>
              <Link href={`/products/${review.productHandle}`} className="text-[#6f1d2b] hover:underline">
                {review.productTitle ?? "View piece"}
              </Link>
            </>
          ) : null}
        </figcaption>
      </figure>

      <div className="mt-3 flex items-center justify-center gap-1.5">
        {list.slice(0, 12).map((item, position) => (
          <button
            key={`${item.id}-dot-${position}`}
            type="button"
            onClick={() => setIndex(position)}
            aria-label={`Review ${position + 1}`}
            aria-current={position === index % list.length}
            className={`h-1.5 w-1.5 rounded-full transition ${
              position === index % list.length ? "bg-[#6f1d2b]" : "bg-[#d9cbb6] hover:bg-[#b08a4a]"
            }`}
          />
        ))}
        <span className="ml-1 text-[10px] tracking-[.1em] text-[#a3948a] uppercase">
          {(index % list.length) + 1} / {list.length}
        </span>
      </div>
    </div>
  );
}
