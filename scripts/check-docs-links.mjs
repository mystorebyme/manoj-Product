#!/usr/bin/env node
/**
 * Docs link checker — "docs jo toote hue links rakhte hain, wo docs nahi hote".
 *
 * Sabhi `.md` files (repo root + docs/ + agent-guides/ + .claude/skills/ + apps/*) me
 * relative links aur inline `path/to/file` references check karta hai.
 *
 * Usage:
 *   node scripts/check-docs-links.mjs            # sirf report, exit 0
 *   node scripts/check-docs-links.mjs --strict   # toote link par exit 1 (CI)
 *
 * Kaise: markdown link `[text](target)` + inline code `` `path/file.ext` `` —
 * dono me agar target me `.md`/`.ts`/`.tsx`/`.mjs`/`.gs`/`.json` jaisi extension ho
 * aur wo file maujood na ho, to "broken" ginte hain. http(s), anchors aur
 * template (`<...>`, `*`) wale links chhod diye jaate hain.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const STRICT = process.argv.includes("--strict");
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "out", "dist", ".pages-preview-tmp", ".arena"]);
const EXT = /\.(md|tsx?|mjs|js|gs|json|ya?ml|toml|css|svg|png|jpg|webp|sh)$/i;
/**
 * Sirf repo-path jaise references check karte hain (`apps/…`, `docs/…`, `scripts/…`).
 * Bare filenames (`catalog.json`, `config/env.ts`) aur runtime files (`.data/orders.json`)
 * aksar illustration ke liye likhe jaate hain — unhe chhod dete hain, warna noise hi milta hai.
 */
const REPO_PREFIX = /^(apps|packages|scripts|docs|tests|database|agent-guides|infra|assets|images|public)\//;

/** repo ke saare .md files */
function allMarkdown(dir = ROOT, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".claude") continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) allMarkdown(full, out);
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

const problems = [];
const seen = new Set();
let checked = 0;

for (const file of allMarkdown()) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);
  // audit/incident report jaisi file purane (galat) paths jaan-boojh kar quote karti hai
  if (text.includes("docs-links: ignore-file")) continue;
  const lines = text.split("\n");

  const candidates = [];
  lines.forEach((line, index) => {
    // markdown link
    for (const match of line.matchAll(/\]\(([^)\s]+)\)/g)) candidates.push({ target: match[1], line: index + 1 });
    // inline code path
    for (const match of line.matchAll(/`([^`\s]+)`/g)) candidates.push({ target: match[1], line: index + 1 });
  });

  for (const { target, line } of candidates) {
    if (!target || /^(https?:|mailto:|tel:|#|\/\/)/.test(target)) continue;
    if (/[<>*{}$]/.test(target)) continue; // template/placeholder
    const clean = target.split("#")[0].replace(/^\.\//, "");
    if (!clean || !EXT.test(clean)) continue;
    if (!REPO_PREFIX.test(clean)) continue;

    // resolve: file ke folder se, phir repo root se
    const fromFile = path.resolve(path.dirname(file), clean);
    const fromRoot = path.resolve(ROOT, clean);
    checked += 1;
    const ok = fs.existsSync(fromFile) || fs.existsSync(fromRoot);
    if (ok) continue;
    const key = `${rel}:${line}:${clean}`;
    if (seen.has(key)) continue;
    seen.add(key);
    problems.push({ rel, line, target: clean });
  }
}

const perFile = new Map();
for (const problem of problems) perFile.set(problem.rel, (perFile.get(problem.rel) ?? 0) + 1);

console.log(`docs-links: ${checked} references checked in ${allMarkdown().length} files`);
console.log(`docs-links: ${problems.length} broken (${perFile.size} files)`);
for (const [file, count] of [...perFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${count.toString().padStart(3)} × ${file}`);
}
if (process.env.DOCS_LINKS_VERBOSE === "1") {
  for (const problem of problems) console.log(`  ${problem.rel}:${problem.line} → ${problem.target}`);
}
/**
 * Strict mode sirf "living docs" par lagta hai (jo agent/owner roz padhta hai).
 * Purane round logs aur PROGRESS.md historical hain — unme purane paths rehna normal
 * hai, unhe gate nahi karte.
 */
const LIVING = /^(README\.md|CLAUDE\.md|AGENTS\.md|STRUCTURE\.md|docs\/00-overview\/|docs\/09-devops\/(cloudflare-pages|netlify|vercel|repo-audit|round-3[89]|round-4)|docs\/03-architecture\/|\.claude\/skills\/|agent-guides\/)/;
const livingProblems = problems.filter((problem) => LIVING.test(problem.rel));
console.log(`docs-links: living docs me ${livingProblems.length} broken`);
for (const problem of livingProblems) console.log(`  ${problem.rel}:${problem.line} → ${problem.target}`);

if (STRICT && livingProblems.length) {
  console.error("docs-links: FAIL (strict)");
  process.exit(1);
}
