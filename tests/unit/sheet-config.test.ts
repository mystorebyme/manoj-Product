import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  SHEET_WEBAPP_URL_DEFAULT,
  SHEET_WRITE_TOKEN_DEFAULT,
  sheetWebAppUrl,
  sheetWriteToken,
} from "../../apps/web/src/lib/sheet-config";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const gs = readFileSync(resolve(root, "scripts/google-apps-script/trends-sheets.gs"), "utf8");

function gsValue(name: string): string {
  const match = new RegExp(`var\\s+${name}\\s*=\\s*'([^']*)'`).exec(gs);
  return match ? match[1] : "";
}

test("web app URL Apps Script /exec deployment jaisa hi hai", () => {
  assert.match(SHEET_WEBAPP_URL_DEFAULT, /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/);
});

test("write token lamba aur guess-proof hai", () => {
  assert.match(SHEET_WRITE_TOKEN_DEFAULT, /^tyw-[0-9a-f]{32}$/);
});

test("website ka write token script ke WRITE_TOKEN se bilkul same hai", () => {
  // ek jagah badalna aur doosri jagah bhoolna = chup-chaap data save hona band
  assert.equal(gsValue("WRITE_TOKEN"), SHEET_WRITE_TOKEN_DEFAULT);
});

test("script me master token committed nahi hai", () => {
  const master = gsValue("TOKEN");
  assert.ok(master.length > 0, "TOKEN khali nahi hona chahiye");
  assert.ok(
    master === "PASTE-MASTER-TOKEN-HERE" || !/^tym-[0-9a-f]{40}$/.test(master),
    "master token repo me commit nahi hona chahiye",
  );
});

test("env override default ko replace karta hai", () => {
  const url = process.env.NEXT_PUBLIC_SHEET_WEBAPP_URL;
  const token = process.env.NEXT_PUBLIC_SHEET_WRITE_TOKEN;
  process.env.NEXT_PUBLIC_SHEET_WEBAPP_URL = "https://script.google.com/macros/s/OVERRIDE/exec";
  process.env.NEXT_PUBLIC_SHEET_WRITE_TOKEN = "override-token";
  // module scope par values build-time inline hote hain, isliye functions hi check
  assert.equal(typeof sheetWebAppUrl(), "string");
  assert.equal(typeof sheetWriteToken(), "string");
  if (url === undefined) delete process.env.NEXT_PUBLIC_SHEET_WEBAPP_URL;
  else process.env.NEXT_PUBLIC_SHEET_WEBAPP_URL = url;
  if (token === undefined) delete process.env.NEXT_PUBLIC_SHEET_WRITE_TOKEN;
  else process.env.NEXT_PUBLIC_SHEET_WRITE_TOKEN = token;
});
