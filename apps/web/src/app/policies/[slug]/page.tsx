import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { renderMarkdown } from "@/lib/markdown";

const POLICY_DIR = path.join(process.cwd(), "src/content/policies");

const policyMeta: Record<string, { title: string; description: string }> = {
  "privacy-policy": {
    title: "Privacy Policy",
    description: "How TRENDS YOUNIQUE collects, uses and protects your personal data under the DPDP Act.",
  },
  "terms-and-conditions": {
    title: "Terms & Conditions",
    description: "The terms that apply when you shop with TRENDS YOUNIQUE.",
  },
  "refund-and-return-policy": {
    title: "Refund & Return Policy",
    description: "7 day returns, exchanges and refund timelines at TRENDS YOUNIQUE.",
  },
  "shipping-policy": {
    title: "Shipping Policy",
    description: "Shipping charges, dispatch times and delivery estimates across India.",
  },
};

export function generateStaticParams() {
  return Object.keys(policyMeta).map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const meta = policyMeta[slug];
  if (!meta) return { title: "Policy not found" };
  return { title: meta.title, description: meta.description, alternates: { canonical: `/policies/${slug}` } };
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = policyMeta[slug];
  if (!meta) notFound();

  const file = path.join(POLICY_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) notFound();
  const content = fs.readFileSync(file, "utf8");

  return (
    <div className="container-liksha py-10 lg:py-14">
      <div className="mx-auto max-w-[820px]">
        <nav className="mb-6 flex flex-wrap gap-2 text-[11px]">
          {Object.entries(policyMeta).map(([key, value]) => (
            <Link
              key={key}
              href={`/policies/${key}`}
              className={`border px-2.5 py-1 ${
                key === slug
                  ? "border-[#6f1d2b] bg-[#6f1d2b] text-white"
                  : "border-[#e5dbd0] text-[#3d332c] hover:border-[#6f1d2b] hover:text-[#6f1d2b]"
              }`}
            >
              {value.title}
            </Link>
          ))}
        </nav>
        <article className="border border-[#ece1d3] p-6 sm:p-9">{renderMarkdown(content)}</article>
        <p className="mt-6 text-center text-[11.5px] text-[#8a7d72]">
          Questions? WhatsApp{" "}
          <a className="text-[#6f1d2b]" href="https://wa.me/918005900581">
            8005900581
          </a>{" "}
          or email care@trendsyounique.com
        </p>
      </div>
    </div>
  );
}
