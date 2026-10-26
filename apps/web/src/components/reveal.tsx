"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSupportsIntersectionObserver } from "@/lib/client-env";

/**
 * Scroll-reveal wrapper — live store ke `hdt-reveal="slide-in"` jaisa.
 * IntersectionObserver sirf ek baar fire hota hai, prefers-reduced-motion par
 * content seedha visible rehta hai (CSS handle karta hai).
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  /**
   * Purane browser (ya SSR) me observer hi nahi hota — wahan content seedha dikhna chahiye.
   * Pehle yahan effect ke andar `setShown(true)` hota tha (sync setState → cascading render);
   * ab render ke waqt hi decide ho jaata hai.
   */
  const supportsObserver = useSupportsIntersectionObserver();
  const visible = shown || !supportsObserver;

  useEffect(() => {
    if (!supportsObserver) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [supportsObserver]);

  const Element = Tag as "div";

  return (
    <Element
      ref={ref}
      className={`${visible ? "reveal-in" : "reveal-init"} ${className}`}
      style={visible && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Element>
  );
}
