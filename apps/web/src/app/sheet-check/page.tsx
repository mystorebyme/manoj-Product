"use client";

import { useEffect, useState } from "react";
import { SHEET_WEBAPP_URL_DEFAULT, SHEET_WRITE_TOKEN_DEFAULT } from "@/lib/sheet-config";
import { appendUrl, flushSheetQueue, pendingRelayCount } from "@/lib/sheet-relay";

/**
 * Sheet connection test — owner ke liye, **sach me likh kar dekhta hai**.
 *
 * Pehle ye page bas "bhej diya" likh deta tha (chahe row pahunchi ho ya na ho) —
 * isi wajah se owner ko lagta tha sab theek hai. Ab har step ka asli jawab dikhta
 * hai, aur step 4 Apps Script se `{ok:true,written:1}` aane par hi ✅ hota hai.
 */

type Step = { name: string; state: "idle" | "busy" | "ok" | "fail"; detail?: string };

async function getJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, { cache: "no-store" });
  return (await response.json()) as Record<string, unknown>;
}

export default function SheetCheckPage() {
  const [steps, setSteps] = useState<Step[]>([
    { name: "Deployment zinda hai (`action=ping`)", state: "idle" },
    { name: "Write token match (`action=verify_write`)", state: "idle" },
    { name: "Public settings (`action=public`)", state: "idle" },
    { name: "Sheet me test row likhna (GET → jawab verify)", state: "idle" },
    { name: "Pending rows browser se bhejna", state: "idle" },
  ]);
  const [testRef, setTestRef] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => setPending(pendingRelayCount()), []);

  function setStep(index: number, patch: Partial<Step>) {
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  async function run() {
    setRunning(true);
    const url = SHEET_WEBAPP_URL_DEFAULT;

    setStep(0, { state: "busy" });
    try {
      const body = await getJson(`${url}?action=ping`);
      setStep(
        0,
        body.ok
          ? { state: "ok", detail: `version ${String(body.version ?? "?")}` }
          : { state: "fail", detail: String(body.error ?? "purana deployment") },
      );
    } catch {
      setStep(0, { state: "fail", detail: "network / CORS — deployment check karein" });
    }

    setStep(1, { state: "busy" });
    try {
      const body = await getJson(
        `${url}?action=verify_write&token=${encodeURIComponent(SHEET_WRITE_TOKEN_DEFAULT)}`,
      );
      setStep(
        1,
        body.writeTokenMatch
          ? { state: "ok" }
          : { state: "fail", detail: "script ka WRITE_TOKEN match nahi karta — r9 code dobara paste karein" },
      );
    } catch {
      setStep(1, { state: "fail", detail: "jawab padha nahi ja saka" });
    }

    setStep(2, { state: "busy" });
    try {
      const body = await getJson(`${url}?action=public`);
      setStep(
        2,
        body.ok ? { state: "ok", detail: `whatsapp: ${String((body.settings as Record<string, unknown>)?.whatsapp ?? "—")}` } : { state: "fail" },
      );
    } catch {
      setStep(2, { state: "fail", detail: "settings nahi mile" });
    }

    setStep(3, { state: "busy" });
    const ref = `TY-CHECK-${Date.now()}`;
    setTestRef(ref);
    try {
      const response = await fetch(
        appendUrl(SHEET_WEBAPP_URL_DEFAULT, SHEET_WRITE_TOKEN_DEFAULT, [
          {
            sheet: "Orders",
            row: {
              "Order ID": ref,
              "Date & Time": new Date().toISOString(),
              Event: "browser-check",
              Status: "test",
              Customer: "Sheet check page",
              "Total ₹": 1,
              Source: "sheet-check",
            },
          },
        ]),
        { cache: "no-store" },
      );
      const body = (await response.json()) as { ok?: boolean; written?: number; error?: string };
      setStep(
        3,
        body.ok
          ? {
              state: "ok",
              detail:
                (body.written ?? 0) > 0
                  ? `row likhi gayi (ref ${ref})`
                  : "row pehle se thi (duplicate nahi likhi)",
            }
          : {
              state: "fail",
              detail:
                body.error === "unknown action"
                  ? "Apps Script me naya (r9) code paste nahi hua — repo ki trends-sheets.gs copy karein, phir Deploy → Manage deployments → New version"
                  : `${body.error ?? "unknown"} — sheet/deployment check karein`,
            },
      );
    } catch {
      setStep(3, { state: "fail", detail: "GET write fail — CORS ya deployment" });
    }

    setStep(4, { state: "busy" });
    try {
      const sent = await flushSheetQueue(true);
      setPending(pendingRelayCount());
      setStep(4, { state: "ok", detail: `${sent} pending rows bheji gayi` });
    } catch {
      setStep(4, { state: "fail", detail: "queue flush fail" });
    }

    setRunning(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="eyebrow">Diagnostics</p>
      <h1 className="mt-2 font-display text-[30px]">Google Sheet connection test</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-[#6f6259]">
        Ye page aapke browser se seedha Google Sheet tak ka rasta test karta hai — bilkul waise hi jaise ek
        customer ka order jaata hai. Step 4 me Apps Script se <code>{`{ok:true, written:1}`}</code> aana
        chahiye; tabhi sheet ke <strong>Orders</strong> tab me <code>{testRef ?? "TY-CHECK-…"}</code> row dikhegi.
      </p>

      <dl className="mt-6 space-y-1 border border-[#e6dac7] bg-[#fdfaf5] p-4 text-[12px]">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-[#8a7d72]">Web app</dt>
          <dd className="break-all">{`${SHEET_WEBAPP_URL_DEFAULT.slice(0, 58)}…`}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-[#8a7d72]">Write token</dt>
          <dd className="break-all">{`${SHEET_WRITE_TOKEN_DEFAULT.slice(0, 10)}…${SHEET_WRITE_TOKEN_DEFAULT.slice(-4)}`}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-[#8a7d72]">Pending rows</dt>
          <dd className="break-all">
            {pending} {pending > 0 ? "(internet aate hi khud chali jayengi)" : "(sab bhej di gayi)"}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={run}
        disabled={running}
        data-testid="sheet-check-run"
        className="mt-5 inline-flex h-11 items-center justify-center bg-[#4a1220] px-6 text-[11px] font-semibold tracking-[.14em] text-white uppercase disabled:opacity-60"
      >
        {running ? "Checking…" : "Run check"}
      </button>

      <div className="mt-6 border border-[#e6dac7] bg-[#fdfaf5] p-4 text-[12px] leading-relaxed text-[#5b5148]">
        <p className="font-semibold text-[#4a1220]">Data sheet me nahi aa raha? 2 minute ka fix:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Sheet → Extensions → Apps Script → poora purana code hata kar repo ki <code>scripts/google-apps-script/trends-sheets.gs</code> paste karein.</li>
          <li>Deploy → <strong>Manage deployments</strong> → pencil (Edit) → Version: <strong>New version</strong> → Deploy.</li>
          <li>Yahan <strong>Run check</strong> dabayein — step 1 me version <code>2026-10-25.r9</code> aur step 4 me <code>row likhi gayi</code> aana chahiye.</li>
        </ol>
      </div>

      <ol className="mt-6 divide-y divide-[#ece1d3] border border-[#e6dac7]">
        {steps.map((step) => (
          <li key={step.name} className="flex items-start gap-3 px-4 py-3 text-[12.5px]">
            <span aria-hidden className="mt-0.5 w-4 text-center">
              {step.state === "ok" ? "✅" : step.state === "fail" ? "❌" : step.state === "busy" ? "…" : "•"}
            </span>
            <span className="flex-1">
              {step.name}
              {step.detail ? <span className="block text-[11.5px] text-[#8a7d72]">{step.detail}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
