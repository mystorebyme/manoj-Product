# Campaigns — mahine ke hisaab se rotate (Diwali 75% off)

> Owner ki requirement: *"changes hote rehte hain, every month rotate karna"*.
> Poora offer **ek file** me hai: `apps/web/src/lib/campaign.ts`.

## Ab kya chal raha hai

| | |
| --- | --- |
| Campaign | **Diwali Sale — flat 75% off** |
| Dates | `2026-10-24` se `2026-11-30` (owner env se badal sakta hai) |
| Banner | `apps/web/public/images/banners/trends-younique-diwali-75-off-{desktop,tablet,mobile}.webp` |
| Landing | `/collections/sale` |
| Discount | **asli 75%** — har product ki price = MRP ka 25% |

### Price kaise banti hai

`campaignPrice(mrp, 75)` = `round(MRP × 0.25)` (poore rupee me). MRP ko kabhi
nahi badla jaata — jo MRP sheet/catalogue me hai wahi dikhta hai, isliye discount
jhootha nahi hota. Test (`tests/unit/campaign.test.ts`) saare 446 products par
check karta hai ki discount exactly **75%** aata hai.

Examples:

| MRP | Price | Discount |
| --- | --- | --- |
| ₹1,248 | ₹312 | 75% |
| ₹2,330 | ₹583 | 75% |
| ₹4,599 (Meher anarkali) | ₹1,150 | 75% |
| ₹6,299 (Rani lehenga) | ₹1,575 | 75% |

Kahan-kahan lagti hai (sab ek hi source se): home cards, PDP, quantity chips ka
size-price, cart, cart drawer, checkout total, order/WhatsApp message, invoice,
JSON-LD structured data, sale collection.

## Naya mahina / naya offer kaise jodte hain

1. Banner ke 3 sizes banao (desktop ≥1024, tablet 768–1023, mobile <768) aur
   `apps/web/public/images/banners/` me rakho.
2. `apps/web/src/lib/campaign.ts` me `CAMPAIGNS` array me ek object add karo:

```ts
export const KARWA_CHAUTH_2027: Campaign = {
  id: "karwa-chauth-2027",
  name: "Karwa Chauth Edit",
  headline: "Karwa Chauth Edit",
  subline: "Flat 40% off on festive anarkali",
  discountPercent: 40,
  startAt: "2027-09-20T00:00:00+05:30",
  endAt: "2027-10-05T23:59:59+05:30",
  announcement: "Karwa Chauth Edit — flat 40% off",
  href: "/collections/weddin-collection",
  banners: { desktop: `${ASSET_BASE}/images/banners/…`, tablet: `…`, mobile: `…` },
  ratios: { desktop: 16 / 9, tablet: 4 / 3, mobile: 2 / 3 },
};

export const CAMPAIGNS: Campaign[] = [DIWALI_2026, KARWA_CHAUTH_2027];
```

3. Push. Dates ke andar wala campaign apne aap live ho jaata hai; purana apne aap
   band (expired offer kabhi nahi dikhta). Ek waqt me ek hi campaign chalta hai.

## Env switches

| Variable | Kaam |
| --- | --- |
| `NEXT_PUBLIC_CAMPAIGN_ID` | kisi ek campaign ko force karo, ya `off`/`none` se band |
| `NEXT_PUBLIC_CAMPAIGN_START` / `_END` | Diwali ki dates badalne ke liye |

Campaign band karte hi hero wapas editorial banner par chala jaata hai, announcement
bar se offer hat jaati hai, aur prices catalogue ki normal sale price par aa jaati hain.

## Owner approval chahiye

- Diwali campaign ki **exact dates** (abhi 24 Oct – 30 Nov 2026 default hai).
- 75% off se price girne par margin theek hai ya nahi (MRP ₹2,330 → price ₹583).
- Agar sirf kuch products par 75% chahiye, to banner par **"UP TO 75% OFF"** karna
  padega — abhi gate par "flat 75%" isliye likha hai kyunki har product par 75% hai.
