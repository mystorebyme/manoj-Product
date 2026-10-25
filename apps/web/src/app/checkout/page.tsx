import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";

export const metadata: Metadata = { title: "Secure checkout" };

export default function CheckoutPage() {
  return (
    <div className="container-liksha py-8 lg:py-12">
      <div className="text-center">
        <h1 className="font-display text-[28px] font-medium tracking-[.03em] sm:text-[34px]">Secure checkout</h1>
        <p className="mt-1 text-[11px] tracking-[.14em] text-[#a3948a] uppercase">
          Free shipping across India · 7 days return
        </p>
      </div>
      <div className="mt-7">
        <Suspense fallback={<div className="py-16 text-center text-sm text-[#8a7d72]">Loading checkout…</div>}>
          <CheckoutForm />
        </Suspense>
      </div>
    </div>
  );
}
