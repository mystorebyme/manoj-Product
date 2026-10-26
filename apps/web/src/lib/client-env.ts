"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Browser-only facts ke liye hooks — **`useSyncExternalStore`** par (React ka official rasta).
 *
 * Kyun: pehle ye kaam `useEffect(() => setX(...), [])` se hota tha, jisse "cascading render"
 * hota hai aur React Compiler ka `react-hooks/set-state-in-effect` rule warn karta hai
 * (`docs/09-devops/repo-audit.md`). Yahan server snapshot hamesha ek constant deta hai,
 * isliye hydration mismatch bhi nahi hota.
 */

const noopSubscribe = () => () => {};

/** server par `false`, client par `true` — "abhi browser me render ho raha hai" */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Page `threshold` px se zyada scroll hui hai? (header ka shrink effect)
 * Server par `false` → pehla paint chhota header, hydration ke baad sahi.
 */
export function useScrollPast(threshold: number): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const onScroll = () => onChange();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > threshold,
    () => false,
  );
}

export type Platform = "android" | "ios" | "desktop";

/** User agent se platform — UPI app links ke liye (`upi://pay` vs intent://) */
export function usePlatform(): Platform {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      const ua = navigator.userAgent;
      if (/android/i.test(ua)) return "android";
      if (/iphone|ipad|ipod/i.test(ua)) return "ios";
      return "desktop";
    },
    () => "desktop",
  );
}

/**
 * Browser me `IntersectionObserver` hai? (purane browser me reveal animation skip)
 *
 * `getServerSnapshot` jaan-boojh kar `true` hai: server par markup wahi banna chahiye jo
 * 99% browsers me hydrate hota hai (`reveal-init`), warna page pehle visible render hoke
 * hydration par chhup jaata aur "flash" dikhta. Purane browser me hydration ke baad
 * `false` milta hai → content seedha visible (React ise re-render se handle karta hai,
 * koi hydration error nahi).
 */
export function useSupportsIntersectionObserver(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof IntersectionObserver !== "undefined",
    () => true,
  );
}

/**
 * Maujooda URL ka `?query` — server par `""`.
 * Static export me `useSearchParams()` ke liye Suspense boundary chahiye hoti hai, isliye
 * yahan seedha `window.location.search` padhte hain (client-only, no mismatch).
 */
export function useUrlSearch(): string {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
}
