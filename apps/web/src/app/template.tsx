"use client";

import type { ReactNode } from "react";

/**
 * Page-opening animation — TRENDS YOUNIQUE ka apna "curtain" transition.
 *
 * Next ka `template.tsx` har navigation par remount hota hai, isliye animation
 * sirf **naye page** par chalti hai (layout/header hilte nahi — isliye page turant
 * interactive lagta hai).
 *
 * Design: wine ka ek patla parda jis par gold ki ek lakeer chalti hai, wo upar
 * uthta hai aur content neeche se 6px rise karke settle hota hai. Poora effect
 * ~520ms — CSS-only (koi JS timer nahi), isliye scroll/click block nahi hota.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <div className="page-root">
      <span className="page-veil" aria-hidden />
      <span className="page-rule" aria-hidden />
      <div className="page-in">{children}</div>
    </div>
  );
}
