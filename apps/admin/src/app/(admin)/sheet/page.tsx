import Link from "next/link";
import { getSheetOverview } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Google Sheet" };

/**
 * Google Sheet = owner ka control panel.
 * Yahan wahi data dikhta hai jo sheet me hai (settings + last order/payment/message rows),
 * aur admin Settings se edit karne par sheet bhi update ho jaati hai.
 */
export default async function SheetPage() {
  const overview = await getSheetOverview();
  const settings = overview.settings ?? {};
  const recent = overview.recent ?? { orders: [], payments: [], messages: [] };
  const orderRows = recent.orders.slice(0, 10);
  const columns = ["Order ID", "Date & Time", "Event", "Status", "Customer", "Phone", "Total ₹", "Payment status"];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Google Sheet</h1>
          <p>TRENDS YOUNIQUE — Store DB (Orders · Products · Settings) ka live data</p>
        </div>
        <div className="actions">
          <Link className="btn" href="/settings">
            Edit settings
          </Link>
          <Link className="btn" href="/orders">
            Orders
          </Link>
        </div>
      </div>

      <div className={`notice ${overview.configured ? "" : "warn"}`} data-testid="sheet-status">
        {overview.configured ? (
          <>
            <strong>Connected</strong>
            {" "}— settings sheet se live aati hain (15 s), aur har order / payment / message row sheet me
            append hoti hai. Sheet ka link/token sirf server ke paas rehta hai, kabhi website par nahi dikhta.
            {(overview.pending ?? 0) > 0 ? (
              <div style={{ marginTop: 6 }}>
                {overview.pending} row(s) sheet tak nahi pahunchi — queue me safe hain, agli call par khud
                chali jayengi (kuch karne ki zaroorat nahi).
              </div>
            ) : null}
            {overview.reachable === false ? (
              <div style={{ marginTop: 6, color: "var(--danger)" }}>
                Sheet URL configured hai par reply nahi aaya — Apps Script deployment (&quot;Anyone&quot;) aur token
                check kariye.
              </div>
            ) : null}
          </>
        ) : (
          <>
            <strong>Sheet connected nahi hai.</strong> Site Postgres/JSON par chal rahi hai. Setup:{" "}
            <span className="mono">docs/09-devops/google-sheets.md</span> — Apps Script deploy karke{" "}
            <span className="mono">GOOGLE_SHEETS_WEBAPP_URL</span> +{" "}
            <span className="mono">GOOGLE_SHEETS_TOKEN</span> set kariye. {overview.hint}
          </>
        )}
      </div>

      {/* ── Setup guide — owner yahin se copy karke 5 minute me connect kar sakta hai ── */}
      <div className="panel" data-testid="sheet-setup-steps">
        <div className="panel-head">
          <h2>Sheet setup — 5 minute (ek hi baar)</h2>
          <span className="badge">Apps Script</span>
        </div>
        <div className="panel-body">
          <ol style={{ margin: "0 0 10px", paddingLeft: 20, lineHeight: 1.9 }}>
            <li>
              Sheet kholiye → menu <strong>Extensions → Apps Script</strong>.
            </li>
            <li>
              Repo ki file <span className="mono">scripts/google-apps-script/trends-sheets.gs</span> ka{" "}
              <strong>poora code</strong> paste kariye (purana code hata dijiye).
            </li>
            <li>
              Sabse upar do line badliye: <span className="mono">TOKEN</span> aur{" "}
              <span className="mono">WRITE_TOKEN</span> — dono me apna lamba random word (jaise{" "}
              <span className="mono">trends-9f3k2m-2026</span>).
            </li>
            <li>
              <strong>Save → Run → <span className="mono">setup</span></strong> → permission maange to{" "}
              <em>Review permissions → Allow</em>. (Isse saari tabs + headers + Settings ban jaate hain.)
            </li>
            <li>
              <strong>Deploy → New deployment → Web app</strong> · Execute as <strong>Me</strong> · Who has access{" "}
              <strong>Anyone</strong> → Deploy → <span className="mono">…/exec</span> URL copy.
            </li>
            <li>
              Settings me daaliye: <span className="mono">NEXT_PUBLIC_SHEET_WEBAPP_URL</span> = wahi{" "}
              <span className="mono">/exec</span> URL,{" "}
              <span className="mono">NEXT_PUBLIC_SHEET_WRITE_TOKEN</span> = <span className="mono">WRITE_TOKEN</span>{" "}
              ki value. (GitHub Pages par: repo → Settings → Variables → Actions me{" "}
              <span className="mono">SHEET_WEBAPP_URL</span> + <span className="mono">SHEET_WRITE_TOKEN</span> naam se.)
            </li>
            <li>
              Dobara deploy kariye — pehla order aate hi yahan &quot;Connected&quot; dikhne lagega.
            </li>
          </ol>
          <p className="small muted" style={{ margin: 0 }}>
            Code badalne par: <strong>Deploy → Manage deployments → Edit → New version → Deploy</strong> (URL wahi
            rehta hai). Poora guide: <span className="mono">docs/09-devops/google-sheets.md</span>
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Admin panel link</h2>
          <span className="badge">sheet: admin_url</span>
        </div>
        <div className="panel-body">
          {settings.adminUrl ? (
            <p style={{ margin: 0 }}>
              <a href={settings.adminUrl} target="_blank" rel="noreferrer" className="mono">
                {settings.adminUrl}
              </a>
              <span className="small muted" style={{ display: "block", marginTop: 4 }}>
                Ye link sheet ke <span className="mono">Settings → admin_url</span> se aata hai — customer ko kabhi
                nahi dikhta.
              </span>
            </p>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              Sheet ke <span className="mono">Settings</span> tab me <span className="mono">admin_url</span> row me
              apne admin panel ka link daaliye — yahan dikhne lagega.
            </p>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Live settings (sheet se)</h2>
          <span className="badge">{overview.configured ? "google-sheet" : "admin/db"}</span>
        </div>
        <div className="panel-body">
          <div className="row">
            <div className="field">
              <label>UPI ID (payments)</label>
              <div className="mono">{settings.upiId ?? "—"}</div>
            </div>
            <div className="field">
              <label>UPI payee name</label>
              <div>{settings.upiName ?? "—"}</div>
            </div>
            <div className="field">
              <label>Support phone</label>
              <div>{settings.supportPhone ?? "—"}</div>
            </div>
            <div className="field">
              <label>WhatsApp</label>
              <div>{settings.whatsapp ?? "—"}</div>
            </div>
            <div className="field">
              <label>Support email</label>
              <div className="mono">{settings.supportEmail ?? "—"}</div>
            </div>
            <div className="field">
              <label>Free shipping</label>
              <div>{settings.freeShipping === false ? "No" : "Yes"}</div>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Announcement bar</label>
            <div>{settings.announcement || <span className="muted">default copy</span>}</div>
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            Settings page se save karte hi ye values sheet me bhi likh di jaati hain, aur sheet me seedha edit
            karne par 15 second me website par aa jaati hain.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Recent orders (sheet rows)</h2>
          <span className="badge">{orderRows.length} rows</span>
        </div>
        {orderRows.length === 0 ? (
          <div className="panel-body small muted">
            Sheet me abhi koi row nahi (ya sheet connected nahi). Naya order aate hi yahan turant dikhega.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orderRows.map((row, index) => (
                <tr key={`${row["Order number"] ?? "row"}-${index}`}>
                  {columns.map((column) => (
                    <td key={column} className={column === "Order number" ? "mono" : undefined}>
                      {String(row[column] ?? "").slice(0, 60)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Recent payments</h2>
        </div>
        {recent.payments.length === 0 ? (
          <div className="panel-body small muted">Payment rows yahan dikhengi (UTR submit / verified).</div>
        ) : (
          <table>
            <thead>
              <tr>
                {["Timestamp", "Event", "Order number", "Payment status", "Payment reference", "Total"].map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.payments.slice(0, 8).map((row, index) => (
                <tr key={index}>
                  {["Timestamp", "Event", "Order number", "Payment status", "Payment reference", "Total"].map((column) => (
                    <td key={column}>{String(row[column] ?? "").slice(0, 40)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
