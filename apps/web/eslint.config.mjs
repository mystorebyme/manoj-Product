import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Flat config — `eslint-config-next` v16 pehle se flat config export karta hai.
 * Pehle yahan `FlatCompat(...).extends("next/core-web-vitals")` use hota tha, jisse
 * ESLint 9 crash karta tha: `TypeError: Converting circular structure to JSON`
 * (yaani `npm run lint` bilkul chalta hi nahi tha).
 */
export default [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "out/**",
      "next-env.d.ts",
      "src/data/catalog.json",
      "public/**",
    ],
  },
  {
    rules: {
      // Storefront me `<img>` jaan-boojh kar use hota hai (Shopify CDN se direct,
      // Next image optimizer ka bandwidth zero chahiye) — docs/03-architecture.
      "@next/next/no-img-element": "off",

      /**
       * React Compiler ke naye `react-hooks` rules. Ye 13 jagah "warn" par hain:
       * sab localStorage/cart/wishlist/settings ko mount par padhne wale pattern hain
       * (`useEffect(() => setX(readLocal()), [])`). Refactor se behaviour badalne ka
       * risk hai aur fayda kam — isliye block nahi karte, par list dikhti rehti hai.
       * Naya code is pattern ko avoid kare (useSyncExternalStore / initializer).
       * Detail: docs/09-devops/repo-audit.md
       */
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];
