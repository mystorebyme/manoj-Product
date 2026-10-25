"use client";

import { useEffect, useMemo, useState } from "react";
import { SafeImage } from "@/components/safe-image";
import { Stars } from "@/components/stars";
import { ratingBreakdown, type ProductReviewBlock, type Review } from "@/lib/reviews";
import { fetchPublishedReviews, submitReview, type SheetReview } from "@/lib/sheet-reviews";

/** same review do jagah se na aaye — text ka pehla hissa hi kaafi hai */
function normalizeReviewText(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * Product reviews — live store ke Trustoo widget jaisa layout:
 * bada average + stars, 5★→1★ distribution bars, photo reviews ka carousel,
 * aur verified buyer review cards. Data daily sync se aata hai.
 */
export function ProductReviews({
  block,
  productTitle,
  productHandle,
  productId,
}: {
  block: ProductReviewBlock;
  productTitle: string;
  productHandle: string;
  /** sheet ke `Product ID` column ke liye — isi se review sahi product par aata hai */
  productId?: string;
}) {
  const [filter, setFilter] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  // sheet se aaye published reviews (owner ne approve kiye) — local reviews ke saath merge
  const [sheetReviews, setSheetReviews] = useState<SheetReview[]>([]);
  const [form, setForm] = useState({ name: "", rating: 5, body: "" });
  const [formStatus, setFormStatus] = useState<"idle" | "done" | "error">("idle");

  useEffect(() => {
    let alive = true;
    void fetchPublishedReviews(productHandle, productId).then((reviews) => {
      if (alive && reviews.length) setSheetReviews(reviews);
    });
    return () => {
      alive = false;
    };
  }, [productHandle, productId]);

  // sheet reviews ko usi shape me le aao jise baaki UI padhta hai
  const merged = useMemo<ProductReviewBlock>(() => {
    // Sheet me wahi reviews ho sakte hain jo abhi site ke sync file me hain
    // (owner ne "Import all reviews" chalaya) — duplicate do baar na dikhe.
    const known = new Set(block.reviews.map((review) => normalizeReviewText(review.body)));
    const extra: Review[] = sheetReviews
      .filter((review) => !known.has(normalizeReviewText(review.body)))
      .map((review, index) => ({
        id: `sheet-${index}`,
        author: review.name || "Customer",
        rating: Number(review.rating) || 5,
        title: review.title || undefined,
        body: review.body,
        date: review.date,
        verified: false,
        // sheet ke `Images` column se aayi customer photos bhi gallery me aayein
        photos: (review.photos ?? []).filter((src) => /^https?:\/\//i.test(String(src))),
      }));
    const reviews = [...extra, ...block.reviews];
    const count = block.count + extra.length;
    const total = block.rating * Math.max(0, block.count - block.reviews.length) +
      block.reviews.reduce((sum, review) => sum + review.rating, 0) +
      extra.reduce((sum, review) => sum + review.rating, 0);
    const rating = count > 0 ? Math.round((total / count) * 10) / 10 : 0;
    return { rating, count, reviews };
  }, [block, sheetReviews]);

  const breakdown = useMemo(() => ratingBreakdown(merged), [merged]);
  const photos = useMemo(
    () => merged.reviews.flatMap((review) => (review.photos ?? []).map((src) => ({ src, review }))),
    [merged],
  );
  const visible = filter ? merged.reviews.filter((review) => Math.round(review.rating) === filter) : merged.reviews;

  return (
    <section className="mt-10 border-t border-[#ece1d3] pt-8" data-testid="product-reviews" id="reviews">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[24px] font-medium sm:text-[28px]">Customer reviews</h2>
          <p className="mt-1 text-[11px] tracking-[.12em] text-[#a3948a] uppercase">
            {merged.count > 0 ? `${merged.count} customer reviews` : "Be the first to review this piece"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          className="border border-[#6f1d2b] px-5 py-2.5 text-[10.5px] font-semibold tracking-[.14em] text-[#6f1d2b] uppercase transition hover:bg-[#6f1d2b] hover:text-white"
        >
          Write a review
        </button>
      </div>

      {showForm ? (
        <form
          className="mt-3 border border-[#ece1d3] bg-[#fdfaf5] p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (form.name.trim().length < 2 || form.body.trim().length < 8) {
              setFormStatus("error");
              return;
            }
            submitReview({
              handle: productHandle,
              productId,
              productTitle,
              name: form.name.trim(),
              rating: form.rating,
              body: form.body.trim(),
            });
            setFormStatus("done");
            setShowForm(false);
          }}
          data-testid="review-form"
        >
          {formStatus === "done" ? (
            <p className="text-[12.5px] leading-relaxed text-[#2f6b3f]">
              Shukriya! Aapka review mil gaya — owner check karke publish karega, phir yahin dikhega.
            </p>
          ) : (
            <>
              <p className="text-[12px] leading-relaxed text-[#6f6259]">
                Apna experience likhiye — review Google Sheet me save hota hai, owner approve karke publish karta hai.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10.5px] tracking-[.12em] text-[#8a7d72] uppercase">Rating</span>
                {[5, 4, 3, 2, 1].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, rating: value }))}
                    aria-label={`${value} star`}
                    className={`h-8 w-8 border text-[12px] ${
                      form.rating === value
                        ? "border-[#c9a86a] bg-[#c9a86a] text-white"
                        : "border-[#ded1c0] text-[#6f6259]"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Your name"
                  className="h-10 border border-[#ded1c0] bg-white px-3 text-[12.5px] outline-none focus:border-[#6f1d2b]"
                />
              </div>
              <textarea
                value={form.body}
                onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                placeholder="Fit, fabric, finishing — kaisa laga?"
                rows={3}
                className="mt-2 w-full border border-[#ded1c0] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#6f1d2b]"
              />
              {formStatus === "error" ? (
                <p className="mt-1 text-[11.5px] text-[#b3261e]">Naam aur kam se kam 8 akshar ka review likhiye.</p>
              ) : null}
              <button
                type="submit"
                className="mt-3 bg-[#6f1d2b] px-5 py-2.5 text-[10.5px] font-semibold tracking-[.14em] text-white uppercase"
              >
                Submit review
              </button>
            </>
          )}
        </form>
      ) : null}

      {merged.count === 0 ? (
        <div className="mt-5 border border-[#ece1d3] px-5 py-10 text-center">
          <Stars value={0} size={18} />
          <p className="mt-2 text-[12.5px] text-[#6f6259]">
            Is piece par abhi koi review nahi hai. Pehla review aapka ho sakta hai.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-6 border border-[#ece1d3] p-5 sm:grid-cols-[210px_1fr]">
            <div className="text-center sm:border-r sm:border-[#f2e9dd] sm:pr-5">
              {merged.rating > 0 ? (
                <>
                  <p className="font-display text-[44px] leading-none text-[#6f1d2b]">{merged.rating.toFixed(1)}</p>
                  <Stars value={merged.rating} size={16} />
                </>
              ) : (
                <p className="font-display text-[20px] leading-none text-[#6f1d2b]">{merged.count} ratings</p>
              )}
              <p className="mt-1.5 text-[11.5px] text-[#6f6259]">Based on {merged.count} reviews</p>
            </div>
            <div className="space-y-1.5">
              {merged.reviews.length === 0 ? (
                <p className="text-[12px] leading-relaxed text-[#6f6259]">
                  Is piece par {merged.count} ratings hain. Customer-written reviews aate hi yahan dikhte hain —
                  koi sample review publish nahi hota.
                </p>
              ) : null}
              {merged.reviews.length === 0 ? null : breakdown.map((row) => (
                <button
                  key={row.stars}
                  type="button"
                  onClick={() => setFilter(filter === row.stars ? null : row.stars)}
                  className={`flex w-full items-center gap-2 text-left text-[11.5px] transition ${
                    filter === row.stars ? "text-[#6f1d2b]" : "text-[#6f6259] hover:text-[#6f1d2b]"
                  }`}
                >
                  <span className="w-7">{row.stars}★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#f2e9dd]">
                    <span className="block h-full rounded-full bg-[#c9a86a]" style={{ width: `${row.percent}%` }} />
                  </span>
                  <span className="w-8 text-right tabular-nums">{row.count}</span>
                </button>
              ))}
              {filter ? (
                <button
                  type="button"
                  onClick={() => setFilter(null)}
                  className="text-[10.5px] tracking-[.1em] text-[#6f1d2b] uppercase underline"
                >
                  Clear filter
                </button>
              ) : null}
            </div>
          </div>

          {photos.length > 0 ? (
            <div className="mt-6">
              <p className="text-[10.5px] font-semibold tracking-[.14em] text-[#8a7d72] uppercase">Customer photos</p>
              <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
                {photos.map(({ src, review }) => (
                  <figure key={`${review.id}-${src}`} className="w-[104px] shrink-0">
                    <SafeImage src={src} alt="" className="h-[132px] w-full object-cover" />
                    <figcaption className="mt-1 text-[10px] text-[#8a7d72]">{review.author}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ) : null}

          <ul className="mt-6 space-y-4">
            {visible.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <li className="border border-[#ece1d3] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] font-medium">{review.author}</span>
        {review.verified === true ? (
          <span className="bg-[#eaf5ec] px-1.5 py-0.5 text-[9px] font-semibold tracking-[.08em] text-[#2f7a3f] uppercase">
            Verified buyer
          </span>
        ) : null}
        {review.date ? <span className="text-[10.5px] text-[#a3948a]">{review.date}</span> : null}
      </div>
      <div className="mt-1.5">
        <Stars value={review.rating} size={13} />
      </div>
      {review.title ? <p className="mt-1.5 text-[12.5px] font-medium">{review.title}</p> : null}
      <p className="mt-1 text-[12.5px] leading-relaxed text-[#3d332c]">{review.body}</p>
      {review.photos?.length ? (
        <div className="mt-2 flex gap-1.5">
          {review.photos.slice(0, 4).map((src) => (
            <SafeImage key={src} src={src} alt="" className="h-16 w-14 object-cover" />
          ))}
        </div>
      ) : null}
    </li>
  );
}

export { Stars } from "@/components/stars";
