"use client";

import { useEffect, useState } from "react";
import { SHEET_WEBAPP_URL_DEFAULT, SHEET_WRITE_TOKEN_DEFAULT } from "@/lib/sheet-config";
import { lastRelayLog, relayRows } from "@/lib/sheet-relay";

/**
 * Sheet connection test — owner ke liye.
 *
 * Site se sheet tak pahunch ka poora rasta yahin dikhta hai: deployment zinda hai?
 * write token match karta hai? ek test row sach me likh ke dekho. Sab browser se
 * hota hai, isliye jo natija yahan dikhta hai wahi customer ke order par bhi hota hai.
 */

type Step = { name: string; state: "idle" | "busy" | "ok" | "fail"; detail?: string };

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store" });
  return response.json();
}

export default function SheetCheckPage() {
  const [steps, setSteps] = useState<Step[]>([
    { name: "Deployment (`action=ping`)", state: "idle" },
    { name: "Write token match (`action=verify_write`)", state: "idle" },
    { name: "Settings padhna (`action=public`)", state: "idle" },
    { name: "Test row likhna (POST)", state: "idle" },
  ]);
  const [log, setLog] = useState<{ at: number; rows: number; sheets: string[] } | null>(null);
  const [testRef, setTestRef] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => setLog(lastRelayLog()), []);

  function setStep(index: number, patch: Partial<Step>) {
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  async function run() {
    setRunning(true);
    const url = SHEET_WEBAPP_URL_DEFAULT;

    setStep(0, { state: "busy" });
    try {
      const body = (await getJson(`${url}?action=ping`)) as { ok?: boolean; version?: string };
      setStep(0, body.ok ? { state: "ok", detail: `version ${body.version ?? "?"}` } : { state: "fail", detail: "purana version deploy hai" });
    } catch {
      setStep(0, { state: "fail", detail: "network / CORS — deployment check karein" });
    }

    setStep(1, { state: "busy" });
    try {
      const body = (await getJson(
        `${url}?action=verify_write&token=${encodeURIComponent(SHEET_WRITE_TOKEN_DEFAULT)}`,
      )) as { writeTokenMatch?: boolean };
      setStep(1, body.writeTokenMatch ? { state: "ok" } : { state: "fail", detail: "script ka WRITE_TOKEN match nahi karta" });
    } catch {
      setStep(1, { state: "fail", detail: "response padha nahi ja saka" });
    }

    setStep(2, { state: "busy" });
    try {
      const body = (await getJson(`${url}?action=public`)) as { ok?: boolean; settings?: Record<string, unknown> };
      setStep(2, body.ok ? { state: "ok", detail: `whatsapp: ${String(body.settings?.whatsapp ?? "—")}` } : { state: "fail" });
    } catch {
      setStep(2, { state: "fail", detail: "settings nahi mile" });
    }

    setStep(3, { state: "busy" });
    const ref = `TY-CHECK-${Date.now()}`;
    setTestRef(ref);
    relayRows([
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
    ]);
    // form POST fire-and-forget hai — thoda intezaar, phir sheet me row dekhiye
    window.setTimeout(() => {
      setStep(3, { state: "ok", detail: `ref ${ref} bheja gaya` });
      setLog(lastRelayLog());
      setRunning(false);
    }, 2500);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="eyebrow">Diagnostics</p>
      <h1 className="mt-2 font-display text-[30px]">Google Sheet connection test</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-[#6f6259]">
        Ye page aapke browser se seedha Google Sheet tak ka rasta test karta hai — bilkul waise hi jaise ek
        customer ka order jaata hai. &quot;Test row likhna&quot; dabane ke baad sheet ke{" "}
        <strong>Orders</strong> tab me <code>TY-CHECK-…</code> row dikhni chahiye.
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
          <dt className="w-24 shrink-0 text-[#8a7d72]">Last relay</dt>
          <dd className="break-all">
            {log
              ? `${new Date(log.at).toLocaleString("en-IN")} · ${log.rows} row → ${log.sheets.join(", ")}`
              : "is browser se koi relay nahi hua"}
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

      <ol className="mt-6 divide-y divide-[#ece1d3] border border-[#e6dac7]">
        {steps.map((step) => (
          <li key={step.name} className="flex items-start gap-3 px-4 py-3 text-[12.5px]">
            <span aria-hidden className="mt-0.5 w-4 text-center">
              {step.state === "ok" ? "✅" : step.state === "fail" ? "❌" : step.state === "busy" ? "…" : "•"}
            </span>
            <span className="flex-1">
              {step.name}
              {step.detail ? <span className="mt-0.5 block text-[11.5px] text-[#8a7d72]">{step.detail}</span> : null}
            </span>
          </li>
        ))}
      </ol>

      {testRef ? (
        <p className="mt-4 text-[11.5px] leading-relaxed text-[#6f6259]">
          Test row ka ref: <code>{testRef}</code> — sheet me na dikhe to seedha owner ko bata dein.
        </p>
      ) : null}
    </div>
  );
}
