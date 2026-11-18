/**
 * Client-safe collection list (sirf handle/title/subtitle — chhota payload).
 * Poora catalog (287 products, ~400KB) sirf server par load hota hai.
 */
export const navigationCollections = [
  { handle: "new-arrivals", title: "New Arrivals", subtitle: "Freshly dropped festive favourites" },
  { handle: "party-wear-gown", title: "Anarkali Suits", subtitle: "Designer anarkali suits, floor-length flare" },
  { handle: "lehnga-choli", title: "Lehenga Chunni & Choli Sets", subtitle: "Wedding-ready lehenga choli sets" },
  { handle: "suit-set-gown", title: "Suit Sets & Gowns", subtitle: "Ready-to-wear suit sets and gowns" },
  { handle: "printed-suit-set", title: "Printed Suits", subtitle: "Everyday ethnic ease" },
  { handle: "wedding-collection", title: "Wedding & Festive Wear", subtitle: "Bridal & trousseau edit" },
  { handle: "trends-signature", title: "Trends Signature", subtitle: "Handpicked by our stylists" },
  { handle: "trending", title: "Trending", subtitle: "The styles selling out this week" },
  { handle: "sale", title: "Sale", subtitle: "Limited-time festive prices" },
] as const;

export type NavigationCollection = (typeof navigationCollections)[number];
