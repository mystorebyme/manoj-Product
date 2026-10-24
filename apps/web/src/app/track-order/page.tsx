import Link from "next/link";
import type { Metadata } from "next";
import { TrackOrderForm } from "@/components/track-order-form";
import { SupportChannels } from "@/components/contact-details";

export const metadata: Metadata = {
  title: "Track your order",
  description:
    "Track your TRENDS YOUNIQUE order with your order number — live status from placed to delivered, courier and AWB details.",
  alternates: { canonical: "/track-order" },
};

export default function TrackOrderPage() {
  return (
    <div>
      <div className="border-b border-[#ece1d3] bg-[#faf7f3] py-10 text-center">
        <p className="text-[10.5px] tracking-[.18em] text-[#a3948a] uppercase">Order tracking</p>
        <h1 className="mt-1.5 font-display text-[30px] font-medium tracking-[.03em] sm:text-[38px]">
          Track your order
        </h1>
        <p className="mx-auto mt-2 max-w-[560px] px-4 text-[12.5px] leading-relaxed text-[#6f6259]">
          Enter your order number to see the live status — payment, packing, courier and AWB in one place.
        </p>
      </div>

      <div className="container-liksha py-10">
        <div className="mx-auto max-w-[720px]">
          <div className="border border-[#ece1d3] bg-[#fdfaf5] p-5 sm:p-7">
            <TrackOrderForm />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="border border-[#ece1d3] p-5">
              <h2 className="font-display text-[19px] font-medium text-[#6f1d2b]">Where is my order number?</h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[#3d332c]">
                When your order is confirmed we show the <strong>LK-…</strong> number on screen and send it on
                WhatsApp and email. Enter that number here.
              </p>
            </div>
            <div className="border border-[#ece1d3] p-5">
              <h2 className="font-display text-[19px] font-medium text-[#6f1d2b]">Need help?</h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[#3d332c]">
                Lost the number? Send your registered mobile number on WhatsApp — our team will find the order
                and share its status.
              </p>
              <SupportChannels className="mt-3" />
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link href="/collections/new-arrivals" className="text-[11px] font-semibold tracking-[.14em] text-[#6f1d2b] uppercase underline">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
