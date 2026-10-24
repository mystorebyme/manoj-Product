"use client";

import { useMemo, useState } from "react";
import { SafeImage } from "@/components/safe-image";
import { Stars } from "@/components/stars";
import { productUrl } from "@/lib/whatsapp";
import { ratingBreakdown, type ProductReviewBlock, type Review } from "@/lib/reviews";

/**
 * Product reviews — live store ke Trustoo widget jaisa layout:
 * bada average + stars, 5★→1★ distribution bars, photo reviews ka carousel,
 * aur verified buyer review cards. Data daily sync se aata hai.
 */
export function ProductReviews({
  block,
  productTitle,
  productHandle,
}: {
  block: ProductReviewBlock;
  productTitle: string;
  productHandle: string;
}) {
  const [filter, setFilter] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const breakdown = useMemo(() => ratingBreakdown(block), [block]);
  const photos = useMemo(
    () => block.reviews.flatMap((review) => (review.photos ?? []).map((src) => ({ src, review }))),
    [block],
  );
  const visible = filter ? block.reviews.filter((review) => Math.round(review.rating) === filter) : block.reviews;

  const whatsappReview = `https://wa.me/918005900581?text=${encodeURIComponent(
    `Hi TRENDS YOUNIQUE! I'd like to review "${productTitle}" (${productUrl(productHandle)}). My rating: `,
  )}`;

  return (
    <section className="mt-10 border-t border-[#ece1d3] pt-8" data-testid="product-reviews" id="reviews">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[24px] font-medium sm:text-[28px]">Customer reviews</h2>
          <p className="mt-1 text-[11px] tracking-[.12em] text-[#a3948a] uppercase">
            {block.count > 0 ? `${block.count} customer reviews` : "Be the first to review this piece"}
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
        <p className="mt-3 border border-[#ece1d3] bg-[#fdfaf5] p-4 text-[12.5px] leading-relaxed text-[#3d332c]">
          Apna review WhatsApp par bhejiye — team 24 ghante me publish kar deti hai.{" "}
          <a href={whatsappReview} target="_blank" rel="noopener noreferrer" className="font-medium text-[#6f1d2b] underline">
            WhatsApp par review likhein
          </a>
        </p>
      ) : null}

      {block.count === 0 ? (
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
              {block.rating > 0 ? (
                <>
                  <p className="font-display text-[44px] leading-none text-[#6f1d2b]">{block.rating.toFixed(1)}</p>
                  <Stars value={block.rating} size={16} />
                </>
              ) : (
                <p className="font-display text-[20px] leading-none text-[#6f1d2b]">{block.count} ratings</p>
              )}
              <p className="mt-1.5 text-[11.5px] text-[#6f6259]">Based on {block.count} reviews</p>
            </div>
            <div className="space-y-1.5">
              {block.reviews.length === 0 ? (
                <p className="text-[12px] leading-relaxed text-[#6f6259]">
                  Is piece par {block.count} ratings hain. Customer-written reviews aate hi yahan dikhte hain —
                  koi sample review publish nahi hota.
                </p>
              ) : null}
              {block.reviews.length === 0 ? null : breakdown.map((row) => (
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
