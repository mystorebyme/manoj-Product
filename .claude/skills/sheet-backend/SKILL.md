---
name: sheet-backend
description: Change the live backend — Google Sheet schema, order/status flow, stock, tracking, and customer emails — inside scripts/google-apps-script/trends-sheets.gs, and test it in Node before the owner pastes it.
---

# Sheet backend (Google Apps Script) — live engine

`scripts/google-apps-script/trends-sheets.gs` **hi backend hai** (koi Node server nahi).
Sheet = database. Site sirf `?action=…` endpoints call karti hai.

Sach / topology: `docs/00-overview/production-topology.md`.
Email + queue detail: `docs/09-devops/round-38.md`.

## 1. File ka naksha (BHAG)

| BHAG | Kya |
| --- | --- |
| 0 | constants — `VERSION`, `HEADERS` (har tab ke columns), `WEBAPP_PUBLIC_BASE` |
| 1 | setup — `setup()` saare tabs + settings + `Read Me` |
| 2 | helpers — `text_`, `int_`, `num_`, `nowIso_`, `headersOf_`, `ensureTab_` |
| 3 | read — `publicSettings_`, `productsPublic_`, `orderStatus_`, `timeline_`, `stock_` |
| 4 | write — `append_`, `upsert_`, `placeOrder_`, `settingsSave_` |
| 5 | orders — `adminSetOrderStatus_`, `notifyOrder_`, `renderTemplate_` |
| 6 | catalogue / reviews / content (banners, FAQs, categories) |
| 7 | reports + invoice |
| 8 | triggers — `onEditAutoStatus`, daily digest, `installTriggers` |
| 9 | **email** — `MailQueue`, `sendOrderEmail_`, `orderEmailHtml_`, queue retry |
| 9b | **email providers** — `EmailKeys` tab, Brevo/EmailJS/Resend/Mailjet/ElasticEmail/Web3Forms |
| 10 | self-test — `runSelfTests()` (100+ check) |

## 2. Rules (inme se koi bhi todna = site tootegi)

1. **`HEADERS` hi schema hai.** Tab/column add karne par `HEADERS` me add karo, phir `setup()`
   chalao — `ensureTab_` nayi column bana deta hai. Purane rows khaali column lete hain (safe).
2. **V8 me `includes` par bharosa mat karo** — sheet ke runtime me kabhi-kabhi help nahi karta;
   `indexOf(...) >= 0` use karo.
3. **`SpreadsheetApp.getUi()` sirf try/catch ke andar** — web app request me UI hoti hi nahi.
4. **Koi bhi naya public endpoint `publicSettings_` jaisa hi safe ho** — token/secret kabhi
   response me nahi.
5. **Order flow kabhi ruke na:** email/notification sab `try/catch` me; order row pehle save,
   uske baad mail.
6. **`?action=ping` ka `VERSION` badlo** har meaningful change par (site/admin isi se check karte hain).
7. **Stock semantics:** `Stock` tab me row na ho = **unlimited**; qty 0 = out of stock.
   Order par `stockReduce_` kam karta hai, cancel/return par `stockRestore_` wapas.

## 3. Test (paste karne se pehle, Node me)

```bash
npm run sheet:test        # 16 test — setup, self-test, order flow, email providers
```

Harness: `tests/helpers/apps-script-harness.mjs` — fake Sheet/Mail/UrlFetch.
`FakeRange` me naye methods (jaise `setFrozenRows`) add karna pad sakta hai jab naya tab banao.

Self-test (100+ check) khud sheet me: menu **9. Sab kuch test karo** ya `?action=selftest`.

## 4. Deploy (owner karta hai — agent nahi kar sakta)

1. `trends-sheets.gs` poora copy → Apps Script editor me paste.
2. `setup` Run (permission: sheet; email ke liye `authorizeMail` alag se).
3. **Deploy → Manage deployments → Edit → Version: New version → Deploy** (URL same).
4. Verify: `?action=ping` → naya version; phir self-test.

**Bhool na jayein:** code push karna kaafi nahi — jab tak owner new version deploy na kare,
live sheet purana code chalati rehti hai (`docs/09-devops/round-38.md` §4).

## 5. Common kaam

| Kaam | Kahan |
| --- | --- |
| Naya customer email/status | `EMAIL_STEPS`, `orderEmailSubject_`, `orderEmailHtml_` |
| Email provider / retry | `EMAIL_PROVIDER_INFO`, `EMAIL_SLOT_PLAN`, `sendMailNow_`, `processMailQueue_` |
| Naya sheet column | `HEADERS` + us tab ka mapper + self-test |
| Naya site endpoint | `doGet` switch + `publicSettings_`-style safe response |
| Tracking steps ka text | `renderTemplate_` / `ORDER_STEPS` (site: `lib/tracking.ts`) |
| Stock block/allow | `stockCheck_`, `stockReduce_`, `stockRestore_` |
