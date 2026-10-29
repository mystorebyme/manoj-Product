import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductDetail } from "@/components/product-detail";
import { ProductReviews } from "@/components/product-reviews";
import { reviewsFor } from "@/lib/reviews";
import { ProductGrid } from "@/components/product-card";
import { colourOptionsFor, getProduct, getRelatedProducts, products } from "@/lib/store";
import { categoryHref, categoryLabel } from "@/lib/categories";
import { siteConfig } from "@/config/site";

// har product build time par static HTML ban jaata hai -> instant page loads
export async function generateStaticParams() {
  return products.map((product) => ({ handle: product.handle }));
}

/**
 * Admin se naya product kabhi bhi aa sakta hai — isliye prerendered handles ke
 * bahar wale bhi on-demand render hote hain (404 nahi). 60s revalidate par list
 * pages naya product utha lete hain.
 */
export const dynamicParams = true;
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) return { title: "Product not found" };
  const path = `/products/${handle}`;
  return {
    title: product.title,
    description: product.description,
    alternates: { canonical: path },
    openGraph: {
      title: product.title,
      description: product.description,
      url: path,
      images: product.images.slice(0, 2),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) notFound();
  const related = await getRelatedProducts(product, 4);
  const reviewBlock = reviewsFor(product.handle);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: product.images.slice(0, 3),
    description: product.description,
    sku: product.handle,
    brand: { "@type": "Brand", name: "TRENDS YOUNIQUE" },
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: (product.price / 100).toFixed(2),
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${siteConfig.url}/products/${product.handle}`,
    },
    // rating 0 (sirf count, average nahi) par schema.org ka aggregateRating invalid hota hai
    ...(reviewBlock.count > 0 && reviewBlock.rating > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviewBlock.rating.toFixed(1),
            reviewCount: reviewBlock.count,
          },
        }
      : {}),
  };

  return (
    <div className="container-liksha py-6 lg:py-9">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#a3948a]">
          <li>
            <Link href="/" className="hover:text-[#6f1d2b]">Home</Link>
          </li>
          <li>/</li>
          <li>
            <Link href={categoryHref(product.category)} className="hover:text-[#6f1d2b]">
              {categoryLabel(product.category)}
            </Link>
          </li>
          <li>/</li>
          <li className="line-clamp-1 text-[#3d332c]">{product.title}</li>
        </ol>
      </nav>

      <ProductDetail
        product={product}
        colours={colourOptionsFor(product)}
        rating={reviewBlock.rating}
        reviewCount={reviewBlock.count}
      />

      <ProductReviews
        block={reviewBlock}
        productTitle={product.title}
        productHandle={product.handle}
        productId={product.id}
      />

      <section className="mt-14 border-t border-[#ece1d3] pt-9">
        <div className="text-center">
          <h2 className="font-display text-[24px] font-medium tracking-[.03em] sm:text-[28px]">
            You may also like
          </h2>
          <p className="mt-1 text-[11px] tracking-[.14em] text-[#a3948a] uppercase">
            Handpicked from the same edit
          </p>
        </div>
        <div className="mt-6">
          <ProductGrid products={related} />
        </div>
      </section>
    </div>
  );
}
