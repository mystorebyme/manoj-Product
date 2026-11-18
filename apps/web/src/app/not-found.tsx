import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-liksha py-20 text-center">
      <p className="font-display text-[52px] leading-none text-[#6f1d2b] sm:text-[68px]">404</p>
      <h1 className="mt-3 font-display text-[26px] font-medium sm:text-[32px]">This page has moved on</h1>
      <p className="mx-auto mt-2 max-w-[440px] text-[13px] leading-relaxed text-[#6f6259]">
        The page you are looking for is no longer here. Explore our latest Anarkali suits, lehengas and
        new arrivals instead.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="bg-[#6f1d2b] px-7 py-3 text-[11px] font-semibold tracking-[.16em] text-white uppercase"
        >
          Back to home
        </Link>
        <Link
          href="/collections/new-arrivals"
          className="border border-[#6f1d2b] px-7 py-3 text-[11px] font-semibold tracking-[.16em] text-[#6f1d2b] uppercase"
        >
          Shop new arrivals
        </Link>
      </div>
    </div>
  );
}
