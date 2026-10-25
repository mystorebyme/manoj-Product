#!/usr/bin/env node
/**
 * clean-titles.mjs — catalogue ke product titles saaf karta hai.
 *
 * Kyun: live store se aaye titles me ALL-CAPS, keyword-stuffed aur galat spelling
 * wale naam hain ("RANG-F-ROYALE BLOOMING LEHENGA SUIT SET", "…Beutifull Fancy…").
 * Owner ki requirement: saaf, searchable naam — par **product ki asli information
 * chhue bina** (fabric, colour, work, "set" wagairah sab rehte hain).
 *
 * Rules (jaan-boojh kar conservative):
 *   1. poori tarah CAPS title → Title Case (chhote words: and, with, of, the…)
 *   2. spelling fixes: Beutifull → Beautiful, Lehnga → Lehenga, Waite → White,
 *      Anarkali Anarkali (double) → Anarkali, "Suit Set Set" → "Suit Set"
 *   3. extra spaces / trailing punctuation saaf
 *   4. 110 akshar se lamba title → pehle 12 shabd + "…" (info hatane se behtar
 *      hai ki poora title hi na dikhe? nahi — yahan sirf keyword stuffing kaat
 *      rahe hain, jo words repeat ho rahe hain unhe hata kar)
 *
 * Chalaiye:  node scripts/clean-titles.mjs [--write]
 * (`--write` ke bina sirf diff dikhta hai.)
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FILES = [
  "database/seeds/catalog.json",
  "apps/web/src/data/catalog.json",
  "apps/admin/src/data/catalog.json",
];

const SMALL = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);
const SPELLINGS = [
  [/\bBeutifull\b/gi, "Beautiful"],
  [/\bBeautifull\b/gi, "Beautiful"],
  [/\bLehnga\b/gi, "Lehenga"],
  [/\bLengha\b/gi, "Lehenga"],
  [/\bWaite\b/gi, "White"],
  [/\bEmroidary\b/gi, "Embroidery"],
  [/\bEmbroidary\b/gi, "Embroidery"],
  [/\bSequence\b/gi, "Sequins"],
  [/\bJari\b/gi, "Zari"],
  [/\bPent\b/gi, "Pant"],
  [/\bColourfull\b/gi, "Colourful"],
];

function titleCase(word, index) {
  const lower = word.toLowerCase();
  if (index > 0 && SMALL.has(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function cleanTitle(raw) {
  let title = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!title) return title;

  // 1) all-caps / mostly caps → Title Case
  const letters = title.replace(/[^A-Za-z]/g, "");
  const caps = title.replace(/[^A-Z]/g, "");
  if (letters.length > 3 && caps.length / letters.length > 0.7) {
    title = title
      .split(" ")
      .map((word, index) => (/^[A-Z0-9[\]()-]+$/.test(word) ? word.toLowerCase() : word))
      .map((word, index) => titleCase(word, index))
      .join(" ");
    // "Set (pack Of 2)" jaisa ho to brackets ke andar bhi theek karo
    title = title.replace(/\(([^)]*)\)/g, (_, inner) => `(${inner.trim()})`);
  }

  // 2) spelling
  for (const [pattern, replacement] of SPELLINGS) title = title.replace(pattern, replacement);

  // 3) repeat words ("Anarkali Anarkali", "Suit Set Set")
  title = title.replace(/\b(\w+)( \1\b)+/gi, "$1");

  // 4) safai
  title = title
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/[,;:.\s]+$/, "")
    .replace(/^[,;:.\s]+/, "")
    .trim();

  // 5) bahut lamba keyword-stuffed title → poore shabd, koi info nahi kaatti
  if (title.length > 110) {
    const words = title.split(" ");
    const seen = new Set();
    const kept = [];
    for (const word of words) {
      const key = word.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      kept.push(word);
      if (kept.join(" ").length > 95) break;
    }
    title = kept.join(" ").replace(/[,;:.\s]+$/, "");
  }

  return title;
}

const write = process.argv.includes("--write");
let changed = 0;
const samples = [];

for (const file of FILES) {
  const full = path.join(ROOT, file);
  const raw = fs.readFileSync(full, "utf8");
  const data = JSON.parse(raw);
  let fileChanged = 0;
  for (const product of data.products ?? []) {
    const next = cleanTitle(product.title);
    if (next && next !== product.title) {
      if (samples.length < 12) samples.push(`  ${product.title}\n→ ${next}`);
      product.title = next;
      // search/SEO me purana naam bhi kaam aaye
      fileChanged += 1;
      changed += 1;
    }
  }
  if (write && fileChanged) fs.writeFileSync(full, `${JSON.stringify(data, null, 1)}\n`, "utf8");
  if (fileChanged) console.log(`${file}: ${fileChanged} titles`);
}

console.log(samples.join("\n"));
console.log(write ? `✅ ${changed} titles updated` : `ℹ️  dry run — ${changed} titles badlenge (--write lagaiye)`);
