"use client";

/**
 * Controlled toolbar — state CollectionBrowser ke paas hai (page static rehta hai).
 * URL params `replaceState` se sync hote hain taaki link share ho sake.
 */
const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "price-low", label: "Price, low to high" },
  { value: "price-high", label: "Price, high to low" },
  { value: "discount", label: "Biggest discount" },
  { value: "new", label: "Newest first" },
  { value: "title-asc", label: "Alphabetically, A-Z" },
];

/**
 * Price buckets — campaign price ke hisaab se (Diwali 75% off ke baad sabse mehnga
 * product ~Rs. 1,600 hai). Purane Rs. 2,500+ buckets khaali dikhte the.
 */
const priceOptions = [
  { value: "all", label: "Price: all" },
  { value: "under-500", label: "Under Rs. 500" },
  { value: "500-800", label: "Rs. 500 - 800" },
  { value: "800-1200", label: "Rs. 800 - 1,200" },
  { value: "above-1200", label: "Rs. 1,200 & above" },
];

export function CollectionToolbar({
  total,
  sort,
  priceRange,
  loading = false,
  onSortChange,
  onPriceChange,
}: {
  total: number;
  sort: string;
  priceRange: string;
  loading?: boolean;
  onSortChange: (value: string) => void;
  onPriceChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#ece1d3] pb-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[11.5px] tracking-[.1em] text-[#8a7d72] uppercase">
        {total} {total === 1 ? "product" : "products"}
        {loading ? <span className="ml-2 text-[#6f1d2b]">updating…</span> : null}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={priceRange}
          onChange={(event) => onPriceChange(event.target.value)}
          aria-label="Filter by price"
          className="h-9 border border-[#e0d6ca] bg-white px-2.5 text-[11.5px] tracking-[.04em] outline-none focus:border-[#6f1d2b]"
        >
          {priceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value)}
          aria-label="Sort products"
          className="h-9 border border-[#e0d6ca] bg-white px-2.5 text-[11.5px] tracking-[.04em] outline-none focus:border-[#6f1d2b]"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
