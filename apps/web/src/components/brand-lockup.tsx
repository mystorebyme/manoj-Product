import { brandAssets } from "@/config/site";

/**
 * Brand lockup — owner ka **original** logo (crown + gown crest + TRENDS YOUNIQUE),
 * bilkul jaisa diya gaya hai (koi redraw / typography change nahi).
 *
 * Assets `python3 scripts/brand/build-trends-assets.py` se bante hain:
 *   - `variant="header"`  → crest + wordmark (horizontal) — site header, light bg
 *   - `variant="stacked"` → poora lockup (crest upar, wordmark neeche) — footer / invoice
 *
 * `tone="light"` dark (wine/ink) background ke liye **cream** version deta hai —
 * logo khud recolor nahi hota, sirf uski cream-ink variant aati hai.
 */
export function BrandLockup({
  tone = "dark",
  size = "header",
  variant = "header",
  className = "",
}: {
  /** `dark` = light background (header), `light` = wine/ink background (footer) */
  tone?: "dark" | "light";
  /** `header` = nav, `compact` = mobile drawer, `large` = footer */
  size?: "header" | "compact" | "large";
  /** `header` = horizontal lockup, `stacked` = full vertical lockup */
  variant?: "header" | "stacked";
  className?: string;
}) {
  const stacked = variant === "stacked";
  const src = stacked
    ? tone === "light"
      ? brandAssets.fluidCream
      : brandAssets.fluid
    : tone === "light"
      ? brandAssets.desktopCream
      : brandAssets.desktop;

  return (
    <span data-size={size} data-variant={variant} data-tone={tone} className={`brand-lockup inline-flex items-center ${className}`}>
      <img
        src={src}
        alt="TRENDS YOUNIQUE"
        width={stacked ? 969 : 936}
        height={stacked ? 1144 : 326}
        decoding="async"
        className="block w-auto max-w-full object-contain"
      />
    </span>
  );
}
