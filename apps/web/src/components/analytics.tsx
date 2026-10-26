"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

/**
 * Per-page traffic tracking (GA4).
 *
 * Owner ko Google Analytics 4 property banani hai → Measurement ID (`G-XXXXXXX`)
 * milta hai → usse env me daalna hai:
 *
 *   NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
 *
 * Id na ho to yeh component kuch bhi load nahi karta (koi extra request nahi,
 * koi cookie nahi) — site waise hi chalti rehti hai.
 *
 * Har route change par `page_view` bhejta hai, taaki **har page ki traffic**
 * (product, collection, home, orders) Google Analytics me alag-alag dikhe.
 * Search Console ke saath isse pata chalta hai: kaun se page par kitne log
 * aaye, kahan se aaye, aur kya kharida.
 *
 * Privacy: Next.js static export par bhi chalta hai (`next/script` afterInteractive).
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function GaPageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  useEffect(() => {
    if (typeof window === "undefined" || !window.gtag) return;
    const page = query ? `${pathname}?${query}` : pathname;
    window.gtag("event", "page_view", {
      page_path: page,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, query]);

  return null;
}

export function Analytics() {
  if (!GA_ID) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:false});`}
      </Script>
      <Suspense fallback={null}>
        <GaPageViews />
      </Suspense>
    </>
  );
}
