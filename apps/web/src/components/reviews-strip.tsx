import { latestReviews, shopRating } from "@/lib/reviews";
import { ReviewsTicker } from "@/components/reviews-ticker";
import { Stars } from "@/components/stars";

/**
 * Home par customer reviews — **har 1 second** ek naya approved review rotate
 * hota hai (client component). Reviews sync + Google Sheet ke approved reviews,
 * dono se aate hain (koi dummy review nahi).
 */
export function ReviewsStrip() {
  const reviews = latestReviews(40).map((review) => ({
    id: review.id,
    author: review.author,
    rating: review.rating,
    title: review.title,
    body: review.body,
    productHandle: review.productHandle,
    productTitle: review.productTitle,
    date: review.date,
  }));
  if (!reviews.length) return null;

  return (
    <section className="bg-[#faf6ef] py-12" data-testid="home-reviews">
      <div className="container-liksha">
        <div className="text-center">
          <h2 className="font-display text-[26px] font-medium tracking-[.03em] sm:text-[32px]">
            Loved by our customers
          </h2>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Stars value={shopRating.rating || 5} size={16} />
            <span className="text-[12px] text-[#6f6259]">
              {(shopRating.rating || 5).toFixed(1)} / 5 · {shopRating.count} reviews
            </span>
          </div>
        </div>

        <ReviewsTicker items={reviews} />
      </div>
    </section>
  );
}
