import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Admin panel ka flat ESLint config.
 *
 * Pehle is workspace me `lint` script tha par **koi config hi nahi** (`eslint .` fail hota tha:
 * "ESLint couldn't find an eslint.config.js"), isliye root ka `npm run lint` toot jaata tha.
 * Ab storefront jaisa hi config hai (Next 16 flat config seedha import).
 */
const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
  {
    // App Router: font <link> root layout me hi sahi jagah hai
    files: ["src/app/layout.tsx"],
    rules: { "@next/next/no-page-custom-font": "off" },
  },
  {
    rules: {
      // admin me bhi `<img>` jaan-boojh kar use hota hai (remote product photos)
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
