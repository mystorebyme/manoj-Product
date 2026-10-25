/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  TRENDS YOUNIQUE — poora store, ek Google Sheet ke andar
 *  `trends-sheets.gs` · version 2026-10-25.r18 · ~4,400 lines
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Ye script aapki Google Sheet ko website ka **database + admin panel** bana
 *  deti hai. Sheet me row badlo → website 15 second me wahi dikhati hai. Naya
 *  deploy karne ki zaroorat nahi.
 *
 *  ─────────────────────────────────────────────────────────────────────────
 *  AAP (owner) ko kya karna hai — 5 minute, ek baar
 *  ─────────────────────────────────────────────────────────────────────────
 *   1. Sheet kholiye → **Extensions → Apps Script**
 *   2. Is file ka poora code paste kariye
 *   3. Neeche `TOKEN` me apna lamba random word daaliye (jaise 'trends-9f3k2m-2026')
 *   4. **Save** → Run → `setup`  (permission maange to Review → Allow)
 *   5. **TRENDS tools → 9. Sab kuch test karo (self-test)** — 97 check khud chalenge
 *   6. Deploy → **New deployment** → type "Web app"
 *        Execute as: **Me**   ·   Who has access: **Anyone**
 *      → Deploy → `/exec` URL copy kariye
 *   7. Website ke env me: `GOOGLE_SHEETS_WEBAPP_URL` = wahi URL,
 *      `GOOGLE_SHEETS_TOKEN` = wahi TOKEN
 *
 *  Code badalne par: Deploy → **Manage deployments → Edit → New version → Deploy**
 *  (URL wahi rehta hai).
 *
 *  ─────────────────────────────────────────────────────────────────────────
 *  SHEET KE TABS — kis tab ka kya kaam
 *  ─────────────────────────────────────────────────────────────────────────
 *   Settings      → WhatsApp, UPI, announcement, qty limits, blocked state/PIN,
 *                   free shipping, GST, return window, owner email. Site yahan se
 *                   padhti hai (cache 5 min, save karte hi refresh).
 *   Orders        → har order ek row: customer, address, totals, Status, courier,
 *                   AWB, payment. `Status` badalte hi timeline + customer message.
 *   Order Items   → order ka har item alag row (colour, size, qty, price, photo).
 *   Order Updates → tracking ke comment — **ek step par 2-3 comment** bhi ho sakte
 *                   hain. `Visible` = no wali row customer ko nahi dikhti.
 *   Payments      → payment/UPI si rows (order ke saath khud banti hain).
 *   Enquiries     → cart se WhatsApp order ki rows.
 *   Messages      → contact form ke messages.
 *   Newsletter    → email subscribers.
 *   Reviews       → Product ID + approval (`Status`), aur **`Images`** me customer
 *                   ki asli photos (site par gallery me dikhti hain).
 *   Returns       → return/exchange request (7 din ke andar, Settings se).
 *   Products      → admin panel ka product row (+ Product ID, sirf admin).
 *   ProductList   → saare products: ID, Handle, Title, Price, **saari image links**,
 *                   image count, collections, URL (`IMPORTDATA` se khud bharti hai).
 *   MainImage     → handle → main photo (site usi photo ko pehli dikhati hai).
 *   ProductImages → har photo ki row → badal/`delete`/add karne ka control.
 *   ImagesAll     → **har product ki har photo** ek row me, ID ke saath (padhne ke liye).
 *   Stock         → size-wise stock (`khaali` = unlimited). Order par khud kam hota hai.
 *   Coupons       → percent / flat / free-shipping coupon, min order, expiry, usage limit.
 *   Banners · FAQs · Categories → home page content aur nav, sheet se.
 *   AddressCheck  → state↔PIN verification ka log (sirf owner).
 *   Notifications → kaunsa WhatsApp/email gaya, kab gaya.
 *   AuditLog      → kisne kya badla (status, coupon, stock, settings).
 *
 *  ─────────────────────────────────────────────────────────────────────────
 *  WEBSITE JO ENDPOINTS USE KARTI HAI
 *  ─────────────────────────────────────────────────────────────────────────
 *  Public (token ke bina):
 *    ?action=public                          → settings (brand, whatsapp, limits…)
 *    ?action=reviews&handle=…&id=…           → approved reviews + photos
 *    ?action=reviews_all&limit=60            → home page ticker
 *    ?action=products_public                 → main image overrides
 *    ?action=images_public                   → gallery overrides (ProductImages)
 *    ?action=order_status&order=…&phone=…    → tracking (5 step + comments)
 *    ?action=timeline&order=…&phone=…        → wahi data, naya naam
 *    ?action=coupons[&code=…&total=…]        → coupon list / validate
 *    ?action=stock[&handle=…]                → size-wise stock
 *    ?action=banners | faqs | categories     → content
 *    ?action=search&q=…                      → product search
 *    ?action=invoice&order=…&phone=…         → printable invoice (HTML)
 *    ?action=ping | verify_write             → version / token check
 *  Master token ke saath (admin):
 *    ?action=selftest                        → 97 check ka report
 *    ?action=reports&type=summary|daily|products|customers|stock
 *    ?action=returns | pending_reviews | settings | schema | diag | health | recent
 *    ?action=import_reviews | append_test
 *    POST action=append | upsert | settings_save | place_order | order_status |
 *         order_note | coupon_save | coupon_disable | stock_set | return_request |
 *         review_moderate | banner_save | faq_save | category_save | notify_resend |
 *         address_check
 *
 *  ─────────────────────────────────────────────────────────────────────────
 *  MENU — "TRENDS tools"
 *  ─────────────────────────────────────────────────────────────────────────
 *   0. Setup                          → tabs + settings + dropdowns (safe, data nahi chhedta)
 *   1. Products  → list · ProductImages · ImagesAll · Product ID
 *   2. Reviews   → import · Product ID · photos · approval help
 *   3. Orders    → 5 step comments · daily digest · low stock · coupons
 *   4. Reports   → summary · 7 din ki sale · top products · top customers
 *   9. Self-test → 97 check (sb pass = sab theek)
 *  10. Triggers  → Status badalne par timeline + message, roz 9 baje digest
 *  11. Cleanup   → purani log rows saaf
 *
 *  ─────────────────────────────────────────────────────────────────────────
 *  FILE KA LAYOUT (4,400+ lines — dhoondhna aasan rahe)
 *  ─────────────────────────────────────────────────────────────────────────
 *    BHAG 0  Config, HEADERS, default settings            ( ~250 lines)
 *    BHAG 1  Sheet helpers, product/image sync, setup     ( ~900 lines)
 *    BHAG 2  Chhote helpers (text, money, phone, PIN…)    ( ~250 lines)
 *    BHAG 3  Settings cache · Stock · Coupons             ( ~360 lines)
 *    BHAG 4  Notifications · Invoice · Audit log          ( ~290 lines)
 *    BHAG 5  Order lifecycle · Returns                    ( ~600 lines)
 *    BHAG 6  Reports · Banners/FAQs/Categories · Search   ( ~250 lines)
 *    BHAG 7  doGet/doPost (website ke endpoints)          ( ~800 lines)
 *    BHAG 8  Self-test (97 check) · Menu · Triggers       ( ~900 lines)
 *
 *  ─────────────────────────────────────────────────────────────────────────
 *  RULES (jo kabhi nahi todne)
 *  ─────────────────────────────────────────────────────────────────────────
 *   • Customer ka **phone/address kabhi public endpoint se nahi** — order tracking
 *     ke liye order number + registered mobile dono chahiye.
 *   • **Product ID sirf admin ke liye** — storefront par kabhi nahi dikhti.
 *   • **Koi online payment site par nahi** — UPI/cash on delivery hi.
 *   • Har likhne wala kaam `LockService` ke andar (do order ek saath na aa jayein).
 *   • Data kabhi delete nahi — `delete` likhne par sirf site se hat’ta hai.
 */

var TOKEN = 'PASTE-MASTER-TOKEN-HERE';

/**
 * **Write-only token** — sirf rows add kar sakta hai (padh nahi sakta).
 *
 * GitHub Pages (static site) par server hota hi nahi, isliye browser se seedha
 * yahan POST aata hai aur ye token site ke JS me hota hai. Isliye ise sirf
 * `WRITE_SHEETS` me hi likhne ki permission hai, row cap hai, aur settings/
 * recent/health is token se nahi khulte. Kuch galat lage to ise badal kar
 * redeploy kar dein — purana token turant band ho jaayega.
 */
var WRITE_TOKEN = 'tyw-cb77177528f9474049ffa98fead4cee1';

/**
 * **Script Properties** (Project Settings → Script properties) — code chhede bina
 * token/spreadsheet badalne ka rasta. Yahan set ho to neeche ke constants par
 * bhaari padta hai:
 *   MASTER_TOKEN   = asli master token (placeholder ki jagah)
 *   WRITE_TOKEN    = naya write token
 *   SPREADSHEET_ID = sheet ka ID (script standalone ho tab zaroori)
 */
/** Master token asli hai ya abhi bhi placeholder? (placeholder par reads band) */
function masterTokenConfigured_() {
  return MASTER_PLACEHOLDERS.indexOf(String(MASTER_TOKEN || '')) < 0;
}

function prop_(key) {
  try {
    var value = PropertiesService.getScriptProperties().getProperty(key);
    return value ? String(value).trim() : '';
  } catch (error) {
    return '';
  }
}

var MASTER_TOKEN = prop_('MASTER_TOKEN') || TOKEN;
var EFFECTIVE_WRITE_TOKEN = prop_('WRITE_TOKEN') || WRITE_TOKEN;
var SPREADSHEET_ID = prop_('SPREADSHEET_ID');
/** placeholder = "owner ne abhi apna token nahi daala" (read band rehta hai) */
var MASTER_PLACEHOLDERS = ['', 'PASTE-MASTER-TOKEN-HERE', 'CHANGE-ME-trends-token'];
var WRITE_SHEETS = ['Orders', 'Order Items', 'Enquiries', 'Messages', 'Newsletter', 'Reviews', 'AddressCheck'];
var MAX_WRITE_ROWS = 40;

/** Script version — `?action=ping` se dikhta hai (kaun sa code deploy hai). */
var VERSION = '2026-10-25.r18';

var HEADERS = {
  Orders: [
    'Order ID', 'Date & Time', 'Event', 'Status', 'Customer', 'Phone', 'WhatsApp', 'Email',
    'Address', 'City', 'State', 'PIN', 'Items', 'Qty total', 'Subtotal ₹', 'Discount ₹',
    'Coupon', 'Shipping ₹', 'Total ₹', 'Payment method', 'Payment status', 'Payment ref',
    'Courier', 'AWB', 'Tracking URL', 'Notes', 'Source',
  ],
  'Order Items': [
    'Order ID', 'Date & Time', 'Product', 'Handle', 'Colour', 'Size', 'Qty',
    'Price ₹', 'Line total ₹', 'Product link', 'Image', 'Order status',
  ],
  Products: [
    'Handle', 'Product name', 'Price ₹', 'MRP ₹', 'Discount %', 'Sizes', 'Colours', 'Images',
    'Collection', 'Category', 'Fabric', 'Description', 'Stock', 'Status', 'Updated',
    // admin ke liye pehchaan — site par customer ko kabhi nahi dikhta
    'Product ID',
  ],
  Enquiries: [
    'Date & Time', 'Enquiry ID', 'Type', 'Customer', 'Phone', 'Items', 'Qty total',
    'Value ₹', 'Message', 'Source page',
  ],
  Payments: [
    'Timestamp', 'Event', 'Order ID', 'Status', 'Customer', 'Phone', 'Total ₹',
    'Payment status', 'Payment ref', 'UPI ID', 'Method', 'Notes',
  ],
  Settings: ['key', 'value', 'notes'],
  Messages: ['Timestamp', 'Name', 'Email', 'Phone', 'Subject', 'Message', 'Status'],
  Newsletter: ['Timestamp', 'Email', 'Source'],
  // `Product ID` = site ka product id (jaise 1042) — review ko sahi product par
  // lagane ka sabse pakka tarika (handle badal jaye to bhi kaam karta hai).
  // `Product ID` pehle column me hai (live sheet isi order par hai) — setup dobara
  // chalne par header rewrite nahi hota, isliye data kabhi shift nahi hota.
  Reviews: [
    'Product ID', 'Timestamp', 'Handle', 'Product', 'Name', 'Rating', 'Title', 'Body', 'Status',
    'Source',
    // customer ki asli photos (Trustoo) — ` | ` se alag. Reviews tab me ye add hota hai
    // (aakhir me), isliye purane rows shift nahi hote.
    'Images',
  ],
  // Address ↔ PIN verification ka log (customer ko kabhi nahi dikhta).
  // Owner isi se decide karta hai kaunsa state / PIN block karna hai.
  AddressCheck: [
    'Timestamp', 'Result', 'Customer', 'Phone', 'Address', 'City', 'State chosen', 'PIN',
    'PIN state', 'District', 'Blocked', 'Source page',
  ],
  // Order tracking ke messages — owner yahan row likhta hai, site par timeline me dikhta hai.
  'Order Updates': ['Order ID', 'Date & Time', 'Status', 'Message', 'Visible'],
  // Coupon codes — site `?action=coupons&code=…` se validate karti hai.
  Coupons: [
    'Code', 'Type', 'Value', 'Min order ₹', 'Max discount ₹', 'Valid till', 'Usage limit',
    'Used', 'Active', 'Note',
  ],
  // Home / collection banners — sheet se badalne wali marketing lines
  Banners: ['Slot', 'Title', 'Subtitle', 'Image', 'Link', 'Order', 'Active'],
  FAQs: ['Question', 'Answer', 'Order', 'Active'],
  Categories: ['Slug', 'Title', 'Image', 'Order', 'Active'],
  // Return / exchange requests (customer kabhi bhi bhej sakta hai)
  Returns: ['Return ID', 'Order ID', 'Date & Time', 'Reason', 'Status', 'Refund ₹', 'Note', 'Pickup'],
  // WhatsApp / email bhejne ka log — kya gaya, kab gaya, kaam hua ya nahi
  Notifications: ['Timestamp', 'Channel', 'To', 'Order ID', 'Template', 'Body', 'Status'],
  // Admin ka har badlav — "kisne kya badla" ka record (sirf owner)
  AuditLog: ['Timestamp', 'Actor', 'Action', 'Sheet', 'Key', 'Before', 'After'],
  // Size-wise stock — khaali = unlimited (site par "In stock")
  Stock: ['Handle', 'Size', 'Qty', 'Updated'],
  // Email queue — har status mail pehle yahan, phir bhejne ki koshish (30 retry tak)
  MailQueue: [
    'Queued At', 'Order ID', 'To', 'Template', 'Subject', 'Body', 'Attempts', 'Next Try',
    'Status', 'Last Error',
  ],
};

/** Settings ke default keys — website inhe padhti hai */
var DEFAULT_SETTINGS = [
  ['brand_name', 'TRENDS YOUNIQUE', 'Header / invoice / WhatsApp name'],
  ['tagline', 'Couture for the woman who arrives', 'Home hero sub-line'],
  ['support_phone', '7740992663', 'Footer + contact page'],
  ['whatsapp', '7740992663', 'Sabhi WhatsApp order links yahin se (10 digit)'],
  ['support_email', '', 'Contact / footer mailto'],
  ['upi_id', '', 'Checkout QR + UPI ID (khaali = UPI card chhupa rahega)'],
  ['upi_name', 'TRENDS YOUNIQUE', 'UPI app me payee name'],
  ['announcement', 'New drop live — free shipping across India', 'Top announcement bar'],
  ['free_shipping', 'true', 'true = sabhi orders free shipping'],
  ['shipping_fee', '0', 'Sirf tab jab free_shipping false ho (₹)'],
  ['gstin', '', 'Invoice par (khaali = nahi chhapega)'],
  ['max_qty_per_item', '10', 'Ek product (ek size) ki max quantity'],
  ['max_qty_per_order', '15', 'Poore order/cart me max pieces'],
  ['max_qty_bulk', '30', 'XL aur usse bade size par max quantity'],
  ['admin_url', '', 'Owner ke liye admin panel ka link (public me kabhi nahi)'],
  ['blocked_states', '', 'In states me delivery band (comma se alag, jaise: Kerala, Assam)'],
  ['blocked_pincodes', '', 'In PIN codes par delivery band (comma se alag, jaise: 682001, 560001)'],
  ['cod_enabled', 'true', 'Cash on delivery chalu/nakad band (true/false)'],
  ['min_order_value', '0', 'Isse kam total par order nahi (₹, 0 = koi limit nahi)'],
  ['free_shipping_above', '0', 'Is total se upar shipping free (₹, 0 = sab free)'],
  ['return_window_days', '7', 'Delivery ke baad kitne din tak return le sakte hain'],
  ['order_prefix', 'LK', 'Order number ka prefix (LK-1A2B3C)'],
  ['invoice_prefix', 'TY/2026/', 'Invoice number ka prefix'],
  ['gst_rate', '5', 'Invoice par GST % (0 = GST nahi)'],
  ['owner_email', '', 'Owner ko order alert is email par (khaali = mail nahi)'],
  ['owner_whatsapp', '7740992663', 'Owner ko alert is WhatsApp par (10 digit)'],
  ['low_stock_alert', '3', 'Is se kam stock par low-stock list me aata hai'],
  ['tracking_note', '', 'Track page par team ki general line (khaali = nahi dikhega)'],
  ['size_chart_note', '', 'Size chart ke neeche chhoti line (jaise: XL = 44 inch bust)'],
  ['email_updates', 'true', 'Order status ki email customer ko bhejein (true/false)'],
  ['email_from_name', 'TRENDS YOUNIQUE', 'Email me bhejne wale ka naam'],
];

/* ─────────────────────────── helpers ─────────────────────────── */

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/** Sheet ka Status column — sirf inhi values par review site par jaata hai */
function reviewApproved_(value) {
  var status = String(value || '').trim().toLowerCase();
  return /^(publish|published|approved|approve|live|yes|true|1)$/.test(status);
}

function book_() {
  // 1) bound script (sheet → Extensions → Apps Script) — sabse aam
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  // 2) standalone script — SPREADSHEET_ID (Script Property) se kholo
  var id = SPREADSHEET_ID || prop_('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  // DriveApp deliberately use nahi karte — usse naya Drive scope maangta hai aur
  // owner ko dobara authorize karna padta (data rukne ka risk). Sirf 2 raste:
  throw new Error(
    'Spreadsheet nahi mila — script ko sheet ke andar se kholein (Extensions → Apps Script) ' +
      'ya Script Property SPREADSHEET_ID set karein.',
  );
}

function sheet_(name) {
  var book = book_();
  var sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    if (HEADERS[name]) sheet.appendRow(HEADERS[name]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS[name].length).setFontWeight('bold');
  }
  return sheet;
}

function headersOf_(sheet) {
  var width = Math.max(1, sheet.getLastColumn());
  return sheet.getRange(1, 1, 1, width).getValues()[0].map(function (value) {
    return String(value);
  });
}

/* ─────────────── product list + main image (sheet se) ─────────────── */

/**
 * Site par jo bhi products hain, unki poori list — **ID ke saath**.
 * Data site ke `/data/products-sheet.csv` se `IMPORTDATA` karta hai (www URL —
 * apex domain par IMPORTDATA #REF! deta hai), isliye
 * sheet khud update rehti hai (row by row likhne ki zaroorat nahi).
 */
var PRODUCT_LIST_URLS = [
  'https://www.trendsyounique.fashion/data/products-sheet.csv',
  'https://raw.githubusercontent.com/mystorebyme/manoj-Product/main/apps/web/public/data/products-sheet.csv',
];
var PRODUCT_LIST_URL = PRODUCT_LIST_URLS[0];
/** har product ki saari image links (Apps Script se seedha padhi jaati hain) */
var PRODUCT_IMAGES_URLS = [
  'https://www.trendsyounique.fashion/data/products-images.json',
  'https://raw.githubusercontent.com/mystorebyme/manoj-Product/main/apps/web/public/data/products-images.json',
];
var PRODUCT_IMAGES_URL = PRODUCT_IMAGES_URLS[0];

function ensureProductListTab_() {
  var book = book_();
  var tab = book.getSheetByName('ProductList');
  if (!tab) {
    tab = book.insertSheet('ProductList');
    tab.setFrozenRows(1);
  }
  if (tab.getLastRow() < 2 || String(tab.getRange(1, 1).getValue()).indexOf('=') === 0) {
    tab.getRange(1, 1).setFormula('=IMPORTDATA("' + PRODUCT_LIST_URL + '")');
  }
  return tab;
}

/**
 * Data files ke URL — pehla try hota hai, na chale to agla.
 * (Kabhi kabhi site ka URL Google ko block/miss lagta hai, GitHub raw backup rehta hai.)
 */
var PRODUCT_IMAGES_CSV_URLS = [
  'https://www.trendsyounique.fashion/data/products-images.csv',
  'https://raw.githubusercontent.com/mystorebyme/manoj-Product/main/apps/web/public/data/products-images.csv',
];
var PRODUCT_IMAGES_CSV = PRODUCT_IMAGES_CSV_URLS[0];

/**
 * Kisi tab me column (header) na ho to aakhir me jod deta hai — data shift nahi hota.
 * Purane tabs me `Product ID` isi tarah add hoti hai.
 */
function ensureColumn_(tab, headerName) {
  var head = headersOf_(tab);
  if (head.indexOf(headerName) >= 0) return head.indexOf(headerName);
  var column = Math.max(1, tab.getLastColumn() + 1);
  tab.getRange(1, column).setValue(headerName).setFontWeight('bold');
  return column - 1;
}

/** ProductList (Handle → ID) se map — har row me id lagane ke liye */
function productIdByHandle_() {
  var map = {};
  var list = book_().getSheetByName('ProductList');
  if (!list || list.getLastRow() < 2) return map;
  var head = headersOf_(list);
  var idCol = head.indexOf('ID');
  var handleCol = head.indexOf('Handle');
  if (idCol < 0 || handleCol < 0) return map;
  var rows = list.getRange(2, 1, list.getLastRow() - 1, head.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    var id = String(rows[i][idCol] || '').trim();
    var handle = String(rows[i][handleCol] || '').trim();
    if (id && handle) map[handle] = id;
  }
  return map;
}

/** Sheet me maujood sabse bada ID + 1 (naya product aaye to agli id) */
function nextProductId_(used) {
  var max = 1000;
  var map = used || productIdByHandle_();
  Object.keys(map).forEach(function (handle) {
    var value = Number(String(map[handle] || '').replace(/\D/g, ''));
    if (value > max) max = value;
  });
  var tabs = ['Products', 'ProductImages', 'MainImage', 'Reviews'];
  tabs.forEach(function (name) {
    var tab = book_().getSheetByName(name);
    if (!tab || tab.getLastRow() < 2) return;
    var head = headersOf_(tab);
    var col = head.indexOf('Product ID');
    if (col < 0) return;
    var values = tab.getRange(2, col + 1, tab.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < values.length; i++) {
      var value = Number(String(values[i][0] || '').replace(/\D/g, ''));
      if (value > max) max = value;
    }
  });
  return max + 1;
}

/** chhota CSV parser — `"..."` quotes aur `""` escape dono sambhalta hai */
function parseCsv_(text) {
  var rows = [];
  var row = [];
  var cell = '';
  var quoted = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text.charAt(i);
    if (quoted) {
      if (ch === '"') {
        if (text.charAt(i + 1) === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(function (line) {
    return line.join('').trim() !== '';
  });
}

/**
 * CSV ko seedha tab me likh deta hai (URL → values). `IMPORTDATA` kabhi kabhi
 * badi file par #N/A de deta hai, isliye yeh fallback pakka hai.
 */
function fetchFirst_(urls) {
  var lastError = '';
  for (var i = 0; i < urls.length; i++) {
    try {
      var response = UrlFetchApp.fetch(urls[i], { muteHttpExceptions: true, followRedirects: true });
      if (response.getResponseCode() === 200) return response.getContentText();
      lastError = response.getResponseCode() + ' — ' + urls[i];
    } catch (error) {
      lastError = String(error) + ' — ' + urls[i];
    }
  }
  throw new Error('Data file nahi mili. Aakhri error: ' + lastError);
}

function writeCsvTab_(tabName, urls) {
  var text = fetchFirst_(typeof urls === 'string' ? [urls] : urls);
  var rows = parseCsv_(text);
  if (rows.length < 2) throw new Error('CSV khali aayi — ' + urls);
  var tab = ensureTab_(tabName);
  tab.clear();
  tab.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  tab.getRange(1, 1, 1, rows[0].length).setFontWeight('bold');
  tab.setFrozenRows(1);
  return rows.length - 1;
}

/** tab na ho to bana deta hai, warna wahi lautata hai */
function ensureTab_(name) {
  var book = book_();
  var tab = book.getSheetByName(name);
  if (!tab) {
    tab = book.insertSheet(name);
    tab.setFrozenRows(1);
  }
  return tab;
}

/**
 * `ImagesAll` tab — **har product ki har photo** ek row me
 * (`ID · Handle · Title · Position · Image`), ID ke saath.
 */
function ensureImagesAllTab_() {
  var tab = ensureTab_('ImagesAll');
  if (tab.getLastRow() < 2) {
    tab.getRange(1, 1, 1, 5).setValues([['ID', 'Handle', 'Title', 'Position', 'Image']]);
    tab.getRange(1, 1, 1, 5).setFontWeight('bold');
    tab.setColumnWidth(5, 640);
  }
  return tab;
}

/** Menu: saari images ek jagah (har photo, ID ke saath) */
function syncAllImages() {
  var tab = ensureImagesAllTab_();
  var rows = writeCsvTab_('ImagesAll', PRODUCT_IMAGES_CSV_URLS);
  SpreadsheetApp.flush();
  try {
    SpreadsheetApp.getUi().alert(
      'ImagesAll taiyaar — ' + rows + ' image rows (ID ke saath).\n\n' +
        'Har product ki saari photos yahan hain (5 ho ya 20).\n' +
        'Photo badalni/hatani ho to `ProductImages` tab use kariye — site turant badal jaati hai.',
    );
  } catch (error) {
    // ignore
  }
  return { ok: true, rows: rows };
}

function ensureProductImagesTab_() {
  var book = book_();
  var tab = book.getSheetByName('ProductImages');
  if (!tab) {
    tab = book.insertSheet('ProductImages');
    tab.appendRow(['Handle', 'Position', 'Image', 'Note', 'Product ID']);
    tab.setFrozenRows(1);
    tab.getRange(1, 1, 1, 4).setFontWeight('bold');
    tab.setColumnWidth(1, 320);
    tab.setColumnWidth(2, 90);
    tab.setColumnWidth(3, 520);
    tab.setColumnWidth(4, 260);
    tab.getRange(2, 3, 400, 1).setNumberFormat('0');
  }
  ensureColumn_(tab, 'Product ID');
  return tab;
}

/**
 * Menu: `ProductImages` tab me **saari photos** (handle + position + link) bhar deta hai.
 * Jo handle pehle se tab me hai uski rows chhedta nahi (owner ki editing safe rehti hai).
 */
function syncProductImages() {
  var tab = ensureProductImagesTab_();
  var payload = JSON.parse(fetchFirst_(PRODUCT_IMAGES_URLS));
  var rowsIn = payload.rows || [];

  ensureColumn_(tab, 'Product ID');
  var head = headersOf_(tab);
  var idCol = head.indexOf('Product ID');
  var handleCol = head.indexOf('Handle');
  if (handleCol < 0) handleCol = 1;
  var positionCol = head.indexOf('Position');
  if (positionCol < 0) positionCol = 2;

  // pehle se maujood handle+position — dobara likhkar duplicate nahi banate
  var existing = {};
  if (tab.getLastRow() > 1) {
    var values = tab.getRange(2, 1, tab.getLastRow() - 1, head.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var key = String(values[i][handleCol] || '').trim() + '#' + String(values[i][positionCol] || '').trim();
      if (key !== '#') existing[key] = true;
    }
  }

  var rows = [];
  rowsIn.forEach(function (row) {
    var id = String(row[0] || '').trim();
    var handle = String(row[1] || '').trim();
    var position = String(row[3] || '').trim();
    var url = String(row[4] || '').trim();
    if (!handle || !url) return;
    if (existing[handle + '#' + position]) return;
    var row = new Array(head.length).fill('');
    row[handleCol] = handle;
    row[positionCol] = position;
    row[head.indexOf('Image')] = url;
    if (idCol >= 0) row[idCol] = id;
    rows.push(row);
  });

  if (rows.length) {
    tab.getRange(tab.getLastRow() + 1, 1, rows.length, head.length).setValues(rows);
    if (idCol >= 0) tab.getRange(2, idCol + 1, tab.getLastRow() - 1, 1).setNumberFormat('@');
  }

  try {
    SpreadsheetApp.getUi().alert(
      'ProductImages: ' + rows.length + ' photo rows add hue (ID ke saath).\n\n' +
        'Har product ki saari photos yahan hain — 5 ho ya 20.\n' +
        'Photo badalni ho → us row ka Image cell badal dijiye.\n' +
        'Photo hatani ho → us row ke Image cell me `delete` likh dijiye.\n' +
        'Nayi photo → nayi row: Handle + next Position + image link.',
    );
  } catch (error) {
    // sheet ke bahar se chala
  }
  return { ok: true, added: rows.length, total: rowsIn.length };
}

/**
 * Menu: **har product ki ID** — Products / MainImage / ProductImages / Reviews sab me.
 * ID sirf admin ke liye hai (site par customer ko nahi dikhti).
 */
function backfillAllProductIds() {
  var idByHandle = productIdByHandle_();
  var next = nextProductId_(idByHandle);
  var report = [];

  function fill(tabName, handleHeader) {
    var tab = book_().getSheetByName(tabName);
    if (!tab || tab.getLastRow() < 2) return 0;
    var col = ensureColumn_(tab, 'Product ID');
    var head = headersOf_(tab);
    var handleCol = head.indexOf(handleHeader);
    if (handleCol < 0) return 0;
    var values = tab.getRange(2, 1, tab.getLastRow() - 1, head.length).getValues();
    var changed = 0;
    for (var i = 0; i < values.length; i++) {
      var handle = String(values[i][handleCol] || '').trim();
      var current = String(values[i][col] || '').trim();
      if (!handle) continue;
      if (current) {
        if (!idByHandle[handle]) idByHandle[handle] = current;
        continue;
      }
      var id = idByHandle[handle];
      if (!id) {
        id = String(next++);
        idByHandle[handle] = id;
      }
      values[i][col] = id;
      changed += 1;
    }
    if (changed) {
      tab.getRange(2, col + 1, values.length, 1).setValues(
        values.map(function (row) {
          return [row[col]];
        }),
      );
      tab.getRange(2, col + 1, values.length, 1).setNumberFormat('@');
    }
    report.push(tabName + ': ' + changed);
    return changed;
  }

  fill('Products', 'Handle');
  fill('MainImage', 'Handle');
  fill('ProductImages', 'Handle');
  fill('Reviews', 'Handle');
  fill('Reviews', 'Product Handle');

  try {
    SpreadsheetApp.getUi().alert(
      'Product ID bhar gayi (sirf admin ke liye).\n\n' + report.join('\n') +
        '\n\nYe IDs site par customer ko nahi dikhti.',
    );
  } catch (error) {
    // ignore
  }
  return { ok: true, report: report };
}

function ensureMainImageTab_() {
  var book = book_();
  var tab = book.getSheetByName('MainImage');
  if (!tab) {
    tab = book.insertSheet('MainImage');
    tab.appendRow(['Handle', 'Image', 'Note']);
    tab.setFrozenRows(1);
    tab.getRange(1, 1, 1, 3).setFontWeight('bold');
    tab.setColumnWidth(1, 320);
    tab.setColumnWidth(2, 420);
    tab.setColumnWidth(3, 260);
  }
  ensureColumn_(tab, 'Product ID');
  return tab;
}

/** Menu: ProductList tab me saare products (ID + photo link) bhar deta hai */
function syncProductList() {
  var tab = ensureProductListTab_();
  tab.getRange(1, 1).setFormula('=IMPORTDATA("' + PRODUCT_LIST_URL + '")');
  SpreadsheetApp.flush();
  var rows = Math.max(0, tab.getLastRow() - 1);
  // IMPORTDATA kabhi #N/A de deta hai (badi file) — tabhi seedha CSV likh dete hain
  if (rows < 10) rows = writeCsvTab_('ProductList', PRODUCT_LIST_URLS);
  try {
    SpreadsheetApp.getUi().alert(
      'ProductList taiyaar hai — ' + rows + ' items.\n\n' +
        'Isme ID, Handle, Title, Price, Main Image (default photo link) hai.\n' +
        'Main photo badalni ho to `MainImage` tab me Handle + naya Image URL daaliye.',
    );
  } catch (error) {
    // sheet ke bahar se chala — koi baat nahi
  }
  return { ok: true, rows: rows, url: PRODUCT_LIST_URL };
}

/**
 * Menu: `Reviews` tab ke **Product ID** column (J) ko ProductList se bhar deta hai.
 * Handle se ID dhoondh kar likhta hai — jo cell pehle se bhari hai use chhedta nahi.
 */
function backfillReviewProductIds() {
  var list = ensureProductListTab_();
  SpreadsheetApp.flush();
  var map = {};
  var listRows = Math.max(0, list.getLastRow() - 1);
  if (listRows > 0) {
    var ids = list.getRange(2, 1, listRows, 2).getValues(); // ID | Handle
    for (var i = 0; i < ids.length; i++) {
      var id = String(ids[i][0] || '').trim();
      var handle = String(ids[i][1] || '').trim().toLowerCase();
      if (id && handle) map[handle] = id;
    }
  }

  var tab = sheet_('Reviews');
  var head = headersOf_(tab);
  var col = head.indexOf('Product ID') + 1;
  if (!col) {
    throw new Error('Reviews tab me `Product ID` column nahi mila — pehle setup() chalaiye.');
  }
  var last = tab.getLastRow();
  if (last < 2) return { ok: true, filled: 0 };

  var handleCol = head.indexOf('Handle') + 1;
  var rows = tab.getRange(2, 1, last - 1, head.length).getValues();
  var out = [];
  var filled = 0;
  var missing = 0;
  for (var r = 0; r < rows.length; r++) {
    var current = String(rows[r][col - 1] || '').trim();
    var handle = String(rows[r][handleCol - 1] || '').trim().toLowerCase();
    var id = current || map[handle] || '';
    if (!current && id) filled++;
    if (!id) missing++;
    out.push([id]);
  }
  tab.getRange(2, col, out.length, 1).setValues(out);

  try {
    SpreadsheetApp.getUi().alert(
      'Product ID bhare gaye: ' + filled + '\n' +
        'Handle se match nahi hue: ' + missing + '\n\n' +
        'Match na hone wale reviews ka handle ProductList me hai hi nahi — ' +
        'unka product delete ho gaya hoga.',
    );
  } catch (error) {
    // ignore
  }
  return { ok: true, filled: filled, missing: missing };
}

/**
 * Menu: **reviews ki photos** — `Reviews` tab ke `Images` column me customer ki
 * asli photos (URLs, ` | ` se alag). Handle + Body se row match hoti hai, isliye
 * purane 1684 reviews me bhi photo aa jaati hai. Jo photo pehle se hai use chhedta nahi.
 */
function backfillReviewPhotos() {
  var response = UrlFetchApp.fetch(REVIEWS_IMPORT_URL, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    throw new Error('Reviews import file nahi mili (' + response.getResponseCode() + ')');
  }
  var rows = (JSON.parse(response.getContentText()) || {}).rows || [];

  var tab = sheet_('Reviews');
  var head = headersOf_(tab);
  var imagesCol = ensureColumn_(tab, 'Images');
  head = headersOf_(tab);
  var last = tab.getLastRow();
  if (last < 2) return { ok: true, filled: 0 };

  var want = {};
  rows.forEach(function (row) {
    var key =
      String(row.handle || '').trim() +
      '::' +
      String(row.body || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 160);
    var images = String(row.images || '').trim();
    if (images) want[key] = images;
  });

  var values = tab.getRange(2, 1, last - 1, head.length).getValues();
  var filled = 0;
  for (var i = 0; i < values.length; i += 1) {
    var key =
      String(values[i][head.indexOf('Handle')] || '').trim() +
      '::' +
      String(values[i][head.indexOf('Body')] || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 160);
    var images = want[key];
    if (!images) continue;
    if (String(values[i][imagesCol] || '').trim() === images) continue;
    values[i][imagesCol] = images;
    filled += 1;
  }
  if (filled) tab.getRange(2, imagesCol + 1, values.length, 1).setValues(
    values.map(function (row) {
      return [row[imagesCol]];
    }),
  );

  try {
    SpreadsheetApp.getUi().alert(
      'Review photos bhar gayi: ' + filled + ' rows.\n\n' +
        'Ye customer ki asli photos hain (Trustoo se) — site par review ke saath dikti hain.',
    );
  } catch (error) {
    // ignore
  }
  return { ok: true, filled: filled, source: rows.length };
}

/**
 * Menu: **order ke 5 step comments ready** — jis order ke liye `Order Updates` me
 * koi row nahi, uske liye 5 rows (placed → delivered) bana deta hai.
 *
 * Message khaali-pan ka nahi: default line pehle se likhi hoti hai, aur `Visible`
 * **no** rehta hai — aap date/message theek karke `yes` kar dijiye, tabhi customer
 * ko dikhega. (2-3 comment per step chahiye to usi Order ID ki extra rows jod dijiye.)
 */
function createOrderUpdateTemplates() {
  var ordersTab = sheet_('Orders');
  var orderHead = headersOf_(ordersTab);
  var idCol = orderHead.indexOf('Order ID');
  if (idCol < 0) throw new Error('Orders tab me `Order ID` column nahi mila.');
  var lastOrder = ordersTab.getLastRow();
  if (lastOrder < 2) return { ok: true, added: 0, orders: 0 };

  var ids = ordersTab.getRange(2, idCol + 1, lastOrder - 1, 1).getValues();
  var orderIds = [];
  var seenOrder = {};
  for (var i = 0; i < ids.length; i += 1) {
    var id = String(ids[i][0] || '').trim();
    if (!id || seenOrder[id]) continue;
    seenOrder[id] = true;
    orderIds.push(id);
  }

  var tab = ensureTab_('Order Updates');
  if (tab.getLastRow() < 1 || String(tab.getRange(1, 1).getValue() || '') === '') {
    tab.getRange(1, 1, 1, 5).setValues([['Order ID', 'Date & Time', 'Status', 'Message', 'Visible']]);
    tab.getRange(1, 1, 1, 5).setFontWeight('bold');
    tab.setFrozenRows(1);
  }
  var head = headersOf_(tab);
  var has = {};
  if (tab.getLastRow() > 1) {
    var existing = tab.getRange(2, 1, tab.getLastRow() - 1, head.length).getValues();
    for (var e = 0; e < existing.length; e += 1) {
      var rowOrder = String(existing[e][head.indexOf('Order ID')] || '').trim();
      if (rowOrder) has[rowOrder] = true;
    }
  }

  var defaults = [
    ['placed', 'Order placed — team ko mil gaya.'],
    ['confirmed', 'Order confirm ho gaya, taiyari shuru.'],
    ['packed', 'Quality check + packing ho gayi.'],
    ['shipped', 'Courier ko de diya — AWB `Orders` tab me hai.'],
    ['delivered', 'Delivered — dhoop ho ya baarish, aap tak pahunch gaya. Dhanyavaad!'],
  ];

  var rows = [];
  orderIds.forEach(function (orderId) {
    if (has[orderId]) return;
    defaults.forEach(function (entry) {
      var row = new Array(head.length).fill('');
      row[head.indexOf('Order ID')] = orderId;
      row[head.indexOf('Status')] = entry[0];
      row[head.indexOf('Message')] = entry[1];
      row[head.indexOf('Visible')] = 'no';
      rows.push(row);
    });
  });

  if (rows.length) tab.getRange(tab.getLastRow() + 1, 1, rows.length, head.length).setValues(rows);

  try {
    SpreadsheetApp.getUi().alert(
      orderIds.length + ' order ke liye ' + rows.length + ' comment rows banayi gayi.\n\n' +
        'Ab `Order Updates` tab me: Date & Time bhariye, message theek kariye, ' +
        'aur `Visible` = yes kar dijiye. Tabhi customer ko dikhega.\n\n' +
        'Ek step par 2-3 comment chahiye? Usi Order ID + Status ki extra row jod dijiye ' +
        '(site sab dikhati hai, nayi pehle).',
    );
  } catch (error) {
    // ignore
  }
  return { ok: true, added: rows.length, orders: orderIds.length };
}

/* ─────────────────────────── setup ─────────────────────────── */

/**
 * Ek baar chalaiye — saari tabs, headers aur default settings bana deta hai.
 * Dobara chalane par maujooda values chhedta nahi (sirf missing keys add karta hai).
 */
function setup() {
  Object.keys(HEADERS).forEach(function (name) {
    var sheet = sheet_(name);
    var headers = HEADERS[name];
    var existing = sheet.getLastRow() >= 1 ? headersOf_(sheet) : [];
    if (existing.join('|') !== headers.join('|')) {
      // header row ko exactly wahi banao jo website padhti hai
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    sheet.setColumnWidth(1, 150);
  });

  // product list (site ke saare items + id) aur main-image overrides
  ensureProductListTab_();
  ensureMainImageTab_();
  ensureProductImagesTab_();
  ensureImagesAllTab_();
  // naye tabs — e-commerce engine (stock, coupon, return, content, log)
  ensureStockTab_();
  ensureCouponsTab_();
  ensureContentTab_('Banners');
  ensureContentTab_('FAQs');
  ensureContentTab_('Categories');
  ensureReturnsTab_();
  ensureNotificationsTab_();
  ensureAuditTab_();
  ensureMailQueueTab_();

  // Reviews: Status dropdown = approval (sirf publish/approved site par jaate hain)
  try {
    var reviewsTab = sheet_('Reviews');
    var statusCol = headersOf_(reviewsTab).indexOf('Status') + 1;
    if (statusCol > 0) {
      reviewsTab.getRange(2, statusCol, 999, 1).setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(['publish', 'approved', 'pending', 'reject'], true)
          .setAllowInvalid(true)
          .build(),
      );
    }
  } catch (error) {
    // validation fail ho to bhi setup chalta rahe
  }

  // Orders: Status dropdown — tracking ke 5 step yahi se badalte hain
  try {
    var ordersTab = sheet_('Orders');
    var orderStatusCol = headersOf_(ordersTab).indexOf('Status') + 1;
    if (orderStatusCol > 0) {
      ordersTab.getRange(2, orderStatusCol, 999, 1).setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(
            ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'],
            true,
          )
          .setAllowInvalid(true)
          .build(),
      );
    }
  } catch (error) {
    // validation fail ho to bhi setup chalta rahe
  }

  // Order Updates: Visible dropdown (khaali = dikhega)
  try {
    var updatesTab = sheet_('Order Updates');
    var visibleCol = headersOf_(updatesTab).indexOf('Visible') + 1;
    if (visibleCol > 0) {
      updatesTab.getRange(2, visibleCol, 999, 1).setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(['yes', 'no'], true)
          .setAllowInvalid(true)
          .build(),
      );
    }
  } catch (error) {
    // ignore
  }

  var settings = sheet_('Settings');
  if (settings.getLastRow() === 0) settings.appendRow(['key', 'value', 'notes']);
  var existingKeys = {};
  if (settings.getLastRow() > 1) {
    settings
      .getRange(2, 1, settings.getLastRow() - 1, 1)
      .getValues()
      .forEach(function (row) {
        existingKeys[String(row[0]).trim().toLowerCase()] = true;
      });
  }
  DEFAULT_SETTINGS.forEach(function (entry) {
    if (!existingKeys[entry[0]]) settings.appendRow(entry);
  });
  settings.setFrozenRows(1);

  // har bade tab par filter lagao (owner ko sort/search aasaani se mile)
  ['Orders', 'Order Items', 'Enquiries', 'Payments', 'Messages'].forEach(function (name) {
    try {
      var tab = sheet_(name);
      if (!tab.getFilter()) {
        tab.getRange(1, 1, Math.max(2, tab.getLastRow()), HEADERS[name].length).createFilter();
      }
    } catch (error) {
      // filter already set ho to chhod do
    }
  });

  // Orders tab par sort (date descending) — owner ko latest pehle
  try {
    var orders = sheet_('Orders');
    if (!orders.getFilter()) {
      orders
        .getRange(1, 1, Math.max(2, orders.getLastRow()), HEADERS.Orders.length)
        .createFilter()
        .sort(2, false, 1, false);
    }
  } catch (error) {
    // filter already set ho to chhod do
  }

  writeReadme_();

  book_().toast('TRENDS YOUNIQUE sheet ready ✔', 'Setup', 5);
  return json_({ ok: true, message: 'setup complete' });
}

/**
 * `Read Me` tab — owner ke liye ek page ka guide (har baar setup par refresh hota hai).
 * Koi customer data yahan nahi aata.
 */
function writeReadme_() {
  var book = book_();
  var sheet = book.getSheetByName('Read Me') || book.insertSheet('Read Me', 0);
  sheet.clear();
  var lines = [
    ['TRENDS YOUNIQUE — Store DB'],
    [''],
    ['Ye sheet website ka database hai. Yahan owner ke liye har detail aati hai.'],
    ['Sheet ka link kisi customer ko share na karein — isme phone aur address hai.'],
    [''],
    ['Tab', 'Kya rehta hai'],
    ['Orders', 'Har order ki row — customer, phone, WhatsApp, email, address, items, qty, total, payment, courier/AWB, notes'],
    ['Order Items', 'Order ka har item alag row — product, colour, size, qty, price, line total, product link'],
    ['Products', 'Admin se upload hue products (handle = key, isliye duplicate nahi)'],
    ['Enquiries', 'WhatsApp se aaye order/enquiry — item-wise colour/size/qty/price/link'],
    ['Payments', 'Payment submit / paid / reverse ka record (UPI ID + reference)'],
    ['Settings', 'WhatsApp number, UPI, announcement, quantity limits — site 15 second me utha leti hai'],
    ['Messages', 'Contact form ke messages'],
    ['Newsletter', 'Email subscribers'],
    ['ProductImages', 'Har product ki saari photos (Handle | Position | Image) — photo badalna, `delete` likh kar hatana, nayi row se jodna'],
    ['MainImage', 'Sirf main photo (home card + product page ki pehli photo)'],
    ['ProductList', 'Saare products ID ke saath (IMPORTDATA se khud bharta hai)'],
    ['AddressCheck', 'Address ka state aur PIN code mel khata hai ya nahi — mismatch yahan aata hai (customer ko nahi dikhta)'],
    ['Order Updates', 'Order tracking ke messages — Order ID | Date | Status | Message | Visible (yes/no)'],
    [''],
    ['Settings tab badalne ke baad', 'Kuch nahi karna — website khud refresh kar leti hai (redeploy nahi).'],
    ['Apps Script code badla ho to', 'Deploy → Manage deployments → Edit → New version → Deploy (URL wahi rehta hai).'],
    [''],
    ['— NAYA (r17) —', 'Poora e-commerce engine, sab sheet se'],
    ['ImagesAll', 'Har product ki har photo ek row me, ID ke saath (padhne ke liye)'],
    ['Stock', 'Size-wise stock. Row khaali = unlimited. Order aane par khud kam hota hai, cancel par wapas'],
    ['Coupons', 'percent / flat / free-shipping. Min order, expiry, usage limit — sab yahin'],
    ['Returns', 'Return/exchange request (7 din ke andar, Settings se badal sakte hain)'],
    ['Banners / FAQs / Categories', 'Home page content aur nav — sheet se badalta hai'],
    ['Notifications', 'Kaunsa WhatsApp/email gaya, kab gaya (record)'],
    ['MailQueue', 'Email bhejne ki queue — Status = sent / retry / failed (owner ke liye)'],
    ['AuditLog', 'Kisne kya badla — status, coupon, stock, settings'],
    [''],
    ['Roz ka kaam', 'Orders tab me Status badal dijiye → customer ko message + track page par timeline khud ban jaati hai'],
    ['Order par 2-3 comment', 'Order Updates tab me usi Order ID + Status ki extra rows jod dijiye (site sab dikhati hai)'],
    ['Sab theek hai?', 'Menu → TRENDS tools → 9. Sab kuch test karo (self-test) → saare check pass hone chahiye'],
    [''],
    ['— NAYA (r18) —', 'Customer ko asli email, apne aap'],
    ['Email kab jaati hai', 'Placed · confirmed · packed · shipped · delivered · cancel — har status par customer ko poori detail wali email'],
    ['Email me kya aata hai', 'Order number, saari dresses (photo, colour, size, qty), amount, address, courier + AWB, track button'],
    ['Email free hai', 'Google ke apne MailApp se jaati hai — koi paid service nahi, koi extra charge nahi'],
    ['MailQueue', 'Har email pehle yahan queue hoti hai, phir turant bhejne ki koshish. Fail ho to khud 30 baar tak retry (har 10 minute trigger chalta hai)'],
    ['Email band karni ho', 'Settings tab me email_updates = false'],
    ['Email test karna ho', 'Menu → TRENDS tools → 3. Orders → Test email bhejo (apni inbox/spam dekh lein)'],
  ];
  sheet.getRange(1, 1, lines.length, 2).setValues(
    lines.map(function (row) {
      return [row[0] === undefined ? '' : row[0], row[1] === undefined ? '' : row[1]];
    }),
  );
  sheet.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  sheet.getRange(6, 1, 1, 2).setFontWeight('bold');
  sheet.getRange(1, 1, lines.length, 2).setVerticalAlignment('top');
  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 620);
  sheet.getRange(6, 1, lines.length - 5, 2).setWrap(true);
}

/* ─────────────────────────── read ─────────────────────────── */

function readSettings_() {
  var sheet = sheet_('Settings');
  var values = sheet.getDataRange().getValues();
  var out = {};
  for (var i = 1; i < values.length; i += 1) {
    var key = String(values[i][0] || '').trim().toLowerCase();
    var value = values[i][1] === null ? '' : String(values[i][1]).trim();
    if (!key || !value) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Public settings — sirf wahi keys jo website par dikh sakti hain
 * (phone, WhatsApp, UPI, announcement, quantity limits). Koi token/secret nahi.
 * Website ise `?action=public` se padhti hai, isliye owner sheet me number badale
 * to site 1 minute me update ho jaati hai — redeploy ki zaroorat nahi.
 */
function publicSettings_() {
  var all = readSettings_();
  var pick = ['brand_name', 'tagline', 'support_phone', 'whatsapp', 'support_email',
    'upi_id', 'upi_name', 'announcement', 'free_shipping', 'shipping_fee',
    'max_qty_per_item', 'max_qty_bulk', 'max_qty_per_order',
    'blocked_states', 'blocked_pincodes'];
  var camel = {
    brand_name: 'brandName', tagline: 'tagline', support_phone: 'supportPhone',
    whatsapp: 'whatsapp', support_email: 'supportEmail', upi_id: 'upiId',
    upi_name: 'upiName', announcement: 'announcement', free_shipping: 'freeShipping',
    shipping_fee: 'shippingFee', max_qty_per_item: 'maxQtyPerItem',
    max_qty_bulk: 'maxQtyBulk', max_qty_per_order: 'maxQtyPerOrder',
    blocked_states: 'blockedStates', blocked_pincodes: 'blockedPincodes',
  };
  var out = {};
  pick.forEach(function (key) {
    if (all[key] === undefined || all[key] === '') return;
    var value = all[key];
    if (key === 'free_shipping') value = String(value).toLowerCase() !== 'false';
    if (/^max_qty|shipping_fee$/.test(key)) value = Number(value) || undefined;
    if (value === undefined) return;
    out[camel[key]] = value;
  });
  return out;
}

/** Last N rows (headers se object) — admin panel ise dikhata hai */
function recentRows_(name, limit) {
  if (!HEADERS[name]) return [];
  var sheet = sheet_(name);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var headers = headersOf_(sheet);
  var start = Math.max(2, last - limit + 1);
  var values = sheet.getRange(start, 1, last - start + 1, headers.length).getValues();
  return values.reverse().map(function (row) {
    var object = {};
    for (var i = 0; i < headers.length; i += 1) {
      object[headers[i]] = row[i] === null ? '' : row[i];
    }
    return object;
  });
}

function counts_() {
  return Object.keys(HEADERS).map(function (name) {
    return { name: name, rows: Math.max(0, sheet_(name).getLastRow() - 1) };
  });
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = params.action || 'settings';
  // in do ko master token ki zaroorat nahi (kuch bhi secret wapas nahi karte)
  if (action === 'public') {
    return json_({ ok: true, settings: publicSettings_(), version: VERSION, time: new Date().toISOString() });
  }
  if (action === 'append_test') {
    // Browser me URL khol kar write-path test — sirf write token se, sirf ek test row.
    if (String(params.token || '') !== EFFECTIVE_WRITE_TOKEN) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    var ref = 'TY-SELFTEST-' + Date.now();
    var written = appendRows_([
      {
        sheet: 'Orders',
        row: {
          'Order ID': ref,
          'Date & Time': new Date().toISOString(),
          Event: 'self-test',
          Status: 'test',
          Customer: 'Sheet self-test (delete kar sakte hain)',
          'Total ₹': 1,
          Source: 'browser-test',
        },
      },
    ]);
    return json_({ ok: true, written: written, ref: ref, time: new Date().toISOString() });
  }
  /**
   * Public reviews — **sirf approved**.
   *   ?action=reviews&handle=<handle>&id=<product id>
   *   ?action=reviews_all&limit=60      (home page ka 1-second rotation)
   *
   * Approval: `Status` = publish / approved / live. Khaali ya pending = chhupa.
   */
  if (action === 'reviews' || action === 'reviews_all') {
    var wantHandle = String(params.handle || '').trim();
    var wantId = String(params.id || '').trim();
    var all = action === 'reviews_all';
    var limit = Math.max(1, Math.min(200, Number(params.limit) || 60));
    var tab = sheet_('Reviews');
    var last = tab.getLastRow();
    if (last < 2) return json_({ ok: true, reviews: [], version: VERSION });
    var head = headersOf_(tab);
    var rows = tab.getRange(2, 1, last - 1, head.length).getValues();
    var published = rows
      .map(function (values) {
        var object = {};
        for (var i = 0; i < head.length; i += 1) object[head[i]] = values[i];
        return object;
      })
      .filter(function (row) {
        if (!reviewApproved_(row.Status)) return false;
        if (all) return true;
        var rowHandle = String(row.Handle || '').trim();
        var rowId = String(row['Product ID'] || '').trim();
        if (wantId && rowId && rowId === wantId) return true;
        if (wantHandle && rowHandle && rowHandle === wantHandle) return true;
        return !wantHandle && !wantId;
      })
      .sort(function (a, b) {
        return String(b.Timestamp || '').localeCompare(String(a.Timestamp || ''));
      })
      .slice(0, all ? limit : 30)
      .map(function (row) {
        return {
          name: String(row.Name || 'Customer'),
          rating: Number(row.Rating) || 5,
          title: String(row.Title || ''),
          body: String(row.Body || ''),
          date: row.Timestamp ? new Date(row.Timestamp).toISOString().slice(0, 10) : '',
          handle: String(row.Handle || ''),
          productId: String(row['Product ID'] || ''),
          // customer photos — sheet ke `Images` column se (` | ` se alag)
          photos: String(row.Images || '')
            .split('|')
            .map(function (src) {
              return String(src).trim();
            })
            .filter(function (src) {
              return /^https?:\/\//i.test(src);
            }),
        };
      });
    return json_({ ok: true, handle: wantHandle, reviews: published, version: VERSION });
  }

  /**
   * Product ki main photo sheet se — `MainImage` tab (Handle | Image URL).
   * Public: sirf image links, koi order/customer data nahi.
   */
  if (action === 'products_public') {
    var imageTab = book_().getSheetByName('MainImage');
    var images = {};
    if (imageTab && imageTab.getLastRow() > 1) {
      var imageHead = headersOf_(imageTab);
      var handleCol = Math.max(0, imageHead.indexOf('Handle'));
      var imageCol = imageHead.indexOf('Image');
      if (imageCol < 0) imageCol = Math.max(1, imageHead.indexOf('Image URL'));
      var imageRows = imageTab.getRange(2, 1, imageTab.getLastRow() - 1, imageHead.length).getValues();
      for (var r = 0; r < imageRows.length; r += 1) {
        var rowHandle = String(imageRows[r][handleCol] || '').trim();
        var rowImage = String(imageRows[r][imageCol] || '').trim();
        if (!rowHandle || !rowImage) continue;
        if (!/^https?:\/\//i.test(rowImage)) continue;
        images[rowHandle] = rowImage;
      }
    }
    return json_({ ok: true, images: images, version: VERSION, time: new Date().toISOString() });
  }

  /**
   * Product ki saari photos sheet se — `ProductImages` tab.
   *   { handle: { "1": "https://…", "3": "delete" } }
   * Customer ko sirf photos dikhti hain (ye action bhi sirf image links deta hai).
   */
  if (action === 'images_public') {
    var galleryTab = book_().getSheetByName('ProductImages');
    var gallery = {};
    if (galleryTab && galleryTab.getLastRow() > 1) {
      var galleryHead = headersOf_(galleryTab).map(function (value) {
        return String(value).trim().toLowerCase();
      });
      var gHandle = galleryHead.indexOf('handle');
      var gPos = galleryHead.indexOf('position');
      var gImage = galleryHead.indexOf('image');
      if (gImage < 0) gImage = galleryHead.indexOf('image url');
      var gRows = galleryTab.getRange(2, 1, galleryTab.getLastRow() - 1, galleryHead.length).getValues();
      for (var gr = 0; gr < gRows.length; gr += 1) {
        var gH = String(gRows[gr][gHandle] || '').trim();
        var gP = Math.round(Number(gRows[gr][gPos]));
        var gUrl = String(gRows[gr][gImage] || '').trim();
        if (!gH || !(gP > 0) || !gUrl) continue;
        var gValue = /^(delete|remove|hatao|-)$/i.test(gUrl)
          ? 'delete'
          : /^https?:\/\//i.test(gUrl)
            ? gUrl
            : '';
        if (!gValue) continue;
        if (!gallery[gH]) gallery[gH] = {};
        gallery[gH][gP] = gValue;
      }
    }
    return json_({ ok: true, items: gallery, version: VERSION, time: new Date().toISOString() });
  }
  /**
   * Order tracking — `?action=order_status&order=LK-XXXX&phone=98XXXXXXXX`
   *
   * Order number + registered phone dono match hone par hi jawab milta hai
   * (warna koi bhi kisi ka order dekh leta). Customer ko sirf apna order dikhta hai.
   *
   * Steps 5 hote hain (placed → confirmed → packed → shipped → delivered) aur
   * `Order Updates` tab ki messages timeline me aati hain — owner wahan status
   * ya message likhta hai, site turant wahi dikhati hai.
   */
  if (action === 'order_status') {
    // Poora timeline (5 step + per-step admin comment) — `orderTimeline_()` me.
    return json_(orderTimeline_(String(params.order || ''), String(params.phone || '')));
  }

  /**
   * **Coupons** — site checkout par code check karti hai.
   *   ?action=coupons                           → active coupons ki list
   *   ?action=coupons&code=TRENDS10&total=1999  → `{ok, discount, freeShipping, message}`
   */
  if (action === 'coupons') {
    var wantedCode = String(params.code || '').trim();
    var cartTotal = Number(params.total || params.subtotal || 0);
    if (!wantedCode) {
      return json_({ ok: true, coupons: couponsPublic_(), version: VERSION });
    }
    var couponResult = couponCheck_(wantedCode, cartTotal);
    return json_({
      ok: couponResult.ok,
      code: couponResult.code || wantedCode.toUpperCase(),
      discount: couponResult.discount || 0,
      freeShipping: Boolean(couponResult.freeShipping),
      message: couponResult.message || '',
      version: VERSION,
    });
  }

  /** **Stock** — size-wise bacha hua maal (`?action=stock` ya `&handle=…`) */
  if (action === 'stock') {
    return json_({
      ok: true,
      stock: stockPublic_(String(params.handle || '')),
      unlimitedWhenMissing: true,
      version: VERSION,
    });
  }

  /** **Content** — banner / FAQ / category (owner sheet se badalta hai) */
  if (action === 'banners') {
    return json_({ ok: true, banners: bannersPublic_(), version: VERSION });
  }
  if (action === 'faqs') {
    return json_({ ok: true, faqs: faqsPublic_(), version: VERSION });
  }
  if (action === 'categories') {
    return json_({ ok: true, categories: categoriesPublic_(), version: VERSION });
  }

  /** **Search** — ProductList me title/handle se (`?action=search&q=anarkali`) */
  if (action === 'search') {
    return json_({
      ok: true,
      query: String(params.q || ''),
      results: searchProducts_(String(params.q || ''), params.limit),
      version: VERSION,
    });
  }

  /**
   * **Invoice** — printable HTML (`?action=invoice&order=LK-XXXXXX&phone=98XXXXXXXX`).
   * Order number + registered mobile dono chahiye — koi doosre ka invoice nahi khulta.
   */
  if (action === 'invoice') {
    var invoiceData = invoiceData_(String(params.order || ''), String(params.phone || ''));
    return ContentService.createTextOutput(invoiceHtml_(invoiceData)).setMimeType(
      ContentService.MimeType.HTML,
    );
  }

  /** **Timeline** — 5 step + per-step admin comments (track page ka poora data) */
  if (action === 'timeline') {
    return json_(orderTimeline_(String(params.order || ''), String(params.phone || '')));
  }

  if (action === 'import_reviews') {
    // Owner ke liye: saare purane reviews site ke JSON se sheet me (master token).
    // Sheet menu se bhi: TRENDS tools → Import all reviews (script editor me chalayein).
    if (!masterTokenConfigured_() || String(params.token || '') !== MASTER_TOKEN) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    return json_(importAllReviews());
  }
  if (action === 'reviews_menu') {
    // Browser me URL khol kar turant import (GET se hi, deploy dobara nahi karna padta)
    if (!masterTokenConfigured_() || String(params.token || '') !== MASTER_TOKEN) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    return json_(importAllReviews());
  }

  /**
   * **GET se row likhna** — browser ke liye sabse bharosemand rasta.
   *
   * Kyun: Apps Script POST par CORS preflight nahi hota, isliye browser ko kabhi
   * pata nahi chalta ki row likhi gayi ya nahi. GET par script `Access-Control-
   * Allow-Origin: *` bhejta hai → jawab padha ja sakta hai (`{ok,written}`), aur
   * site tab tak retry karti hai jab tak asli confirmation na mile.
   *
   *   ?action=append&token=<write|master>&data=<base64url(rows JSON)>
   *   ?action=append&token=…&rows=<urlencoded JSON>       (chhote payload)
   *
   * Write-only token se sirf WRITE_SHEETS tabs, max MAX_WRITE_ROWS rows.
   */
  if (action === 'append') {
    var appendToken = String(params.token || '');
    var appendMasterOk = masterTokenConfigured_() && appendToken === MASTER_TOKEN;
    var appendWriteOk = Boolean(EFFECTIVE_WRITE_TOKEN) && appendToken === EFFECTIVE_WRITE_TOKEN;
    if (!appendMasterOk && !appendWriteOk) return json_({ ok: false, error: 'unauthorized' });

    var appendRows = [];
    var raw = String(params.data || '');
    if (raw) {
      try {
        var decoded = Utilities.newBlob(
          Utilities.base64DecodeWebSafe(raw, Utilities.Charset.UTF_8),
        ).getDataAsString();
        appendRows = JSON.parse(decoded);
      } catch (error) {
        // kabhi base64 nahi, seedha JSON bhi aa sakta hai
        try {
          appendRows = JSON.parse(raw);
        } catch (error2) {
          return json_({ ok: false, error: 'invalid data' });
        }
      }
    } else if (params.rows) {
      try {
        appendRows = JSON.parse(String(params.rows));
      } catch (error3) {
        return json_({ ok: false, error: 'invalid rows' });
      }
    }
    if (!Array.isArray(appendRows) || !appendRows.length) return json_({ ok: false, error: 'no rows' });
    if (!appendMasterOk) {
      appendRows = appendRows
        .filter(function (entry) {
          return WRITE_SHEETS.indexOf(String(entry.sheet || '')) >= 0;
        })
        .slice(0, MAX_WRITE_ROWS);
      if (!appendRows.length) return json_({ ok: false, error: 'sheet not allowed' });
    }
    var appended = appendRows_(appendRows);
    return json_({ ok: true, written: appended, version: VERSION, time: new Date().toISOString() });
  }

  /** `?action=diag` — sheet/tabs/headers/token ka poora sach (sirf master token) */
  if (action === 'diag') {
    if (!masterTokenConfigured_() || String(params.token || '') !== MASTER_TOKEN) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    var book = book_();
    var tabs = Object.keys(HEADERS).map(function (name) {
      var tab = book.getSheetByName(name);
      if (!tab) return { name: name, exists: false, rows: 0, headersOk: false };
      var headers = headersOf_(tab).slice(0, HEADERS[name].length);
      return {
        name: name,
        exists: true,
        rows: Math.max(0, tab.getLastRow() - 1),
        headersOk: headers.join('|') === HEADERS[name].join('|'),
      };
    });
    return json_({
      ok: true,
      version: VERSION,
      spreadsheet: { id: book.getId(), name: book.getName() },
      masterTokenConfigured: masterTokenConfigured_(),
      writeTokenConfigured: Boolean(EFFECTIVE_WRITE_TOKEN),
      tabs: tabs,
      time: new Date().toISOString(),
    });
  }

  if (action === 'ping' || action === 'version' || action === 'verify_write') {
    if (action === 'verify_write') {
      return json_({ ok: true, writeTokenMatch: Boolean(EFFECTIVE_WRITE_TOKEN) && String(params.token || '') === EFFECTIVE_WRITE_TOKEN });
    }
    return json_({ ok: true, app: 'trends-sheets', version: VERSION, time: new Date().toISOString() });
  }
  if (!masterTokenConfigured_() || String(params.token || '') !== MASTER_TOKEN) {
    return json_({ ok: false, error: 'unauthorized' });
  }
  /** self-test — saare feature ke check, browser se hi (`?action=selftest`) */
  if (action === 'selftest') {
    return json_(runSelfTests());
  }
  /** reports — `?action=reports&type=summary|daily|products|customers|stock` */
  if (action === 'reports') {
    return json_(reportsFor_(params.type, params.days, params.limit));
  }
  /** email queue ka hisaab — kitni bheji, kitni bachi, kitni retry par */
  if (action === 'mail_queue') {
    if (params.run) {
      return json_({
        ok: true,
        run: processMailQueue_(params.limit, params.force === '1' || params.force === 'true'),
        stats: mailQueueStats_(),
      });
    }
    return json_({ ok: true, stats: mailQueueStats_(), quota: mailQuota_(), version: VERSION });
  }
  /** test email — `?action=mail_test&to=…` (apne aap par bhej kar dekhein) */
  if (action === 'mail_test') {
    return json_(sendTestEmail_(String(params.to || '')));
  }
  /** returns ki list */
  if (action === 'returns') {
    return json_({ ok: true, returns: returnsList_(params.limit), version: VERSION });
  }
  /** pending reviews (approval baaki) */
  if (action === 'pending_reviews') {
    return json_({ ok: true, pending: pendingReviewsCount_(), version: VERSION });
  }
  if (action === 'settings') {
    return json_({ ok: true, settings: readSettings_(), time: new Date().toISOString() });
  }
  if (action === 'recent') {
    var name = String(params.sheet || 'Orders');
    var limit = Math.min(100, Math.max(1, Number(params.limit || 20)));
    return json_({ ok: true, sheet: name, rows: recentRows_(name, limit) });
  }
  if (action === 'health') {
    return json_({
      ok: true,
      time: new Date().toISOString(),
      sheets: counts_(),
      writeTokenConfigured: Boolean(EFFECTIVE_WRITE_TOKEN),
      masterTokenConfigured: masterTokenConfigured_(),
    });
  }
  if (action === 'schema') {
    // website/admin ko pata chale ki sheet me kaun si tabs aur headers hain
    var out = {};
    Object.keys(HEADERS).forEach(function (name) {
      out[name] = headersOf_(sheet_(name));
    });
    return json_({ ok: true, schema: out, time: new Date().toISOString() });
  }
  return json_({ ok: false, error: 'unknown action' });
}

/* ─────────────────────────── write ─────────────────────────── */

function writeSettings_(settings) {
  var sheet = sheet_('Settings');
  var values = sheet.getDataRange().getValues();
  var index = {};
  for (var i = 1; i < values.length; i += 1) {
    index[String(values[i][0] || '').trim().toLowerCase()] = i + 1;
  }
  var written = 0;
  Object.keys(settings || {}).forEach(function (key) {
    var cleanKey = String(key).trim().toLowerCase();
    if (!cleanKey) return;
    var value = settings[key];
    if (value === undefined || value === null) return;
    if (index[cleanKey]) sheet.getRange(index[cleanKey], 2).setValue(value);
    else sheet.appendRow([cleanKey, value, '']);
    written += 1;
  });
  return written;
}

/**
 * Duplicate row guard — ek hi order/line do baar na chadhe.
 * (Browser do transport se bhej sakta hai — POST fail hone par form fallback.)
 */
function rowKeyOf_(name, row) {
  if (!row) return '';
  if (name === 'Orders') return 'o|' + String(row['Order ID'] || '');
  if (name === 'Order Items') {
    return 'i|' + [row['Order ID'], row.Product, row.Size, row.Colour].join('|');
  }
  if (name === 'Newsletter') return 'n|' + String(row.Email || '').toLowerCase();
  if (name === 'Enquiries') return 'e|' + String(row['Enquiry ID'] || '');
  if (name === 'Messages') return 'm|' + [row.Timestamp, row.Email, row.Subject].join('|');
  if (name === 'Reviews') return 'v|' + [row.Handle, row.Name, row.Body].join('|');
  return '';
}

function existingKeys_(sheet, headers) {
  var keys = {};
  var last = sheet.getLastRow();
  if (last < 2) return keys;
  var name = sheet.getName();
  var cols = [];
  if (name === 'Orders') cols = [headers.indexOf('Order ID')];
  else if (name === 'Order Items') {
    cols = [headers.indexOf('Order ID'), headers.indexOf('Product'), headers.indexOf('Size'), headers.indexOf('Colour')];
  } else if (name === 'Newsletter') cols = [headers.indexOf('Email')];
  else if (name === 'Enquiries') cols = [headers.indexOf('Enquiry ID')];
  else if (name === 'Messages') cols = [headers.indexOf('Timestamp'), headers.indexOf('Email'), headers.indexOf('Subject')];
  else if (name === 'Reviews') cols = [headers.indexOf('Handle'), headers.indexOf('Name'), headers.indexOf('Body')];
  if (cols.some(function (index) { return index < 0; })) return keys;
  var values = sheet.getRange(2, 1, last - 1, headers.length).getValues();
  values.forEach(function (values_row) {
    var picked = {};
    cols.forEach(function (index) { picked[headers[index]] = values_row[index]; });
    var key = rowKeyOf_(name, picked);
    if (key) keys[key] = true;
  });
  return keys;
}

function appendRows_(rows) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var written = 0;
  try {
    // Sheet-wise dedupe ek hi baar padho (pehle har row par poora tab scan hota tha —
    // bade order par ye 30s execution limit ke bahut kareeb chala jaata tha).
    var seenBySheet = {};
    rows.forEach(function (entry) {
      var name = String(entry.sheet || 'Orders');
      if (!HEADERS[name]) return;
      var sheet = sheet_(name);
      var headers = headersOf_(sheet);
      if (!seenBySheet[name]) seenBySheet[name] = existingKeys_(sheet, headers);
      var seen = seenBySheet[name];
      var key = rowKeyOf_(name, entry.row || {});
      if (key && seen[key]) return; // pehle se hai — duplicate nahi
      var row = [];
      for (var i = 0; i < headers.length; i += 1) {
        var value = entry.row ? entry.row[headers[i]] : '';
        row.push(value === undefined || value === null ? '' : value);
      }
      sheet.appendRow(row);
      if (key) seen[key] = true;
      written += 1;
    });
  } finally {
    lock.releaseLock();
  }
  return written;
}

/* read helpers jo upar wale loop me use hote hain */


/**
 * Upsert — key column (jaise `Handle`) se row dhoondo; mile to update, warna append.
 * Products tab ke liye (ek product = ek row, dobara upload karne par duplicate nahi).
 */
function upsertRow_(name, keyColumn, row) {
  var sheet = sheet_(name);
  var headers = headersOf_(sheet);
  var keyIndex = headers.indexOf(keyColumn);
  if (keyIndex < 0) return appendRows_([{ sheet: name, row: row }]);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var keyValue = String(row[keyColumn] || '');
    var last = sheet.getLastRow();
    if (last >= 2 && keyValue) {
      var keys = sheet.getRange(2, keyIndex + 1, last - 1, 1).getValues();
      for (var i = 0; i < keys.length; i += 1) {
        if (String(keys[i][0]).trim() === keyValue.trim()) {
          var values = headers.map(function (header) {
            var value = row[header];
            return value === undefined || value === null ? '' : value;
          });
          sheet.getRange(i + 2, 1, 1, headers.length).setValues([values]);
          return 1;
        }
      }
    }
    return appendRows_([{ sheet: name, row: row }]);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  var body = {};
  var params = (e && e.parameter) || {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (error) {
    body = {};
  }
  // Browser "hidden form" fallback form-encoded bhejta hai — wahan postData khali hota hai
  if (!body || !body.action) {
    if (params.action || params.rows) {
      body = { action: params.action || 'append', token: params.token, rows: params.rows, sheet: params.sheet };
      if (typeof body.rows === 'string') {
        try {
          body.rows = JSON.parse(body.rows);
        } catch (error) {
          return json_({ ok: false, error: 'invalid rows' });
        }
      }
    }
  }
  if (!body || (!body.action && !body.rows)) {
    return json_({ ok: false, error: 'invalid json' });
  }
  var given = String(body.token || '');
  var masterOk = masterTokenConfigured_() && given === MASTER_TOKEN;
  var writeOk = Boolean(EFFECTIVE_WRITE_TOKEN) && given === EFFECTIVE_WRITE_TOKEN;
  if (!masterOk && !writeOk) {
    return json_({ ok: false, error: 'unauthorized' });
  }

  try {
    // settings badalna / padhna sirf master token se
    if (!masterOk && body.action !== 'append') {
      return json_({ ok: false, error: 'unauthorized' });
    }

    if (body.action === 'settings_save') {
      var count = writeSettings_(body.settings || {});
      return json_({ ok: true, written: count, settings: readSettings_() });
    }

    if (body.action === 'upsert') {
      var name = String(body.sheet || 'Products');
      if (!HEADERS[name]) return json_({ ok: false, error: 'unknown sheet' });
      var written = upsertRow_(name, String(body.key || 'Handle'), body.row || {});
      return json_({ ok: true, written: written, time: new Date().toISOString() });
    }

    /**
     * Admin ke kaam — sab master token se:
     *   order_status · coupon_save · stock_set · return_request · review_moderate
     *   banner_save · faq_save · category_save · order_note · notify_resend
     */
    if (body.action === 'order_status') {
      var statusResult = adminSetOrderStatus_(
        body.order || body.orderId,
        body.status,
        body.message,
        body.visible,
        { courier: body.courier, awb: body.awb, trackingUrl: body.trackingUrl },
      );
      return json_(statusResult);
    }

    if (body.action === 'order_note') {
      var noteOrder = String(body.order || body.orderId || '').trim().toUpperCase();
      if (!noteOrder) return json_({ ok: false, error: 'order required' });
      var ordersTabRef = sheet_('Orders');
      var ordersHead = headersOf_(ordersTabRef);
      var notesCol = ordersHead.indexOf('Notes');
      if (notesCol < 0) return json_({ ok: false, error: 'no notes column' });
      var found = false;
      var orderRows = ordersTabRef.getRange(2, 1, ordersTabRef.getLastRow() - 1, ordersHead.length).getValues();
      for (var oi = orderRows.length - 1; oi >= 0; oi -= 1) {
        if (String(orderRows[oi][ordersHead.indexOf('Order ID')] || '').trim().toUpperCase() !== noteOrder) continue;
        ordersTabRef.getRange(oi + 2, notesCol + 1).setValue(String(body.note || ''));
        found = true;
        break;
      }
      audit_('order_note', 'Orders', noteOrder, '', body.note);
      return json_({ ok: found, order: noteOrder, error: found ? undefined : 'order not found' });
    }

    if (body.action === 'coupon_save') {
      var saved = couponSave_(body.coupon || body);
      audit_('coupon_save', 'Coupons', (body.coupon || body).code, '', saved.coupon ? saved.coupon.code : '');
      return json_(saved);
    }

    if (body.action === 'coupon_disable') {
      var disabled = couponSave_({ code: body.code, active: false });
      audit_('coupon_disable', 'Coupons', body.code, 'active', 'disabled');
      return json_(disabled);
    }

    if (body.action === 'stock_set') {
      var stockHandle = String(body.handle || '').trim();
      if (!stockHandle) return json_({ ok: false, error: 'handle required' });
      var stockWritten = stockSet_(stockHandle, body.size || 'ONE', body.qty);
      audit_('stock_set', 'Stock', stockHandle + '/' + String(body.size || 'ONE'), '', body.qty);
      return json_({ ok: true, written: stockWritten, left: stockOf_(stockHandle, body.size || 'ONE') });
    }

    if (body.action === 'return_request') {
      var returnResult = createReturn_(body);
      return json_(returnResult);
    }

    if (body.action === 'review_moderate') {
      var reviewHandle = String(body.handle || '').trim();
      var reviewStatus = String(body.status || 'publish').trim().toLowerCase();
      var reviewsTabRef = sheet_('Reviews');
      var reviewsHead = headersOf_(reviewsTabRef);
      var reviewStatusCol = reviewsHead.indexOf('Status');
      var reviewHandleCol = reviewsHead.indexOf('Handle');
      if (reviewStatusCol < 0 || reviewHandleCol < 0) return json_({ ok: false, error: 'bad reviews tab' });
      var changed = 0;
      if (reviewsTabRef.getLastRow() > 1) {
        var reviewRows = reviewsTabRef.getRange(2, 1, reviewsTabRef.getLastRow() - 1, reviewsHead.length).getValues();
        for (var ri2 = 0; ri2 < reviewRows.length; ri2 += 1) {
          if (String(reviewRows[ri2][reviewHandleCol] || '').trim() !== reviewHandle) continue;
          reviewsTabRef.getRange(ri2 + 2, reviewStatusCol + 1).setValue(reviewStatus);
          changed += 1;
        }
      }
      audit_('review_moderate', 'Reviews', reviewHandle, '', reviewStatus);
      return json_({ ok: changed > 0, updated: changed, handle: reviewHandle, status: reviewStatus });
    }

    if (body.action === 'banner_save' || body.action === 'faq_save' || body.action === 'category_save') {
      var tabName =
        body.action === 'banner_save' ? 'Banners' : body.action === 'faq_save' ? 'FAQs' : 'Categories';
      var keyName = body.action === 'banner_save' ? 'Slot' : body.action === 'faq_save' ? 'Question' : 'Slug';
      ensureContentTab_(tabName);
      var savedRow = upsertRow_(tabName, keyName, body.row || {});
      audit_(body.action, tabName, (body.row || {})[keyName], '', savedRow);
      return json_({ ok: true, written: savedRow, sheet: tabName });
    }

    if (body.action === 'notify_resend') {
      var resendOrder = String(body.order || body.orderId || '').trim().toUpperCase();
      var resendFound = findOrder_(resendOrder);
      if (!resendFound.ok) return json_({ ok: false, error: 'order not found' });
      return json_(notifyOrder_(resendFound.order, String(body.status || resendFound.order.Status || 'placed')));
    }

    /** Poora order ek call me — sheet me adhoora order kabhi nahi */
    if (body.action === 'place_order') {
      return json_(placeOrder_(body));
    }

    /** Address check ka log — site isi se `AddressCheck` tab bhrti hai */
    if (body.action === 'address_check') {
      var check = validateDelivery_(body.state, body.pin);
      var addressRow = {
        Timestamp: nowIso_(),
        Result: check.ok ? 'ok' : String(check.error || 'invalid'),
        Customer: String(body.name || ''),
        Phone: phoneDigits_(body.phone),
        Address: String(body.address || ''),
        City: String(body.city || ''),
        'State chosen': String(body.state || ''),
        PIN: String(body.pin || ''),
        'PIN state': regionOfPin_(body.pin),
        District: String(body.district || ''),
        Blocked: check.blocked ? 'yes' : 'no',
        'Source page': String(body.source || ''),
      };
      appendRows_([{ sheet: 'AddressCheck', row: addressRow }]);
      return json_({ ok: check.ok, message: check.message || '', region: check.region || '' });
    }

    if (body.action === 'append') {
      var rows = Array.isArray(body.rows) ? body.rows : [];
      if (!rows.length) return json_({ ok: false, error: 'no rows' });
      if (!masterOk) {
        // write-only token: allowlist + row cap (spam/bulk abuse se bachav)
        rows = rows
          .filter(function (entry) {
            return WRITE_SHEETS.indexOf(String(entry.sheet || '')) >= 0;
          })
          .slice(0, MAX_WRITE_ROWS);
        if (!rows.length) return json_({ ok: false, error: 'sheet not allowed' });
      }
      return json_({ ok: true, written: appendRows_(rows), time: new Date().toISOString() });
    }
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }

  return json_({ ok: false, error: 'unknown action' });
}

/* ─────────────────────────── self-test ─────────────────────────── */

/** Apps Script editor me chalaiye — ek test row append karke result dikhata hai. */
function testAppend() {
  var written = appendRows_([
    {
      sheet: 'Orders',
      row: {
        'Order ID': 'TY-TEST01',
        'Date & Time': new Date().toISOString(),
        Event: 'test',
        Customer: 'Test Customer',
        'Total ₹': 1499,
      },
    },
  ]);
  Logger.log('written: ' + written);
}

/** Sheet ki health — kaunsi tab me kitni rows hain. */
function testHealth() {
  Logger.log(JSON.stringify(counts_()));
}


/* ------------------------------------------------------------------ */
/* Reviews import — purane reviews ek baar me sheet me                */
/* ------------------------------------------------------------------ */

/** Site ka public export (scripts/reviews-sync/export-for-sheet.mjs) */
var REVIEWS_IMPORT_URL = 'https://www.trendsyounique.fashion/data/reviews-import.json';

/**
 * Sheet khulte hi custom menu — owner ko code chalane ki zaroorat nahi.
 * (Menu dikhne ke liye script ko sheet se bound hona chahiye, ya standalone
 *  script me bhi function run ho sakta hai: Editor → Run → importAllReviews.)
 */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    var menu = ui.createMenu('TRENDS tools');

    menu.addItem('0. Setup (ek baar — tabs + settings)', 'setup');

    menu.addSubMenu(
      ui
        .createMenu('1. Products')
        .addItem('Saare products ki list (ID ke saath)', 'syncProductList')
        .addItem('Saari products ki images (ProductImages)', 'syncProductImages')
        .addItem('Saari images ek jagah (ImagesAll)', 'syncAllImages')
        .addItem('Har product ki ID bharo (admin-only)', 'backfillAllProductIds'),
    );

    menu.addSubMenu(
      ui
        .createMenu('2. Reviews')
        .addItem('Saare reviews import karo', 'importAllReviews')
        .addItem('Purane reviews me Product ID bharo', 'backfillReviewProductIds')
        .addItem('Reviews ki photos bharo', 'backfillReviewPhotos')
        .addItem('Approval kaise karein', 'showReviewHelp'),
    );

    menu.addSubMenu(
      ui
        .createMenu('3. Orders')
        .addItem('Order ke 5 step comments banao', 'createOrderUpdateTemplates')
        .addItem('Email queue abhi chalao (retry)', 'runMailQueueNow')
        .addItem('Test email bhejo', 'promptEmailTest')
        .addItem('Aaj ka summary sheet me likho', 'writeDailyDigest')
        .addItem('Low stock list', 'showLowStock')
        .addItem('Coupons ki list', 'showCoupons'),
    );

    menu.addSubMenu(
      ui
        .createMenu('4. Reports')
        .addItem('Business summary', 'showReportSummary')
        .addItem('Pichhle 7 din ki sale', 'showReportWeekly')
        .addItem('Top products', 'showReportProducts')
        .addItem('Top customers', 'showReportCustomers'),
    );

    menu
      .addSeparator()
      .addItem('9. Sab kuch test karo (self-test)', 'selfTestOnSheet')
      .addItem('10. Automatic triggers lagao', 'installTriggers')
      .addItem('11. Purani log rows saaf karo', 'cleanupLogs')
      .addItem('12. Madad / Read Me', 'writeReadme_')
      .addToUi();
  } catch (error) {
    // sheet ke bahar se call hua (web app) — menu ki zaroorat nahi
  }
}

/* ─────────────────────── menu ke chhote kaam ─────────────────────── */

/** Menu: business summary sheet me likhta hai */
function showReportSummary() {
  var summary = reportSummary_();
  var tab = ensureTab_('_report');
  tab.clear();
  tab.getRange(1, 1, 10, 2).setValues([
    ['TRENDS YOUNIQUE — summary', ''],
    ['Orders', String(summary.orders)],
    ['Delivered', String(summary.delivered)],
    ['Cancelled', String(summary.cancelled)],
    ['Revenue', money_(summary.revenue)],
    ['Average order value', money_(summary.averageOrderValue)],
    ['Returns', String(summary.returns)],
    ['Low stock items', String(summary.lowStock)],
    ['Reviews approval pending', String(summary.reviewsPending)],
    ['Active coupons', String(summary.couponsActive)],
  ]);
  tab.getRange(1, 1, 1, 2).setFontWeight('bold');
  tab.setColumnWidth(1, 240);
  tab.setColumnWidth(2, 200);
  return summary;
}

/** Menu: pichhle 7 din ki sale */
function showReportWeekly() {
  var daily = reportDaily_(7);
  var tab = ensureTab_('_report');
  tab.clear();
  tab.getRange(1, 1, 1, 3).setValues([['Date', 'Orders', 'Revenue']]).setFontWeight('bold');
  var rows = daily.days.map(function (day) {
    return [day.date, day.orders, day.revenue];
  });
  if (rows.length) tab.getRange(2, 1, rows.length, 3).setValues(rows);
  return daily;
}

/** Menu: top products */
function showReportProducts() {
  var products = reportTopProducts_(20);
  var tab = ensureTab_('_report');
  tab.clear();
  tab.getRange(1, 1, 1, 4).setValues([['Handle', 'Product', 'Qty', 'Revenue']]).setFontWeight('bold');
  var rows = products.map(function (item) {
    return [item.handle, item.product, item.qty, item.revenue];
  });
  if (rows.length) tab.getRange(2, 1, rows.length, 4).setValues(rows);
  return products;
}

/** Menu: top customers */
function showReportCustomers() {
  var customers = reportTopCustomers_(20);
  var tab = ensureTab_('_report');
  tab.clear();
  tab.getRange(1, 1, 1, 4).setValues([['Phone', 'Name', 'Orders', 'Revenue']]).setFontWeight('bold');
  var rows = customers.map(function (item) {
    return [item.phone, item.name, item.orders, item.revenue];
  });
  if (rows.length) tab.getRange(2, 1, rows.length, 4).setValues(rows);
  return customers;
}

/** Menu: low stock */
function showLowStock() {
  var list = lowStockList_();
  var tab = ensureTab_('_report');
  tab.clear();
  tab.getRange(1, 1, 1, 3).setValues([['Handle', 'Size', 'Qty']]).setFontWeight('bold');
  var rows = list.map(function (item) {
    return [item.handle, item.size, item.qty];
  });
  if (rows.length) tab.getRange(2, 1, rows.length, 3).setValues(rows);
  return list;
}

/** Menu: coupons */
function showCoupons() {
  var tab = ensureTab_('_report');
  tab.clear();
  tab.getRange(1, 1, 1, 6).setValues([['Code', 'Type', 'Value', 'Min order ₹', 'Used', 'Active']]).setFontWeight('bold');
  var coupons = couponsAll_();
  var rows = coupons.map(function (coupon) {
    return [
      text_(coupon.Code),
      text_(coupon.Type),
      num_(coupon.Value, 0),
      num_(coupon['Min order ₹'], 0),
      int_(coupon.Used, 0),
      text_(coupon.Active),
    ];
  });
  if (rows.length) tab.getRange(2, 1, rows.length, 6).setValues(rows);
  return coupons;
}

/** Menu: aaj ka summary ek line me (owner ko WhatsApp par bhejne layak) */
function writeDailyDigest() {
  var summary = reportSummary_();
  var line =
    'Aaj tak: ' + summary.orders + ' orders · ' + money_(summary.revenue) + ' sale · ' +
    summary.lowStock + ' low-stock · ' + summary.reviewsPending + ' reviews pending';
  logNotification_('internal', setting_('owner_whatsapp', ''), '', 'daily_digest', line, 'ready');
  ownerAlert_('TRENDS daily digest', line);
  try {
    SpreadsheetApp.getUi().alert(line);
  } catch (error) {
    // ignore
  }
  return { ok: true, line: line, summary: summary };
}

/** Menu: purani log rows (Notifications/AuditLog) saaf — sheet halki rahe */
function cleanupLogs() {
  var keep = 2000;
  var report = [];
  ['Notifications', 'AuditLog'].forEach(function (name) {
    var tab = book_().getSheetByName(name);
    if (!tab) return;
    var rows = tab.getLastRow() - 1;
    if (rows <= keep) {
      report.push(name + ': ' + rows + ' rows (kuch hataya nahi)');
      return;
    }
    tab.deleteRows(2, rows - keep);
    report.push(name + ': ' + (rows - keep) + ' purani rows hat gayi');
  });
  audit_('cleanup_logs', 'Notifications/AuditLog', '', '', report.join(' | '));
  try {
    SpreadsheetApp.getUi().alert('Saaf-safai ho gayi:\n' + report.join('\n'));
  } catch (error) {
    // ignore
  }
  return { ok: true, report: report };
}

/**
 * Automatic triggers — ek baar chalaiye:
 *   • `onEdit`  : Order ka Status badla → timeline row + customer message
 *   • `dailyDigest` : roz subah 9 baje summary
 */
function installTriggers() {
  var existing = ScriptApp.getProjectTriggers();
  existing.forEach(function (trigger) {
    var handler = trigger.getHandlerFunction();
    if (
      handler === 'onEditAutoStatus' ||
      handler === 'writeDailyDigest' ||
      handler === 'processMailQueue'
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('onEditAutoStatus').forSpreadsheet(book_()).onEdit().create();
  ScriptApp.newTrigger('writeDailyDigest').timeBased().atHour(9).everyDays(1).create();
  // email queue har 10 minute — fail hui mail apne aap retry hoti rehti hai
  ScriptApp.newTrigger('processMailQueue').timeBased().everyMinutes(10).create();
  var message =
    'Triggers lag gaye:\n• Status badalne par timeline + customer email\n' +
    '• Roz 9 baje summary\n• Har 10 minute email queue ki retry';
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (error) {
    // ignore
  }
  return { ok: true, message: message };
}

/**
 * `onEdit` — owner Orders tab me Status badalta hai to **khud**:
 *   1. `Order Updates` me timeline row
 *   2. customer ke liye WhatsApp text (Notifications tab me)
 *   3. Order Items ka status
 */
function onEditAutoStatus(e) {
  try {
    if (!e || !e.range) return;
    var tab = e.range.getSheet();
    if (!tab || tab.getName() !== 'Orders') return;
    var head = headersOf_(tab);
    var statusCol = head.indexOf('Status') + 1;
    if (statusCol < 1 || e.range.getColumn() !== statusCol) return;
    if (e.range.getRow() < 2) return;
    var idCol = head.indexOf('Order ID') + 1;
    if (idCol < 1) return;
    var orderId = text_(tab.getRange(e.range.getRow(), idCol).getValue());
    var status = text_(e.value || e.range.getValue());
    if (!orderId || !status) return;
    adminSetOrderStatus_(orderId, status, '', true);
  } catch (error) {
    // trigger me error kabhi sheet na tode
  }
}

function showReviewHelp() {
  try {
    SpreadsheetApp.getUi().alert(
      'Reviews tab — approval\n\n' +
        'Status = publish / approved → site par live.\n' +
        'Status khaali, pending ya reject → site par nahi dikhega.\n\n' +
        'Product ID column me product ki id (jaise 1042) — ProductList tab se copy kariye.\n' +
        'ID khaali ho to Handle se product pehchana jaata hai.',
    );
  } catch (error) {
    // ignore
  }
}

/**
 * Saare reviews site ke JSON se `Reviews` tab me.
 * - duplicate (same handle + same text) skip
 * - Status = publish
 * - 400-400 rows ke batch me likhta hai (Apps Script ki 6 min limit ke andar)
 */
function importAllReviews() {
  var tab = sheet_('Reviews');
  var head = headersOf_(tab);
  var last = tab.getLastRow();
  var existing = last > 1 ? tab.getRange(2, 1, last - 1, head.length).getValues() : [];
  var seen = {};
  function keyOf(handle, body) {
    return String(handle || '').trim() + '::' + String(body || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 160);
  }
  for (var i = 0; i < existing.length; i += 1) {
    var handleCell = existing[i][head.indexOf('Handle')];
    var bodyCell = existing[i][head.indexOf('Body')];
    seen[keyOf(handleCell, bodyCell)] = true;
  }

  var response = UrlFetchApp.fetch(REVIEWS_IMPORT_URL, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    return { ok: false, error: 'fetch_failed', status: response.getResponseCode() };
  }
  var payload = JSON.parse(response.getContentText());
  var rows = (payload && payload.rows) || [];
  if (!rows.length) return { ok: false, error: 'no_rows' };

  // jo reviews pehle se sheet me hain, unme `Images` khaali ho to photo links bhar do
  var imagesCol = head.indexOf('Images');
  if (imagesCol >= 0 && existing.length) {
    var byKey = {};
    rows.forEach(function (row) {
      byKey[keyOf(row.handle, row.body)] = row.images || '';
    });
    var fixed = 0;
    for (var ri = 0; ri < existing.length; ri += 1) {
      var rowKey = keyOf(existing[ri][head.indexOf('Handle')], existing[ri][head.indexOf('Body')]);
      var wantImages = byKey[rowKey] || '';
      if (!wantImages) continue;
      if (String(existing[ri][imagesCol] || '').trim() === wantImages) continue;
      existing[ri][imagesCol] = wantImages;
      fixed += 1;
    }
    if (fixed) tab.getRange(2, 1, existing.length, head.length).setValues(existing);
  }

  var pending = rows.filter(function (row) {
    return !seen[keyOf(row.handle, row.body)];
  });
  if (!pending.length) {
    return { ok: true, url: REVIEWS_IMPORT_URL, source: rows.length, added: 0, skipped: rows.length };
  }

  var CHUNK = 400;
  var added = 0;
  for (var start = 0; start < pending.length; start += CHUNK) {
    var slice = pending.slice(start, start + CHUNK).map(function (row) {
      return head.map(function (name) {
        if (name === 'Timestamp') return row.timestamp || new Date().toISOString();
        if (name === 'Handle') return row.handle || '';
        if (name === 'Product') return row.product || '';
        if (name === 'Name') return row.name || 'Customer';
        if (name === 'Rating') return Number(row.rating) || 5;
        if (name === 'Title') return row.title || '';
        if (name === 'Body') return row.body || '';
        if (name === 'Status') return row.status || 'publish';
        if (name === 'Source') return row.source || 'trustoo';
        if (name === 'Product ID') return row.productId || '';
        if (name === 'Images') return row.images || '';
        return '';
      });
    });
    tab.getRange(tab.getLastRow() + 1, 1, slice.length, head.length).setValues(slice);
    added += slice.length;
  }

  return {
    ok: true,
    url: REVIEWS_IMPORT_URL,
    source: rows.length,
    added: added,
    skipped: rows.length - added,
    total: tab.getLastRow() - 1,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  BHAG 1 ke baad — poora e-commerce engine.
 *  Neeche ke modules file ke aakhir me hain (Apps Script me function order se
 *  farak nahi padta), taaki purana kaam chalta rahe aur naya add hota rahe.
 * ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
 *  BHAG 2 — CHHOTE HELPERS (pure functions)
 * ---------------------------------------------------------------------------
 *  Ye sab **kisi sheet ko chhede bina** kaam karte hain, isliye inhe self-test
 *  (`runSelfTests`) seedha call karke check karta hai. Site ke numbers,
 *  phone/PIN validation aur formatting sab yahin se aate hain — ek jagah galat
 *  hua to poore system me galat jaata, isliye ek hi jagah rakha hai.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** khaali cheez — null, undefined, khaali string, sirf spaces */
function isBlank_(value) {
  if (value === null || value === undefined) return true;
  var text = String(value).replace(/\s+/g, ' ').trim();
  return text === '';
}

/** kisi bhi cheez ko saaf single-line text banata hai (max length optional) */
function text_(value, max) {
  var out = value === null || value === undefined ? '' : String(value);
  out = out.replace(/\s+/g, ' ').trim();
  if (max && out.length > max) out = out.slice(0, max);
  return out;
}

/** "true"/"yes"/"1"/"haan" sab sach; khaali/`false`/`no` jhoot */
function bool_(value, fallback) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return fallback === undefined ? false : Boolean(fallback);
  }
  if (typeof value === 'boolean') return value;
  return /^(true|yes|y|1|haan|ha|on|active|show|visible|publish|approved)$/i.test(String(value).trim());
}

/** number — jo bhi kachra ho, NaN ki jagah default */
function num_(value, fallback) {
  var orDefault = fallback === undefined ? 0 : fallback;
  if (typeof value === 'number') return isFinite(value) ? value : orDefault;
  var raw = String(value === null || value === undefined ? '' : value).replace(/[₹,\s]/g, '');
  if (!/[0-9]/.test(raw)) return orDefault;
  var parsed = Number(raw.replace(/[^0-9.\-]/g, ''));
  return isFinite(parsed) ? parsed : orDefault;
}

/** poora number (qty, stock) */
function int_(value, fallback) {
  var n = Math.round(num_(value, fallback === undefined ? 0 : fallback));
  return isFinite(n) ? n : 0;
}

/**
 * ₹ ka saaf format — **Indian grouping** (₹12,34,567), kyunki invoice aur
 * WhatsApp message par yahi sahi lagta hai. Western format (₹1,234,567) galat lagta.
 */
function money_(value) {
  var n = Math.round(num_(value, 0));
  var sign = n < 0 ? '-' : '';
  var digits = String(Math.abs(n));
  if (digits.length <= 3) return sign + '₹' + digits;
  var last3 = digits.slice(-3);
  var rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return sign + '₹' + rest + ',' + last3;
}

/** 10 digit mobile — +91, spaces, dash sab hata deta hai */
/** email/site par dikhane ke liye — `+91 7740992663` */
function waDisplay_(value) {
  var digits = phoneDigits_(value);
  return digits ? '+91 ' + digits : '';
}

function phoneDigits_(value) {
  var digits = String(value === null || value === undefined ? '' : value).replace(/\D/g, '');
  if (digits.length > 10) digits = digits.slice(-10);
  return digits;
}

/** ye phone theek lagta hai? (India mobile 6-9 se shuru, 10 digit) */
function phoneOk_(value) {
  return /^[6-9]\d{9}$/.test(phoneDigits_(value));
}

/** email ka basic check (regex hi kaafi hai — bounce sheet me log hota hai) */
function emailOk_(value) {
  var mail = text_(value);
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(mail);
}

/** PIN code — 6 digit, 0 se shuru nahi */
function pinOk_(value) {
  return /^[1-9]\d{5}$/.test(text_(value));
}

/**
 * PIN ka pehla digit → India ka region.
 * (Ye "kis state ka hai" ka exact jawab nahi, par galat state pakadne ke liye kaafi
 *  hai: 6 = South, 3 = West, 1 = North, 7 = East …)
 */
function regionOfPin_(pin) {
  var map = {
    '1': 'North (J&K, Punjab, Haryana, HP, Delhi)',
    '2': 'North (UP, Uttarakhand)',
    '3': 'West (Rajasthan, Gujarat)',
    '4': 'West (Maharashtra, MP, Chhattisgarh, Goa)',
    '5': 'South (Telangana, AP, Karnataka)',
    '6': 'South (Tamil Nadu, Kerala)',
    '7': 'East (West Bengal, Odisha, NE)',
    '8': 'East (Bihar, Jharkhand)',
  };
  var first = text_(pin).charAt(0);
  return map[first] || '';
}

/** website ka slug — handle banane ke liye */
function slug_(value) {
  return text_(value)
    .toLowerCase()
    .replace(/['"’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** random id — LK-8F3K2M jaisa order number, TY-RET-… return id */
function randId_(prefix, length) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var size = length || 6;
  var out = '';
  for (var i = 0; i < size; i += 1) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return (prefix ? prefix + '-' : '') + out;
}

function nowIso_() {
  return new Date().toISOString();
}

/** sheet me padhne layak date+time (Asia/Kolkata already sheet timezone se) */
function fmtDate_(value, withTime) {
  if (isBlank_(value)) return '';
  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return text_(value, 40);
  var padded = function (n) { return n < 10 ? '0' + n : String(n); };
  var day = padded(date.getDate()) + '/' + padded(date.getMonth() + 1) + '/' + date.getFullYear();
  if (!withTime) return day;
  return day + ' ' + padded(date.getHours()) + ':' + padded(date.getMinutes());
}

/** aaj se n din pehle ka ISO date (reports ke liye) */
function daysAgoIso_(days) {
  var date = new Date();
  date.setDate(date.getDate() - (days || 0));
  return date.toISOString();
}

/** HTML me safe text — invoice/track page par user ka naam bhi aata hai */
function escapeHtml_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** CSV cell — quotes/comma/newline sambhalta hai */
function csvCell_(value) {
  var out = String(value === null || value === undefined ? '' : value).replace(/\r?\n/g, ' ');
  return /[",]/.test(out) ? '"' + out.replace(/"/g, '""') + '"' : out;
}

/** do strings ka chhota hash — duplicate detection ke liye */
function hash_(value) {
  var text = String(value === null || value === undefined ? '' : value);
  if (typeof Utilities !== 'undefined' && Utilities.computeDigest) {
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text, Utilities.Charset.UTF_8);
    return digest
      .map(function (byte) {
        var v = (byte < 0 ? byte + 256 : byte).toString(16);
        return v.length === 1 ? '0' + v : v;
      })
      .join('')
      .slice(0, 16);
  }
  // fallback (self-test / Node harness): chhota djb2
  var out = 5381;
  for (var i = 0; i < text.length; i += 1) out = ((out << 5) + out + text.charCodeAt(i)) | 0;
  return (out >>> 0).toString(16);
}

/** rows (array of arrays) ko headers ke saath object banao */
function rowsToObjects_(headers, rows) {
  var out = [];
  for (var r = 0; r < rows.length; r += 1) {
    var object = {};
    for (var h = 0; h < headers.length; h += 1) object[headers[h]] = rows[r][h];
    out.push(object);
  }
  return out;
}

/** ek column ke hisaab se sum */
function sumBy_(rows, key) {
  var total = 0;
  for (var i = 0; i < (rows || []).length; i += 1) total += num_(rows[i][key], 0);
  return total;
}

/** duplicates hatao (text compare) */
function uniq_(list) {
  var seen = {};
  var out = [];
  for (var i = 0; i < (list || []).length; i += 1) {
    var key = text_(list[i]).toLowerCase();
    if (!key || seen[key]) continue;
    seen[key] = true;
    out.push(list[i]);
  }
  return out;
}

/** group by + count — reports ke liye */
function countBy_(rows, key) {
  var out = {};
  for (var i = 0; i < (rows || []).length; i += 1) {
    var value = text_(rows[i][key]);
    if (!value) continue;
    out[value] = (out[value] || 0) + 1;
  }
  return out;
}

/** "a, b ,c" → ['a','b','c'] — Settings ki list keys ke liye */
function listOf_(value) {
  var raw = text_(value);
  if (!raw) return [];
  return uniq_(
    raw
      .split(/[,;|\n]/)
      .map(function (part) {
        return text_(part);
      })
      .filter(function (part) {
        return part !== '';
      }),
  );
}

/** object se khaali values hata do (settings merge me kaam aata hai) */
function compact_(object) {
  var out = {};
  Object.keys(object || {}).forEach(function (key) {
    var value = object[key];
    if (value === null || value === undefined) return;
    if (typeof value === 'string' && value.trim() === '') return;
    out[key] = value;
  });
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  BHAG 3 — SETTINGS (cache ke saath), STOCK aur COUPONS
 * ---------------------------------------------------------------------------
 *  Site har 15 second me settings padhti hai. Isliye:
 *    • `readSettingsCached_()` — CacheService me 5 minute, sheet par load kam.
 *    • settings likhte hi cache saaf (`bustSettingsCache_`) — purani value kabhi
 *      nahi chipkti.
 *  Stock aur coupons dono **sheet hi** hain: owner row badalta hai, site turant
 *  badalti hai. Koi redeploy nahi.
 * ═══════════════════════════════════════════════════════════════════════════ */

var SETTINGS_CACHE_KEY = 'trends:settings:v1';
var SETTINGS_CACHE_SECONDS = 300;

/** settings ko cache se (ya sheet se) — object {key: value} */
function readSettingsCached_() {
  var cache = null;
  try {
    cache = CacheService.getScriptCache();
  } catch (error) {
    cache = null;
  }
  if (cache) {
    try {
      var hit = cache.get(SETTINGS_CACHE_KEY);
      if (hit) return JSON.parse(hit);
    } catch (error2) {
      // cache kharab — neeche sheet se padh lenge
    }
  }
  var settings = readSettings_();
  if (cache) {
    try {
      cache.put(SETTINGS_CACHE_KEY, JSON.stringify(settings), SETTINGS_CACHE_SECONDS);
    } catch (error3) {
      // cache bhar gaya — koi baat nahi
    }
  }
  return settings;
}

/** settings likhne ke baad cache saaf — warna 5 minute purani value dikhti rehti */
function bustSettingsCache_() {
  try {
    CacheService.getScriptCache().remove(SETTINGS_CACHE_KEY);
  } catch (error) {
    // ignore
  }
  try {
    CacheService.getScriptCache().remove(PUBLIC_SETTINGS_CACHE_KEY);
  } catch (error2) {
    // ignore
  }
}

/** ek setting ka value (string) */
function setting_(key, fallback) {
  var all = readSettingsCached_();
  if (!Object.prototype.hasOwnProperty.call(all, key)) return fallback === undefined ? '' : fallback;
  var value = all[key];
  if (isBlank_(value)) return fallback === undefined ? '' : fallback;
  return String(value);
}

/** ek setting ka number */
function settingNum_(key, fallback) {
  return num_(setting_(key, fallback), fallback === undefined ? 0 : fallback);
}

/** ek setting ka boolean */
function settingBool_(key, fallback) {
  return bool_(setting_(key, ''), fallback === undefined ? false : fallback);
}

/** ek setting ki list (comma se alag values) */
function settingList_(key) {
  return listOf_(setting_(key, ''));
}

/* ─────────────────────────────── STOCK ─────────────────────────────── */

/** Stock tab — `Handle | Size | Qty | Updated` */
function ensureStockTab_() {
  var tab = ensureTab_('Stock');
  if (tab.getLastRow() < 1 || isBlank_(tab.getRange(1, 1).getValue())) {
    tab.getRange(1, 1, 1, HEADERS.Stock.length).setValues([HEADERS.Stock]);
    tab.getRange(1, 1, 1, HEADERS.Stock.length).setFontWeight('bold');
    tab.setFrozenRows(1);
  }
  return tab;
}

/** handle+size → qty ka map. `{handle: {SIZE: qty}}` */
function stockMap_() {
  var tab = book_().getSheetByName('Stock');
  var map = {};
  if (!tab || tab.getLastRow() < 2) return map;
  var head = headersOf_(tab);
  var handleCol = head.indexOf('Handle');
  var sizeCol = head.indexOf('Size');
  var qtyCol = head.indexOf('Qty');
  if (handleCol < 0 || qtyCol < 0) return map;
  var rows = tab.getRange(2, 1, tab.getLastRow() - 1, head.length).getValues();
  for (var i = 0; i < rows.length; i += 1) {
    var handle = text_(rows[i][handleCol]).toLowerCase();
    if (!handle) continue;
    var size = sizeCol >= 0 ? text_(rows[i][sizeCol]).toUpperCase() || 'ONE' : 'ONE';
    if (!map[handle]) map[handle] = {};
    map[handle][size] = (map[handle][size] || 0) + int_(rows[i][qtyCol], 0);
  }
  return map;
}

/**
 * Is handle+size par kitna stock hai?
 * `null` = Stock tab me iski row hi nahi (matlab unlimited — site "In stock" dikhati hai).
 */
function stockOf_(handle, size, map) {
  var stock = map || stockMap_();
  var entry = stock[text_(handle).toLowerCase()];
  if (!entry) return null;
  var key = text_(size).toUpperCase() || 'ONE';
  if (!Object.prototype.hasOwnProperty.call(entry, key)) {
    // size-specific row nahi — koi bhi size ho to total dekho
    var anySize = Object.keys(entry);
    if (!anySize.length) return null;
    return entry[anySize[0]];
  }
  return entry[key];
}

/** stock set (row mili to update, warna nayi) — admin/order dono isi se chalte hain */
function stockSet_(handle, size, qty) {
  var tab = ensureStockTab_();
  var head = headersOf_(tab);
  var handleCol = head.indexOf('Handle');
  var sizeCol = head.indexOf('Size');
  var qtyCol = head.indexOf('Qty');
  var updCol = head.indexOf('Updated');
  var wantedHandle = text_(handle);
  var wantedSize = text_(size).toUpperCase() || 'ONE';
  if (!wantedHandle) return 0;

  if (tab.getLastRow() > 1) {
    var rows = tab.getRange(2, 1, tab.getLastRow() - 1, head.length).getValues();
    for (var i = 0; i < rows.length; i += 1) {
      if (text_(rows[i][handleCol]).toLowerCase() !== wantedHandle.toLowerCase()) continue;
      if (text_(rows[i][sizeCol]).toUpperCase() !== wantedSize) continue;
      tab.getRange(i + 2, qtyCol + 1).setValue(int_(qty, 0));
      if (updCol >= 0) tab.getRange(i + 2, updCol + 1).setValue(nowIso_());
      return 1;
    }
  }
  var row = new Array(head.length).fill('');
  row[handleCol] = wantedHandle;
  if (sizeCol >= 0) row[sizeCol] = wantedSize;
  row[qtyCol] = int_(qty, 0);
  if (updCol >= 0) row[updCol] = nowIso_();
  tab.getRange(tab.getLastRow() + 1, 1, 1, head.length).setValues([row]);
  return 1;
}

/**
 * Stock kam karo (order placed). Unlimited stock (row nahi) par kuch nahi karta.
 * Return: `{ ok: true, left: number|null }` ya `{ ok:false, error:'out_of_stock' }`.
 */
function stockReduce_(handle, size, qty) {
  var map = stockMap_();
  var available = stockOf_(handle, size, map);
  if (available === null) return { ok: true, left: null, unlimited: true };
  var wanted = Math.max(1, int_(qty, 1));
  if (available < wanted) return { ok: false, error: 'out_of_stock', left: available };
  stockSet_(handle, size, available - wanted);
  return { ok: true, left: available - wanted };
}

/** stock wapas (order cancel/return) */
function stockRestore_(handle, size, qty) {
  var available = stockOf_(handle, size);
  if (available === null) return { ok: true, unlimited: true };
  stockSet_(handle, size, available + Math.max(1, int_(qty, 1)));
  return { ok: true };
}

/** site ke liye stock — `?action=stock` */
function stockPublic_(handle) {
  var map = stockMap_();
  var wanted = text_(handle).toLowerCase();
  if (!wanted) return map;
  return map[wanted] ? (function () { var one = {}; one[wanted] = map[wanted]; return one; })() : {};
}

/** low stock list — `low_stock_alert` setting se threshold */
function lowStockList_() {
  var threshold = settingNum_('low_stock_alert', 3);
  var rows = [];
  var map = stockMap_();
  Object.keys(map).forEach(function (handle) {
    Object.keys(map[handle]).forEach(function (size) {
      var qty = map[handle][size];
      if (qty <= threshold) rows.push({ handle: handle, size: size, qty: qty });
    });
  });
  rows.sort(function (a, b) {
    return a.qty - b.qty;
  });
  return rows;
}

/* ─────────────────────────────── COUPONS ─────────────────────────────── */

function ensureCouponsTab_() {
  var tab = ensureTab_('Coupons');
  if (tab.getLastRow() < 1 || isBlank_(tab.getRange(1, 1).getValue())) {
    tab.getRange(1, 1, 1, HEADERS.Coupons.length).setValues([HEADERS.Coupons]);
    tab.getRange(1, 1, 1, HEADERS.Coupons.length).setFontWeight('bold');
    tab.setFrozenRows(1);
  }
  return tab;
}

/** saare coupons objects me */
function couponsAll_() {
  var tab = book_().getSheetByName('Coupons');
  if (!tab || tab.getLastRow() < 2) return [];
  var head = headersOf_(tab);
  return rowsToObjects_(head, tab.getRange(2, 1, tab.getLastRow() - 1, head.length).getValues());
}

/** code se coupon (case-insensitive) */
function couponByCode_(code) {
  var wanted = text_(code).toUpperCase();
  if (!wanted) return null;
  var all = couponsAll_();
  for (var i = 0; i < all.length; i += 1) {
    if (text_(all[i].Code).toUpperCase() === wanted) return all[i];
  }
  return null;
}

/** coupon ki validity (expiry, limit, min order) — "kyun nahi chala" ka saaf reason */
function couponReason_(coupon, subtotal) {
  if (!coupon) return 'Ye coupon code nahi mila.';
  if (!bool_(coupon.Active, true)) return 'Ye coupon abhi band hai.';
  var limit = int_(coupon['Usage limit'], 0);
  var used = int_(coupon.Used, 0);
  if (limit > 0 && used >= limit) return 'Is coupon ke saare use ho gaye.';
  var till = text_(coupon['Valid till']);
  if (till) {
    var end = new Date(till);
    if (!isNaN(end.getTime()) && end.getTime() < Date.now()) return 'Ye coupon expire ho gaya.';
  }
  var minOrder = num_(coupon['Min order ₹'], 0);
  if (minOrder > 0 && num_(subtotal, 0) < minOrder) {
    return 'Ye coupon ' + money_(minOrder) + ' se upar ke order par chalta hai.';
  }
  return '';
}

/**
 * Coupon check — site `?action=coupons&code=…&total=…` se yahi call karti hai.
 * Return: `{ ok, discount, freeShipping, message, code }`
 */
function couponCheck_(code, subtotal) {
  var amount = Math.max(0, num_(subtotal, 0));
  var coupon = couponByCode_(code);
  var reason = couponReason_(coupon, amount);
  if (reason) return { ok: false, discount: 0, freeShipping: false, message: reason, code: text_(code).toUpperCase() };

  var type = text_(coupon.Type).toLowerCase();
  var value = num_(coupon.Value, 0);
  var discount = 0;
  var freeShipping = false;

  if (/percent|%/.test(type)) {
    discount = Math.round((amount * value) / 100);
    var cap = num_(coupon['Max discount ₹'], 0);
    if (cap > 0 && discount > cap) discount = cap;
  } else if (/ship/.test(type)) {
    freeShipping = true;
  } else {
    discount = Math.round(value);
  }

  if (discount > amount) discount = amount;
  if (discount < 0) discount = 0;

  return {
    ok: true,
    code: text_(coupon.Code).toUpperCase(),
    type: type,
    discount: discount,
    freeShipping: freeShipping,
    message: discount > 0 ? 'Coupon laga — ' + money_(discount) + ' bachaya' : 'Coupon laga',
  };
}

/** coupon ka use count +1 (order placed par) */
function couponRedeem_(code) {
  var tab = book_().getSheetByName('Coupons');
  if (!tab || tab.getLastRow() < 2) return 0;
  var head = headersOf_(tab);
  var codeCol = head.indexOf('Code');
  var usedCol = head.indexOf('Used');
  if (codeCol < 0 || usedCol < 0) return 0;
  var wanted = text_(code).toUpperCase();
  var rows = tab.getRange(2, 1, tab.getLastRow() - 1, head.length).getValues();
  for (var i = 0; i < rows.length; i += 1) {
    if (text_(rows[i][codeCol]).toUpperCase() !== wanted) continue;
    tab.getRange(i + 2, usedCol + 1).setValue(int_(rows[i][usedCol], 0) + 1);
    return 1;
  }
  return 0;
}

/** coupon save/update (admin) — code hi key hai */
function couponSave_(payload) {
  var code = text_(payload.code || payload.Code).toUpperCase();
  if (!code) return { ok: false, error: 'code required' };
  var tab = ensureCouponsTab_();
  var head = headersOf_(tab);
  var row = {
    Code: code,
    Type: text_(payload.type || payload.Type || 'percent').toLowerCase(),
    Value: num_(payload.value !== undefined ? payload.value : payload.Value, 0),
    'Min order ₹': num_(payload.minOrder !== undefined ? payload.minOrder : payload['Min order ₹'], 0),
    'Max discount ₹': num_(payload.maxDiscount !== undefined ? payload.maxDiscount : payload['Max discount ₹'], 0),
    'Valid till': text_(payload.validTill || payload['Valid till']),
    'Usage limit': int_(payload.usageLimit !== undefined ? payload.usageLimit : payload['Usage limit'], 0),
    Used: int_(payload.used !== undefined ? payload.used : payload.Used, 0),
    Active: bool_(payload.active !== undefined ? payload.active : payload.Active, true) ? 'yes' : 'no',
    Note: text_(payload.note || payload.Note),
  };
  var written = upsertRow_('Coupons', 'Code', row);
  return { ok: true, written: written, coupon: couponCheck_(code, 999999) };
}

/** site ko dikhne wale active coupons (code chhupa kar — sirf hint) */
function couponsPublic_() {
  var out = [];
  var all = couponsAll_();
  for (var i = 0; i < all.length; i += 1) {
    var coupon = all[i];
    if (!bool_(coupon.Active, true)) continue;
    if (couponReason_(coupon, num_(coupon['Min order ₹'], 0))) continue;
    out.push({
      code: text_(coupon.Code).toUpperCase(),
      type: text_(coupon.Type),
      value: num_(coupon.Value, 0),
      minOrder: num_(coupon['Min order ₹'], 0),
      note: text_(coupon.Note),
    });
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  BHAG 4 — NOTIFICATIONS (WhatsApp + email), INVOICE aur AUDIT LOG
 * ---------------------------------------------------------------------------
 *  Rule: **customer ko kabhi galat message na jaye.** Isliye har message ek
 *  template se banta hai, `Notifications` tab me log hota hai, aur WhatsApp
 *  sirf **link** banata hai (owner ke phone se jaata hai — koi paid API nahi).
 *
 *  Email tabhi jaata hai jab `owner_email` / customer ka email ho — MailApp
 *  quota khatam na ho, isliye har bhejne se pehle try/catch.
 * ═══════════════════════════════════════════════════════════════════════════ */

var PUBLIC_SETTINGS_CACHE_KEY = 'trends:public:v1';
var WEBAPP_PUBLIC_BASE = 'https://trendsyounique.fashion';

/**
 * Message templates — `{name}`, `{order}`, `{amount}`, `{courier}`, `{awb}`,
 * `{track}`, `{items}` replace hote hain. Owner `Settings` tab se
 * `whatsapp`/`brand_name` badal sakta hai, message khud wahi uthata hai.
 */
var MESSAGE_TEMPLATES = {
  placed: {
    subject: 'Order mila — {order}',
    message:
      'Hi {name}! Aapka order {order} mil gaya hai ({amount}). Team 24 ghante me confirm karegi.\n' +
      'Track: {track}',
  },
  confirmed: {
    subject: 'Order confirm — {order}',
    message: 'Hi {name}, order {order} confirm ho gaya. Taiyari shuru hai. Track: {track}',
  },
  packed: {
    subject: 'Packing ho gayi — {order}',
    message: 'Hi {name}, order {order} pack ho gaya hai. Jaldi courier ko diya jayega. Track: {track}',
  },
  shipped: {
    subject: 'Order ship — {order}',
    message: 'Hi {name}, order {order} ship ho gaya. Courier: {courier}, AWB: {awb}. Track: {track}',
  },
  delivered: {
    subject: 'Delivered — {order}',
    message:
      'Hi {name}, order {order} deliver ho gaya. Pasand aaya to review zaroor likhiye — ' +
      'aur koi dikkat ho to WhatsApp kar dijiye.',
  },
  cancelled: {
    subject: 'Order cancel — {order}',
    message: 'Hi {name}, order {order} cancel ho gaya hai. Koi galat hua ho to WhatsApp kar dijiye.',
  },
  returned: {
    subject: 'Return update — {order}',
    message: 'Hi {name}, order {order} ka return update: {status}. Team aapse sampark karegi.',
  },
  payment_pending: {
    subject: 'Payment baaki — {order}',
    message: 'Hi {name}, order {order} ke liye payment baaki hai ({amount}). UPI: {upi}',
  },
};

/** template ko bhare hue text me badlo — jo placeholder na mile use khaali chhod deta hai */
function renderTemplate_(name, vars) {
  var template = MESSAGE_TEMPLATES[String(name || '').toLowerCase()] || MESSAGE_TEMPLATES.placed;
  var replace = function (text) {
    return String(text || '').replace(/\{(\w+)\}/g, function (match, key) {
      var value = vars && vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : '';
      return value;
    });
  };
  return { subject: replace(template.subject), message: replace(template.message) };
}

/** wa.me link — 91 ke saath, text URL-encoded */
function whatsappLink_(phone, message) {
  var digits = phoneDigits_(phone);
  var number = digits.length === 10 ? '91' + digits : digits;
  if (!number) return '';
  return 'https://wa.me/' + number + '?text=' + encodeURIComponent(String(message || ''));
}

function ensureNotificationsTab_() {
  var tab = ensureTab_('Notifications');
  if (tab.getLastRow() < 1 || isBlank_(tab.getRange(1, 1).getValue())) {
    tab.getRange(1, 1, 1, HEADERS.Notifications.length).setValues([HEADERS.Notifications]);
    tab.getRange(1, 1, 1, HEADERS.Notifications.length).setFontWeight('bold');
    tab.setFrozenRows(1);
  }
  return tab;
}

/** har message ka record — kaam nahi hua to bhi pata rahe */
function logNotification_(channel, to, orderId, template, body, status) {
  var tab = ensureNotificationsTab_();
  var head = headersOf_(tab);
  var row = new Array(head.length).fill('');
  row[head.indexOf('Timestamp')] = nowIso_();
  row[head.indexOf('Channel')] = text_(channel);
  row[head.indexOf('To')] = text_(to);
  row[head.indexOf('Order ID')] = text_(orderId);
  row[head.indexOf('Template')] = text_(template);
  row[head.indexOf('Body')] = text_(body, 900);
  row[head.indexOf('Status')] = text_(status || 'queued');
  tab.getRange(tab.getLastRow() + 1, 1, 1, head.length).setValues([row]);
  return row;
}

/** email bhejna — kabhi crash nahi karta, result lauta deta hai */
function sendMailSafe_(to, subject, body) {
  var address = text_(to);
  if (!emailOk_(address)) return { ok: false, error: 'invalid_email' };
  try {
    MailApp.sendEmail({ to: address, subject: text_(subject, 120), body: String(body || '') });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

/**
 * Order par status badla → customer ko message + owner ko alert.
 * Return `{ ok, whatsapp, logged }` (whatsapp = click karne wala link).
 */
function notifyOrder_(order, status, extra) {
  if (!order) return { ok: false, error: 'no order' };
  var vars = {
    name: text_(order['Customer']) || 'Customer',
    order: text_(order['Order ID']),
    amount: money_(order['Total ₹']),
    courier: text_(order['Courier']) || '—',
    awb: text_(order['AWB']) || '—',
    upi: setting_('upi_id', ''),
    status: text_(status),
    track: WEBAPP_PUBLIC_BASE + '/track-order/',
  };
  if (extra) Object.keys(extra).forEach(function (key) { vars[key] = extra[key]; });
  var rendered = renderTemplate_(status, vars);
  var phone = text_(order['WhatsApp']) || text_(order['Phone']);
  var link = whatsappLink_(phone, rendered.message);

  logNotification_('whatsapp', phone, vars.order, status, rendered.message, link ? 'link_ready' : 'no_phone');

  /**
   * **Asli email** — poore order ki detail ke saath (items, amount, address,
   * courier/AWB, track link). Queue se jaati hai, isliye fail hone par 30 baar
   * tak khud retry hoti hai (`MailQueue` tab).
   */
  var emailResult = { ok: false, error: 'skipped' };
  try {
    emailResult = sendOrderEmail_(order, status, { message: rendered.message });
  } catch (error) {
    // email kabhi order/timeline ko na roke
    emailResult = { ok: false, error: String(error) };
  }

  return {
    ok: true,
    whatsapp: link,
    message: rendered.message,
    subject: rendered.subject,
    email: emailResult,
  };
}

/** owner ko chhota alert (email agar set hai) */
function ownerAlert_(subject, body) {
  var owner = setting_('owner_email', '');
  if (!emailOk_(owner)) return { ok: false, error: 'owner_email_not_set' };
  return sendMailSafe_(owner, subject, body);
}

/* ─────────────────────────────── INVOICE ─────────────────────────────── */

/** invoice number — `TY/2026/LK-1A2B3C` (prefix Settings se) */
function invoiceNumberFor_(orderId) {
  var prefix = setting_('invoice_prefix', 'TY/2026/');
  if (prefix && prefix.slice(-1) !== '/' && prefix.slice(-1) !== '-') prefix += '/';
  return prefix + text_(orderId);
}

/** invoice ke liye poora data — order + items + totals + gst */
function invoiceData_(orderId, phone) {
  var found = findOrder_(orderId, phone);
  if (!found.ok) return found;
  var order = found.order;
  var items = found.items || [];
  var total = num_(order['Total ₹'], 0);
  var gstRate = settingNum_('gst_rate', 5);
  var gst = gstRate > 0 ? Math.round((total - total / (1 + gstRate / 100))) : 0;
  return {
    ok: true,
    invoiceNumber: invoiceNumberFor_(order['Order ID']),
    date: fmtDate_(order['Date & Time'], false),
    brand: setting_('brand_name', 'TRENDS YOUNIQUE'),
    gstin: setting_('gstin', ''),
    phone: setting_('support_phone', ''),
    order: order,
    items: items,
    totals: {
      subtotal: num_(order['Subtotal ₹'], 0),
      discount: num_(order['Discount ₹'], 0),
      shipping: num_(order['Shipping ₹'], 0),
      total: total,
      gst: gst,
      gstRate: gstRate,
      qty: num_(order['Qty total'], 0),
    },
  };
}

/** printable invoice (browser me khulta hai, Ctrl+P se PDF) */
function invoiceHtml_(data) {
  if (!data || !data.ok) {
    return (
      '<!doctype html><meta charset="utf-8"><title>Invoice</title>' +
      '<p style="font:14px Arial;padding:24px">Invoice nahi mila — order number aur mobile check kariye.</p>'
    );
  }
  var order = data.order;
  var rows = (data.items || [])
    .map(function (item) {
      return (
        '<tr>' +
        '<td style="padding:8px;border-bottom:1px solid #eadfd3">' + escapeHtml_(item['Product']) +
        '<div style="color:#8a7d72;font-size:11px">' +
        escapeHtml_([item['Colour'], item['Size']].filter(Boolean).join(' · ')) + '</div></td>' +
        '<td style="padding:8px;border-bottom:1px solid #eadfd3;text-align:center">' + escapeHtml_(item['Qty']) + '</td>' +
        '<td style="padding:8px;border-bottom:1px solid #eadfd3;text-align:right">' + money_(item['Price ₹']) + '</td>' +
        '<td style="padding:8px;border-bottom:1px solid #eadfd3;text-align:right">' + money_(item['Line total ₹']) + '</td>' +
        '</tr>'
      );
    })
    .join('');
  var totals =
    '<tr><td colspan="3" style="text-align:right;padding:4px 8px">Subtotal</td><td style="text-align:right;padding:4px 8px">' +
    money_(data.totals.subtotal) + '</td></tr>' +
    (data.totals.discount
      ? '<tr><td colspan="3" style="text-align:right;padding:4px 8px">Discount' +
        (order['Coupon'] ? ' (' + escapeHtml_(order['Coupon']) + ')' : '') +
        '</td><td style="text-align:right;padding:4px 8px">-' + money_(data.totals.discount) + '</td></tr>'
      : '') +
    '<tr><td colspan="3" style="text-align:right;padding:4px 8px">Shipping</td><td style="text-align:right;padding:4px 8px">' +
    money_(data.totals.shipping) + '</td></tr>' +
    (data.totals.gst
      ? '<tr><td colspan="3" style="text-align:right;padding:4px 8px;color:#8a7d72">Inme GST ' +
        data.totals.gstRate + '%</td><td style="text-align:right;padding:4px 8px;color:#8a7d72">' +
        money_(data.totals.gst) + '</td></tr>'
      : '') +
    '<tr><td colspan="3" style="text-align:right;padding:10px 8px;font-weight:700">Total</td>' +
    '<td style="text-align:right;padding:10px 8px;font-weight:700">' + money_(data.totals.total) + '</td></tr>';

  return (
    '<!doctype html><html><head><meta charset="utf-8"><title>Invoice ' + escapeHtml_(data.invoiceNumber) + '</title>' +
    '<style>body{font:13px/1.5 Arial,Helvetica,sans-serif;color:#2b2622;margin:0;padding:28px}' +
    'h1{font-size:20px;margin:0 0 4px}h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8a7d72;margin:22px 0 6px}' +
    'table{width:100%;border-collapse:collapse}.muted{color:#8a7d72}</style></head><body>' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px">' +
    '<div><h1>' + escapeHtml_(data.brand) + '</h1>' +
    '<div class="muted">WhatsApp ' + escapeHtml_(data.phone) + (data.gstin ? ' · GSTIN ' + escapeHtml_(data.gstin) : '') + '</div></div>' +
    '<div style="text-align:right"><div style="font-weight:700">INVOICE</div>' +
    '<div class="muted">' + escapeHtml_(data.invoiceNumber) + '</div>' +
    '<div class="muted">' + escapeHtml_(data.date) + '</div></div></div>' +
    '<h2>Bill to</h2><div>' + escapeHtml_(order['Customer']) +
    '<div class="muted">' + escapeHtml_(order['Address']) + ', ' + escapeHtml_(order['City']) + ' ' +
    escapeHtml_(order['State']) + ' — ' + escapeHtml_(order['PIN']) + '</div>' +
    '<div class="muted">Phone ' + escapeHtml_(order['Phone']) + '</div></div>' +
    '<h2>Items</h2><table><tr style="text-align:left;color:#8a7d72;font-size:11px">' +
    '<th style="padding:0 8px">Product</th><th style="padding:0 8px;text-align:center">Qty</th>' +
    '<th style="padding:0 8px;text-align:right">Price</th><th style="padding:0 8px;text-align:right">Total</th></tr>' +
    rows + totals + '</table>' +
    '<p class="muted" style="margin-top:22px;font-size:11px">Order ' + escapeHtml_(order['Order ID']) +
    ' · Payment: ' + escapeHtml_(order['Payment method'] || '—') + ' (' + escapeHtml_(order['Payment status'] || '—') + ')' +
    ' · Thank you for shopping with ' + escapeHtml_(data.brand) + '.</p>' +
    '</body></html>'
  );
}

/* ─────────────────────────────── AUDIT ─────────────────────────────── */

function ensureAuditTab_() {
  var tab = ensureTab_('AuditLog');
  if (tab.getLastRow() < 1 || isBlank_(tab.getRange(1, 1).getValue())) {
    tab.getRange(1, 1, 1, HEADERS.AuditLog.length).setValues([HEADERS.AuditLog]);
    tab.getRange(1, 1, 1, HEADERS.AuditLog.length).setFontWeight('bold');
    tab.setFrozenRows(1);
    tab.setColumnWidth(7, 320);
  }
  return tab;
}

/** "kisne kya badla" — status change, coupon edit, stock set, settings save */
function audit_(action, sheetName, key, before, after) {
  try {
    var tab = ensureAuditTab_();
    var head = headersOf_(tab);
    var row = new Array(head.length).fill('');
    row[head.indexOf('Timestamp')] = nowIso_();
    row[head.indexOf('Actor')] = 'owner/admin';
    row[head.indexOf('Action')] = text_(action);
    row[head.indexOf('Sheet')] = text_(sheetName);
    row[head.indexOf('Key')] = text_(key);
    row[head.indexOf('Before')] = text_(typeof before === 'object' ? JSON.stringify(before) : before, 400);
    row[head.indexOf('After')] = text_(typeof after === 'object' ? JSON.stringify(after) : after, 400);
    tab.getRange(tab.getLastRow() + 1, 1, 1, head.length).setValues([row]);
    return true;
  } catch (error) {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  BHAG 5 — ORDER LIFECYCLE (place → status → timeline → return)
 * ---------------------------------------------------------------------------
 *  Yahan poora e-commerce order chalta hai:
 *    1. `validateDelivery_()` — state/PIN check (blocked states, blocked PINs)
 *    2. `orderTotals_()`      — subtotal, coupon discount, shipping, total
 *    3. `placeOrder_()`       — Orders + Order Items + Payments rows, stock kam,
 *                               coupon count +1, customer ko message
 *    4. `findOrder_()`        — order number + mobile se order (tracking/invoice)
 *    5. `adminSetOrderStatus_()` — status badla + timeline row + customer message
 *    6. `orderTimeline_()`    — 5 step + admin ke 2-3 comment har step par
 *    7. `createReturn_()`     — return/exchange request (Returns tab)
 * ═══════════════════════════════════════════════════════════════════════════ */

/** delivery allowed? blocked states/PIN + PIN ka basic format */
function validateDelivery_(state, pin, pincode) {
  var wantedPin = text_(pin || pincode);
  if (!wantedPin) return { ok: false, error: 'pin_required', message: 'PIN code daaliye.' };
  if (!pinOk_(wantedPin)) {
    return { ok: false, error: 'pin_invalid', message: 'PIN code 6 digit ka hona chahiye (jaise 302001).' };
  }
  var blockedPins = settingList_('blocked_pincodes');
  for (var i = 0; i < blockedPins.length; i += 1) {
    if (text_(blockedPins[i]) === wantedPin) {
      return {
        ok: false,
        error: 'blocked_pincode',
        blocked: true,
        message: 'Is PIN code (' + wantedPin + ') par filhaal delivery nahi ho sakti. WhatsApp par baat kar lein.',
      };
    }
  }
  var blockedStates = settingList_('blocked_states');
  var wantedState = text_(state).toLowerCase();
  for (var s = 0; s < blockedStates.length; s += 1) {
    var blocked = text_(blockedStates[s]).toLowerCase();
    if (blocked && wantedState && (wantedState === blocked || wantedState.indexOf(blocked) >= 0)) {
      return {
        ok: false,
        error: 'blocked_state',
        blocked: true,
        message: 'Is state (' + text_(state) + ') me filhaal delivery band hai.',
      };
    }
  }
  return { ok: true, region: regionOfPin_(wantedPin) };
}

/**
 * Order ka hisaab — **pure function** (sheet nahi padhta), isliye test karna aasan.
 *
 * @param {Array} items  `[{price, qty}]`
 * @param {Object} options `{shipping, freeShipping, coupon:{discount, freeShipping}}`
 */
function orderTotals_(items, options) {
  var opts = options || {};
  var list = items || [];
  var subtotal = 0;
  var qty = 0;
  for (var i = 0; i < list.length; i += 1) {
    var price = Math.max(0, num_(list[i].price !== undefined ? list[i].price : list[i]['Price ₹'], 0));
    var count = Math.max(1, int_(list[i].qty !== undefined ? list[i].qty : list[i]['Qty'], 1));
    subtotal += price * count;
    qty += count;
  }
  var discount = 0;
  var couponFreeShipping = false;
  if (opts.coupon) {
    discount = Math.max(0, num_(opts.coupon.discount, 0));
    couponFreeShipping = Boolean(opts.coupon.freeShipping);
    if (discount > subtotal) discount = subtotal;
  }
  var freeShipping =
    Boolean(opts.freeShipping) ||
    couponFreeShipping ||
    settingBool_('free_shipping', true) ||
    (settingNum_('free_shipping_above', 0) > 0 && subtotal >= settingNum_('free_shipping_above', 0));
  var shipping = freeShipping ? 0 : Math.max(0, num_(opts.shipping !== undefined ? opts.shipping : settingNum_('shipping_fee', 0), 0));
  var total = subtotal - discount + shipping;
  return {
    subtotal: subtotal,
    discount: discount,
    shipping: shipping,
    total: Math.max(0, total),
    qty: qty,
    freeShipping: freeShipping,
  };
}

/** naya order number — sheet me jo pehle se hai wo kabhi nahi (LK-XXXXXX) */
function orderNumber_(prefix) {
  var wantedPrefix = text_(prefix) || setting_('order_prefix', 'LK');
  var tab = book_().getSheetByName('Orders');
  var existing = {};
  if (tab && tab.getLastRow() > 1) {
    var head = headersOf_(tab);
    var idCol = head.indexOf('Order ID');
    if (idCol >= 0) {
      var ids = tab.getRange(2, idCol + 1, tab.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < ids.length; i += 1) existing[text_(ids[i][0]).toUpperCase()] = true;
    }
  }
  for (var attempt = 0; attempt < 20; attempt += 1) {
    var candidate = randId_(wantedPrefix, 6);
    if (!existing[candidate.toUpperCase()]) return candidate;
  }
  return randId_(wantedPrefix, 8);
}

/** order + uske items dhoondo (mobile optional — tracking me dono chahiye) */
function findOrder_(orderId, phone) {
  var wanted = text_(orderId).toUpperCase();
  if (!wanted) return { ok: false, error: 'order number daaliye' };
  var ordersTab = book_().getSheetByName('Orders');
  if (!ordersTab || ordersTab.getLastRow() < 2) return { ok: false, error: 'abhi koi order nahi hai' };
  var head = headersOf_(ordersTab);
  var rows = ordersTab.getRange(2, 1, ordersTab.getLastRow() - 1, head.length).getValues();
  var order = null;
  for (var i = rows.length - 1; i >= 0; i -= 1) {
    var object = {};
    for (var h = 0; h < head.length; h += 1) object[head[h]] = rows[i][h];
    // ek order ki kai rows ho sakti hain (event rows) — sabse nayi "order" row pakdo
    if (text_(object['Order ID']).toUpperCase() !== wanted) continue;
    if (!order) order = object;
    if (text_(object.Event).toLowerCase() === 'order' || !text_(order.Event)) order = object;
    if (phone) {
      var rowPhone = phoneDigits_(object['Phone']);
      if (rowPhone && rowPhone !== phoneDigits_(phone)) continue;
      order = object;
      break;
    }
  }
  if (!order) return { ok: false, error: 'is number ka koi order nahi mila' };
  if (phone) {
    var savedPhone = phoneDigits_(order['Phone']) || phoneDigits_(order['WhatsApp']);
    if (savedPhone && savedPhone !== phoneDigits_(phone)) {
      return { ok: false, error: 'is order number par ye mobile number registered nahi hai' };
    }
  }

  var items = [];
  var itemsTab = book_().getSheetByName('Order Items');
  if (itemsTab && itemsTab.getLastRow() > 1) {
    var itemHead = headersOf_(itemsTab);
    var itemRows = itemsTab.getRange(2, 1, itemsTab.getLastRow() - 1, itemHead.length).getValues();
    for (var r = 0; r < itemRows.length; r += 1) {
      var item = {};
      for (var ih = 0; ih < itemHead.length; ih += 1) item[itemHead[ih]] = itemRows[r][ih];
      if (text_(item['Order ID']).toUpperCase() !== wanted) continue;
      items.push({
        product: text_(item['Product']),
        handle: text_(item['Handle']),
        colour: text_(item['Colour']),
        size: text_(item['Size']),
        qty: int_(item['Qty'], 1),
        price: num_(item['Price ₹'], 0),
        image: text_(item['Image']),
        link: text_(item['Product link']),
        status: text_(item['Order status']),
      });
    }
  }
  return { ok: true, order: order, items: items };
}

/** product ki asli keemat ProductList se (customer ka bheja price trust nahi karte) */
function productPrice_(handle) {
  var tab = book_().getSheetByName('ProductList');
  if (!tab || tab.getLastRow() < 2) return null;
  var head = headersOf_(tab);
  var handleCol = head.indexOf('Handle');
  var priceCol = head.indexOf('Price');
  var titleCol = head.indexOf('Title');
  var imageCol = head.indexOf('Main Image');
  if (handleCol < 0 || priceCol < 0) return null;
  var wanted = text_(handle).toLowerCase();
  var rows = tab.getRange(2, 1, tab.getLastRow() - 1, head.length).getValues();
  for (var i = 0; i < rows.length; i += 1) {
    if (text_(rows[i][handleCol]).toLowerCase() !== wanted) continue;
    return {
      handle: text_(rows[i][handleCol]),
      title: titleCol >= 0 ? text_(rows[i][titleCol]) : '',
      price: num_(rows[i][priceCol], 0),
      image: imageCol >= 0 ? text_(rows[i][imageCol]) : '',
    };
  }
  return null;
}

/**
 * Poora order place — **ek hi jagah se**, isliye sheet me kabhi adhoora order nahi.
 *
 * payload:
 * ```js
 * {
 *   customer: { name, phone, whatsapp, email, address, city, state, pin },
 *   items: [{ handle, product, colour, size, qty, price, image, link }],
 *   coupon: 'TRENDS10', paymentMethod: 'upi'|'cod', notes, source: 'website'
 * }
 * ```
 */
function placeOrder_(payload) {
  var data = payload || {};
  var customer = data.customer || {};
  var rawItems = data.items || [];
  if (!rawItems.length) return { ok: false, error: 'cart_empty', message: 'Cart khaali hai.' };

  var name = text_(customer.name, 60);
  if (name.length < 2) return { ok: false, error: 'name_required', message: 'Naam daaliye.' };
  var phone = phoneDigits_(customer.phone);
  if (!phoneOk_(phone)) return { ok: false, error: 'phone_invalid', message: '10 digit mobile number daaliye.' };
  var address = text_(customer.address, 240);
  if (address.length < 10) return { ok: false, error: 'address_required', message: 'Poora address daaliye.' };
  var city = text_(customer.city, 60);
  if (!city) return { ok: false, error: 'city_required', message: 'City daaliye.' };
  var delivery = validateDelivery_(customer.state, customer.pin);
  if (!delivery.ok) return delivery;

  var paymentMethod = /cod|cash/i.test(text_(data.paymentMethod)) ? 'cod' : 'upi';
  if (paymentMethod === 'cod' && !settingBool_('cod_enabled', true)) {
    return { ok: false, error: 'cod_disabled', message: 'Cash on delivery filhaal band hai — UPI se order kariye.' };
  }

  // items: price/naam sheet se, qty limits settings se
  var maxPerItem = settingNum_('max_qty_per_item', 10);
  var maxPerOrder = settingNum_('max_qty_per_order', 15);
  var items = [];
  var totalQty = 0;
  for (var i = 0; i < rawItems.length; i += 1) {
    var raw = rawItems[i] || {};
    var handle = text_(raw.handle);
    if (!handle) continue;
    var known = productPrice_(handle);
    var qty = Math.max(1, int_(raw.qty, 1));
    if (qty > maxPerItem) qty = maxPerItem;
    totalQty += qty;
    items.push({
      handle: handle,
      product: text_(raw.product) || (known ? known.title : handle),
      colour: text_(raw.colour, 40),
      size: text_(raw.size, 20).toUpperCase(),
      qty: qty,
      price: known && known.price > 0 ? known.price : num_(raw.price, 0),
      image: text_(raw.image) || (known ? known.image : ''),
      link: text_(raw.link) || WEBAPP_PUBLIC_BASE + '/products/' + handle + '/',
    });
  }
  if (!items.length) return { ok: false, error: 'items_invalid', message: 'Cart ke items theek nahi hain.' };
  if (totalQty > maxPerOrder) {
    return { ok: false, error: 'qty_over_order_limit', message: 'Ek order me max ' + maxPerOrder + ' pieces.' };
  }

  var coupon = null;
  var couponCode = text_(data.coupon).toUpperCase();
  if (couponCode) {
    var check = couponCheck_(couponCode, orderTotals_(items, {}).subtotal);
    if (!check.ok) return { ok: false, error: 'coupon_invalid', message: check.message };
    coupon = check;
  }

  var totals = orderTotals_(items, { coupon: coupon, shipping: settingNum_('shipping_fee', 0) });
  var minOrder = settingNum_('min_order_value', 0);
  if (minOrder > 0 && totals.total < minOrder) {
    return {
      ok: false,
      error: 'below_min_order',
      message: 'Minimum order ' + money_(minOrder) + ' hai.',
    };
  }

  // stock check pehle — koi item out of stock ho to poora order ruk jaye
  for (var st = 0; st < items.length; st += 1) {
    var available = stockOf_(items[st].handle, items[st].size);
    if (available !== null && available < items[st].qty) {
      return {
        ok: false,
        error: 'out_of_stock',
        message: items[st].product + (items[st].size ? ' (' + items[st].size + ')' : '') + ' ka stock khatam hai.',
      };
    }
  }

  var orderId = orderNumber_();
  var stamp = nowIso_();
  var orderRow = {
    'Order ID': orderId,
    'Date & Time': stamp,
    Event: 'order',
    Status: 'placed',
    Customer: name,
    Phone: phone,
    WhatsApp: phoneDigits_(customer.whatsapp) || phone,
    Email: emailOk_(customer.email) ? text_(customer.email) : '',
    Address: address,
    City: city,
    State: text_(customer.state, 40),
    PIN: text_(customer.pin),
    Items: items
      .map(function (item) {
        return item.product + (item.size ? ' (' + item.size + ')' : '') + ' x' + item.qty;
      })
      .join(' | '),
    'Qty total': totals.qty,
    'Subtotal ₹': totals.subtotal,
    'Discount ₹': totals.discount,
    Coupon: coupon ? coupon.code : '',
    'Shipping ₹': totals.shipping,
    'Total ₹': totals.total,
    'Payment method': paymentMethod === 'cod' ? 'cash_on_delivery' : 'upi',
    'Payment status': 'pending',
    'Payment ref': '',
    Courier: '',
    AWB: '',
    'Tracking URL': '',
    Notes: text_(data.notes, 240),
    Source: text_(data.source) || 'website',
  };

  var payloadRows = [{ sheet: 'Orders', row: orderRow }];
  items.forEach(function (item) {
    payloadRows.push({
      sheet: 'Order Items',
      row: {
        'Order ID': orderId,
        'Date & Time': stamp,
        Product: item.product,
        Handle: item.handle,
        Colour: item.colour,
        Size: item.size,
        Qty: item.qty,
        'Price ₹': item.price,
        'Line total ₹': item.price * item.qty,
        'Product link': item.link,
        Image: item.image,
        'Order status': 'placed',
      },
    });
  });
  payloadRows.push({
    sheet: 'Payments',
    row: {
      Timestamp: stamp,
      Event: 'order_created',
      'Order ID': orderId,
      Status: 'created',
      Customer: name,
      Phone: phone,
      'Total ₹': totals.total,
      'Payment status': 'pending',
      'Payment ref': '',
      'UPI ID': setting_('upi_id', ''),
      Method: paymentMethod === 'cod' ? 'cod' : 'upi',
      Notes: 'customer ne order place kiya',
    },
  });

  var written = appendRows_(payloadRows);
  if (!written) return { ok: false, error: 'sheet_write_failed', message: 'Order save nahi hua — dobara try karein.' };

  // stock kam + coupon count
  items.forEach(function (item) {
    stockReduce_(item.handle, item.size, item.qty);
  });
  if (coupon && coupon.code) couponRedeem_(coupon.code);

  var notify = notifyOrder_(orderRow, 'placed', { amount: money_(totals.total) });
  audit_('order_placed', 'Orders', orderId, '', { total: totals.total, items: items.length });

  return {
    ok: true,
    orderNumber: orderId,
    totals: totals,
    items: items,
    paymentMethod: orderRow['Payment method'],
    whatsapp: notify.whatsapp || '',
    message: notify.message || '',
    trackUrl: WEBAPP_PUBLIC_BASE + '/track-order/',
  };
}

/** order ka status badlo + timeline row + customer message (admin) */
function adminSetOrderStatus_(orderId, status, message, visible, extra) {
  var wanted = text_(orderId).toUpperCase();
  var newStatus = text_(status).toLowerCase();
  if (!wanted) return { ok: false, error: 'order required' };
  if (!newStatus) return { ok: false, error: 'status required' };

  var ordersTab = book_().getSheetByName('Orders');
  if (!ordersTab || ordersTab.getLastRow() < 2) return { ok: false, error: 'no orders' };
  var head = headersOf_(ordersTab);
  var statusCol = head.indexOf('Status');
  if (statusCol < 0) return { ok: false, error: 'no status column' };
  var rows = ordersTab.getRange(2, 1, ordersTab.getLastRow() - 1, head.length).getValues();
  var rowIndex = -1;
  var before = '';
  for (var i = rows.length - 1; i >= 0; i -= 1) {
    if (text_(rows[i][head.indexOf('Order ID')]).toUpperCase() !== wanted) continue;
    rowIndex = i + 2;
    before = text_(rows[i][statusCol]);
    break;
  }
  if (rowIndex < 0) return { ok: false, error: 'order not found' };

  ordersTab.getRange(rowIndex, statusCol + 1).setValue(newStatus);
  if (extra && extra.courier) {
    var courierCol = head.indexOf('Courier');
    if (courierCol >= 0) ordersTab.getRange(rowIndex, courierCol + 1).setValue(text_(extra.courier));
  }
  var awbValue = extra ? text_(extra.awb || extra.AWB) : '';
  if (awbValue) {
    var awbCol = head.indexOf('AWB');
    if (awbCol >= 0) ordersTab.getRange(rowIndex, awbCol + 1).setValue(awbValue);
  }
  if (extra && extra.trackingUrl) {
    var trackCol = head.indexOf('Tracking URL');
    if (trackCol >= 0) ordersTab.getRange(rowIndex, trackCol + 1).setValue(text_(extra.trackingUrl));
  }

  // Order Items ka `Order status` bhi update — track page items ke saath sahi dikhe
  var itemsTab = book_().getSheetByName('Order Items');
  if (itemsTab && itemsTab.getLastRow() > 1) {
    var itemHead = headersOf_(itemsTab);
    var itemStatusCol = itemHead.indexOf('Order status');
    var itemIdCol = itemHead.indexOf('Order ID');
    if (itemStatusCol >= 0 && itemIdCol >= 0) {
      var itemRows = itemsTab.getRange(2, 1, itemsTab.getLastRow() - 1, itemHead.length).getValues();
      for (var r = 0; r < itemRows.length; r += 1) {
        if (text_(itemRows[r][itemIdCol]).toUpperCase() !== wanted) continue;
        itemsTab.getRange(r + 2, itemStatusCol + 1).setValue(newStatus);
      }
    }
  }

  // timeline row (message khaali ho to template se)
  var orderObject = {};
  for (var h = 0; h < head.length; h += 1) orderObject[head[h]] = rows[rowIndex - 2][h];
  // just likhi hui values row me hain, purani `rows` copy me nahi — email me naya status/courier jaye
  orderObject.Status = newStatus;
  if (extra && extra.courier) orderObject.Courier = text_(extra.courier);
  if (awbValue) orderObject.AWB = awbValue;
  if (extra && extra.trackingUrl) orderObject['Tracking URL'] = text_(extra.trackingUrl);
  var rendered = renderTemplate_(newStatus, {
    name: text_(orderObject.Customer) || 'Customer',
    order: wanted,
    amount: money_(orderObject['Total ₹']),
    courier: text_(orderObject.Courier) || '—',
    awb: text_(orderObject.AWB) || '—',
    upi: setting_('upi_id', ''),
    track: WEBAPP_PUBLIC_BASE + '/track-order/',
  });

  var updatesTab = ensureTab_('Order Updates');
  var upHead = headersOf_(updatesTab);
  var updateRow = new Array(upHead.length).fill('');
  updateRow[upHead.indexOf('Order ID')] = wanted;
  updateRow[upHead.indexOf('Date & Time')] = nowIso_();
  updateRow[upHead.indexOf('Status')] = newStatus;
  updateRow[upHead.indexOf('Message')] = text_(message) || rendered.message;
  updateRow[upHead.indexOf('Visible')] = visible === undefined ? 'yes' : visible ? 'yes' : 'no';
  updatesTab.getRange(updatesTab.getLastRow() + 1, 1, 1, upHead.length).setValues([updateRow]);

  // stock wapas agar cancel
  if (/cancel|return|refund/.test(newStatus)) {
    var itemsFound = findOrder_(wanted);
    (itemsFound.items || []).forEach(function (item) {
      stockRestore_(item.handle, item.size, item.qty);
    });
  }

  var notify = notifyOrder_(orderObject, newStatus, { amount: money_(orderObject['Total ₹']) });
  audit_('order_status', 'Orders', wanted, before, newStatus);
  return { ok: true, order: wanted, status: newStatus, previous: before, whatsapp: notify.whatsapp || '' };
}

/** 5 step + admin ke comment (per step 2-3) — track page isi ko dikhata hai */
function orderTimeline_(orderId, phone) {
  var found = findOrder_(orderId, phone);
  if (!found.ok) return found;
  var order = found.order;
  var steps = ['placed', 'confirmed', 'packed', 'shipped', 'delivered'];

  var updates = [];
  var updatesTab = book_().getSheetByName('Order Updates');
  if (updatesTab && updatesTab.getLastRow() > 1) {
    var head = headersOf_(updatesTab);
    var rows = updatesTab.getRange(2, 1, updatesTab.getLastRow() - 1, head.length).getValues();
    for (var i = 0; i < rows.length; i += 1) {
      var object = rowsToObjects_(head, [rows[i]])[0];
      if (text_(object['Order ID']).toUpperCase() !== text_(orderId).toUpperCase()) continue;
      var visible = text_(object.Visible);
      if (visible && !bool_(visible, true)) continue;
      updates.push({
        at: isBlank_(object['Date & Time']) ? '' : String(object['Date & Time']),
        status: text_(object.Status),
        message: text_(object.Message, 600),
      });
    }
    updates.sort(function (a, b) {
      return String(a.at).localeCompare(String(b.at));
    });
  }

  var currentStatus = text_(order.Status).toLowerCase() || 'placed';
  var currentStep = -1;
  if (/cancel|return|refund|rto/.test(currentStatus)) currentStep = -1;
  else if (/deliver|complete|handover/.test(currentStatus) && !/out for deliver/.test(currentStatus)) currentStep = 4;
  else if (/ship|dispatch|transit|courier|awb|out for deliver/.test(currentStatus)) currentStep = 3;
  else if (/pack|ready|label/.test(currentStatus)) currentStep = 2;
  else if (/confirm|process|accept|prepar/.test(currentStatus)) currentStep = 1;
  else currentStep = 0;

  return {
    ok: true,
    order: {
      orderNumber: text_(order['Order ID']),
      placedAt: isBlank_(order['Date & Time']) ? '' : String(order['Date & Time']),
      status: currentStatus,
      step: currentStep,
      paymentMethod: text_(order['Payment method']),
      paymentStatus: text_(order['Payment status']),
      total: num_(order['Total ₹'], 0),
      qty: num_(order['Qty total'], 0),
      city: text_(order.City),
      state: text_(order.State),
      courier: text_(order.Courier),
      awb: text_(order.AWB),
      trackingUrl: text_(order['Tracking URL']),
      note: text_(order.Notes, 400),
    },
    steps: steps,
    items: found.items,
    updates: updates,
  };
}

/* ─────────────────────────────── RETURNS ─────────────────────────────── */

function ensureReturnsTab_() {
  var tab = ensureTab_('Returns');
  if (tab.getLastRow() < 1 || isBlank_(tab.getRange(1, 1).getValue())) {
    tab.getRange(1, 1, 1, HEADERS.Returns.length).setValues([HEADERS.Returns]);
    tab.getRange(1, 1, 1, HEADERS.Returns.length).setFontWeight('bold');
    tab.setFrozenRows(1);
  }
  return tab;
}

/** return / exchange request — window (return_window_days) ke andar hi */
function createReturn_(payload) {
  var data = payload || {};
  var orderId = text_(data.order || data['Order ID']).toUpperCase();
  var reason = text_(data.reason, 240);
  if (!orderId) return { ok: false, error: 'order required', message: 'Order number daaliye.' };
  if (reason.length < 4) return { ok: false, error: 'reason_required', message: 'Reason likhiye (jaise: size chhota hai).' };

  var found = findOrder_(orderId, data.phone);
  if (!found.ok) return { ok: false, error: found.error, message: 'Order nahi mila — number/mobile check kariye.' };

  var status = text_(found.order.Status).toLowerCase();
  if (!/deliver/.test(status)) {
    return { ok: false, error: 'not_delivered', message: 'Return sirf delivered order par ho sakta hai.' };
  }
  var windowDays = settingNum_('return_window_days', 7);
  var placed = new Date(found.order['Date & Time']);
  if (windowDays > 0 && !isNaN(placed.getTime())) {
    var allowedTill = placed.getTime() + windowDays * 24 * 60 * 60 * 1000;
    if (Date.now() > allowedTill) {
      return {
        ok: false,
        error: 'window_over',
        message: 'Return ki window (' + windowDays + ' din) nikal gayi — WhatsApp par baat kar lein.',
      };
    }
  }

  var tab = ensureReturnsTab_();
  var head = headersOf_(tab);
  var returnId = randId_('TY-RET', 5);
  var row = new Array(head.length).fill('');
  row[head.indexOf('Return ID')] = returnId;
  row[head.indexOf('Order ID')] = orderId;
  row[head.indexOf('Date & Time')] = nowIso_();
  row[head.indexOf('Reason')] = reason;
  row[head.indexOf('Status')] = 'requested';
  row[head.indexOf('Refund ₹')] = num_(data.refund, 0);
  row[head.indexOf('Note')] = text_(data.note, 240);
  row[head.indexOf('Pickup')] = text_(data.pickup, 120);
  tab.getRange(tab.getLastRow() + 1, 1, 1, head.length).setValues([row]);
  audit_('return_requested', 'Returns', returnId, '', { order: orderId, reason: reason });

  return {
    ok: true,
    returnId: returnId,
    message: 'Return request mil gayi (' + returnId + '). Team 24 ghante me sampark karegi.',
  };
}

/** returns ki list (admin) */
function returnsList_(limit) {
  var tab = book_().getSheetByName('Returns');
  if (!tab || tab.getLastRow() < 2) return [];
  var head = headersOf_(tab);
  var rows = rowsToObjects_(head, tab.getRange(2, 1, tab.getLastRow() - 1, head.length).getValues());
  rows.reverse();
  return rows.slice(0, Math.max(1, int_(limit, 50)));
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  BHAG 6 — REPORTS (owner ke numbers) + CONTENT (banner, FAQ, category)
 * ---------------------------------------------------------------------------
 *  Sheet ka asli fayda: owner ko **poore business ke numbers** ek jagah milen.
 *  `?action=reports&type=…` (master token) ya menu se — sab yahin se banta hai.
 * ═══════════════════════════════════════════════════════════════════════════ */

function ordersList_() {
  var tab = book_().getSheetByName('Orders');
  if (!tab || tab.getLastRow() < 2) return [];
  var head = headersOf_(tab);
  return rowsToObjects_(head, tab.getRange(2, 1, tab.getLastRow() - 1, head.length).getValues());
}

function returnsCount_() {
  var tab = book_().getSheetByName('Returns');
  if (!tab || tab.getLastRow() < 2) return 0;
  return tab.getLastRow() - 1;
}

/** ek nazar me poora business — kitne order, kitni sale, average order value */
function reportSummary_() {
  var orders = ordersList_();
  var valid = orders.filter(function (order) {
    var status = text_(order.Status).toLowerCase();
    return text_(order.Event).toLowerCase() === 'order' || (!text_(order.Event) && !/cancel|test|return/.test(status));
  });
  var revenue = 0;
  var cancelled = 0;
  var pendingStatus = {};
  for (var i = 0; i < valid.length; i += 1) {
    var status = text_(valid[i].Status).toLowerCase() || 'placed';
    pendingStatus[status] = (pendingStatus[status] || 0) + 1;
    if (/cancel/.test(status)) cancelled += 1;
    else revenue += num_(valid[i]['Total ₹'], 0);
  }
  var delivered = valid.filter(function (order) {
    return /deliver/.test(text_(order.Status).toLowerCase());
  });
  return {
    ok: true,
    orders: valid.length,
    delivered: delivered.length,
    cancelled: cancelled,
    revenue: revenue,
    averageOrderValue: valid.length ? Math.round(revenue / valid.length) : 0,
    byStatus: pendingStatus,
    returns: returnsCount_(),
    lowStock: lowStockList_().length,
    reviewsPending: pendingReviewsCount_(),
    couponsActive: couponsAll_().filter(function (coupon) {
      return bool_(coupon.Active, true);
    }).length,
    time: nowIso_(),
  };
}

/** kitne reviews approval ke intezaar me hain */
function pendingReviewsCount_() {
  var tab = book_().getSheetByName('Reviews');
  if (!tab || tab.getLastRow() < 2) return 0;
  var head = headersOf_(tab);
  var statusCol = head.indexOf('Status');
  if (statusCol < 0) return 0;
  var rows = tab.getRange(2, statusCol + 1, tab.getLastRow() - 1, 1).getValues();
  var pending = 0;
  for (var i = 0; i < rows.length; i += 1) {
    var value = text_(rows[i][0]).toLowerCase();
    if (!value || /pending|hold|wait/.test(value)) pending += 1;
  }
  return pending;
}

/** din-wise sale — pichhle n din */
function reportDaily_(days) {
  var span = Math.max(1, int_(days, 7));
  var from = new Date(daysAgoIso_(span - 1));
  from.setHours(0, 0, 0, 0);
  var buckets = {};
  var orders = ordersList_();
  var labels = [];
  for (var d = 0; d < span; d += 1) {
    var date = new Date(from.getTime());
    date.setDate(date.getDate() + d);
    var key = fmtDate_(date, false);
    labels.push(key);
    buckets[key] = { date: key, orders: 0, revenue: 0 };
  }
  for (var i = 0; i < orders.length; i += 1) {
    var order = orders[i];
    if (text_(order.Event).toLowerCase() && text_(order.Event).toLowerCase() !== 'order') continue;
    var when = new Date(order['Date & Time']);
    if (isNaN(when.getTime()) || when.getTime() < from.getTime()) continue;
    var key2 = fmtDate_(when, false);
    if (!buckets[key2]) continue;
    buckets[key2].orders += 1;
    buckets[key2].revenue += num_(order['Total ₹'], 0);
  }
  return { ok: true, days: labels.map(function (key) { return buckets[key]; }) };
}

/** sabse zyada bikne wale products */
function reportTopProducts_(limit) {
  var tab = book_().getSheetByName('Order Items');
  var out = [];
  if (!tab || tab.getLastRow() < 2) return out;
  var head = headersOf_(tab);
  var rows = rowsToObjects_(head, tab.getRange(2, 1, tab.getLastRow() - 1, head.length).getValues());
  var map = {};
  for (var i = 0; i < rows.length; i += 1) {
    var handle = text_(rows[i].Handle) || text_(rows[i].Product);
    if (!handle) continue;
    if (!map[handle]) {
      map[handle] = { handle: handle, product: text_(rows[i].Product), qty: 0, revenue: 0 };
    }
    map[handle].qty += int_(rows[i].Qty, 0);
    map[handle].revenue += num_(rows[i]['Line total ₹'], 0);
  }
  out = Object.keys(map).map(function (key) { return map[key]; });
  out.sort(function (a, b) { return b.qty - a.qty; });
  return out.slice(0, Math.max(1, int_(limit, 10)));
}

/** sabse ache customers (repeat buyers) */
function reportTopCustomers_(limit) {
  var orders = ordersList_();
  var map = {};
  for (var i = 0; i < orders.length; i += 1) {
    if (text_(orders[i].Event).toLowerCase() && text_(orders[i].Event).toLowerCase() !== 'order') continue;
    var phone = phoneDigits_(orders[i].Phone);
    if (!phone) continue;
    if (!map[phone]) map[phone] = { phone: phone, name: text_(orders[i].Customer), orders: 0, revenue: 0 };
    map[phone].orders += 1;
    map[phone].revenue += num_(orders[i]['Total ₹'], 0);
  }
  var out = Object.keys(map).map(function (key) { return map[key]; });
  out.sort(function (a, b) { return b.revenue - a.revenue; });
  return out.slice(0, Math.max(1, int_(limit, 10)));
}

/** `?action=reports&type=summary|daily|products|customers|stock` */
function reportsFor_(type, days, limit) {
  switch (text_(type).toLowerCase()) {
    case 'daily':
      return reportDaily_(days);
    case 'products':
      return { ok: true, products: reportTopProducts_(limit) };
    case 'customers':
      return { ok: true, customers: reportTopCustomers_(limit) };
    case 'stock':
      return { ok: true, lowStock: lowStockList_(), threshold: settingNum_('low_stock_alert', 3) };
    case 'summary':
    default:
      return reportSummary_();
  }
}

/* ─────────────────────── CONTENT: banner / FAQ / category ─────────────────────── */

function ensureContentTab_(name) {
  var tab = ensureTab_(name);
  if (tab.getLastRow() < 1 || isBlank_(tab.getRange(1, 1).getValue())) {
    tab.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
    tab.getRange(1, 1, 1, HEADERS[name].length).setFontWeight('bold');
    tab.setFrozenRows(1);
  }
  return tab;
}

function contentRows_(name) {
  var tab = book_().getSheetByName(name);
  if (!tab || tab.getLastRow() < 2) return [];
  var head = headersOf_(tab);
  return rowsToObjects_(head, tab.getRange(2, 1, tab.getLastRow() - 1, head.length).getValues());
}

/** home page banners — active hi, order ke hisaab se */
function bannersPublic_() {
  return contentRows_('Banners')
    .filter(function (row) {
      return bool_(row.Active, true);
    })
    .sort(function (a, b) {
      return int_(a.Order, 0) - int_(b.Order, 0);
    })
    .map(function (row) {
      return {
        slot: text_(row.Slot),
        title: text_(row.Title),
        subtitle: text_(row.Subtitle),
        image: text_(row.Image),
        link: text_(row.Link),
      };
    });
}

/** FAQs — site ke help section me */
function faqsPublic_() {
  return contentRows_('FAQs')
    .filter(function (row) {
      return bool_(row.Active, true) && text_(row.Question);
    })
    .sort(function (a, b) {
      return int_(a.Order, 0) - int_(b.Order, 0);
    })
    .map(function (row) {
      return { question: text_(row.Question), answer: text_(row.Answer) };
    });
}

/** categories — header/nav ke liye (slug, title, image) */
function categoriesPublic_() {
  return contentRows_('Categories')
    .filter(function (row) {
      return bool_(row.Active, true) && text_(row.Slug);
    })
    .sort(function (a, b) {
      return int_(a.Order, 0) - int_(b.Order, 0);
    })
    .map(function (row) {
      return { slug: text_(row.Slug), title: text_(row.Title), image: text_(row.Image) };
    });
}

/** product search — ProductList ke title/handle par (site ka search box) */
function searchProducts_(query, limit) {
  var needle = text_(query).toLowerCase();
  var max = Math.max(1, Math.min(50, int_(limit, 20)));
  if (needle.length < 2) return [];
  var tab = book_().getSheetByName('ProductList');
  if (!tab || tab.getLastRow() < 2) return [];
  var head = headersOf_(tab);
  var rows = rowsToObjects_(head, tab.getRange(2, 1, tab.getLastRow() - 1, head.length).getValues());
  var hits = [];
  for (var i = 0; i < rows.length && hits.length < max; i += 1) {
    var title = text_(rows[i].Title).toLowerCase();
    var handle = text_(rows[i].Handle).toLowerCase();
    if (title.indexOf(needle) < 0 && handle.indexOf(needle) < 0) continue;
    hits.push({
      id: text_(rows[i].ID),
      handle: text_(rows[i].Handle),
      title: text_(rows[i].Title),
      price: num_(rows[i].Price, 0),
      image: text_(rows[i]['Main Image']),
      url: text_(rows[i].URL),
    });
  }
  return hits;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  BHAG 8 — SELF TEST: saare feature khud check karo
 * ---------------------------------------------------------------------------
 *  Owner ko kisi cheez ka bharosa chahiye to **ek click**:
 *      Sheet menu → TRENDS tools → 9. Sab kuch test karo (self-test)
 *  ya browser me `<webapp-url>?action=selftest&token=<master>`.
 *
 *  Ye function:
 *    • 60+ check chalata hai — helpers, coupon, stock, order hisaab, invoice,
 *      templates, CSV, reports, aur **live endpoints** ka shape
 *    • jo bhi row likhta hai, wo turant hata deta hai (sheet gandi nahi hoti)
 *    • `{ok, total, passed, failed, failures, results}` lauta deta hai
 * ═══════════════════════════════════════════════════════════════════════════ */

var SELFTEST_MARK = 'SELFTEST-7F3K';

/**
 * Poora self-test — **koi bhi cheez fail ho to `ok:false`** aur failure ki list.
 * Sheet par kaam karne wale test apni rows khud saaf karte hain.
 */
function runSelfTests() {
  var results = [];
  function check(name, run) {
    var started = new Date().getTime();
    try {
      var value = run();
      var ok = value === true || (value && value.ok === true);
      var detail = '';
      if (!ok) {
        detail = value && value.error ? String(value.error) : value && value.detail ? String(value.detail) : 'expected true';
      }
      results.push({ name: name, ok: Boolean(ok), detail: detail, ms: new Date().getTime() - started });
    } catch (error) {
      results.push({ name: name, ok: false, detail: String(error), ms: new Date().getTime() - started });
    }
  }
  function eq(actual, expected, label) {
    if (String(actual) !== String(expected)) {
      return { ok: false, error: (label || 'value') + ' = ' + actual + ', chahiye ' + expected };
    }
    return { ok: true };
  }

  /* ── 1. chhote helpers ─────────────────────────────────────────────── */
  check('text_ saaf karta hai', function () {
    return eq(text_('  do   space \n'), 'do space');
  });
  check('text_ max length', function () {
    return eq(text_('abcdefgh', 4), 'abcd');
  });
  check('isBlank_ khaali pakadta hai', function () {
    return eq(isBlank_('   ') && isBlank_(null) && !isBlank_(0), true);
  });
  check('num_ kachre se number', function () {
    return eq(num_('₹1,299'), 1299);
  });
  check('num_ default', function () {
    return eq(num_('abc', 7), 7);
  });
  check('int_ round karta hai', function () {
    return eq(int_('3.6'), 4);
  });
  check('money_ indian format', function () {
    return eq(money_(1234567), '₹12,34,567');
  });
  check('bool_ yes/true', function () {
    return eq(bool_('yes') && bool_('1') && !bool_('no') && bool_('', true), true);
  });
  check('phoneDigits_ last 10', function () {
    return eq(phoneDigits_('+91 98765 43210'), '9876543210');
  });
  check('phoneOk_ sahi/galat', function () {
    return eq(phoneOk_('9876543210') && !phoneOk_('12345') && !phoneOk_('1234567890'), true);
  });
  check('emailOk_', function () {
    return eq(emailOk_('a@b.com') && !emailOk_('a@b') && !emailOk_(''), true);
  });
  check('pinOk_', function () {
    return eq(pinOk_('302001') && !pinOk_('0123') && !pinOk_('abcdef'), true);
  });
  check('regionOfPin_', function () {
    return eq(regionOfPin_('302001').indexOf('West') === 0, true);
  });
  check('slug_', function () {
    return eq(slug_("Meera's Mint Gota Set!"), 'meera-s-mint-gota-set');
  });
  check('randId_ format', function () {
    return eq(/^LK-[A-Z0-9]{6}$/.test(randId_('LK', 6)), true);
  });
  check('hash_ same input same hash', function () {
    return eq(hash_('abc') === hash_('abc') && hash_('abc') !== hash_('abd'), true);
  });
  check('escapeHtml_', function () {
    return eq(escapeHtml_('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
  });
  check('csvCell_ quotes', function () {
    return eq(csvCell_('a,b'), '"a,b"');
  });
  check('listOf_ comma/pipe', function () {
    var list = listOf_('Kerala, Assam |Goa');
    return eq(list.length + ':' + list[2], '3:Goa');
  });
  check('uniq_ duplicates hataata hai', function () {
    return eq(uniq_(['a', 'A', 'b']).length, 2);
  });
  check('rowsToObjects_', function () {
    var rows = rowsToObjects_(['a', 'b'], [[1, 2]]);
    return eq(rows[0].b, 2);
  });
  check('sumBy_', function () {
    return eq(sumBy_([{ t: 10 }, { t: 5 }], 't'), 15);
  });
  check('countBy_', function () {
    return eq(countBy_([{ s: 'x' }, { s: 'x' }, { s: 'y' }], 's').x, 2);
  });
  check('compact_ khaali hataata hai', function () {
    return eq(Object.keys(compact_({ a: '', b: 'x', c: null })).length, 1);
  });
  check('fmtDate_ dd/mm/yyyy', function () {
    return eq(/^\d{2}\/\d{2}\/\d{4}$/.test(fmtDate_('2026-10-25T10:30:00Z')), true);
  });
  check('daysAgoIso_ past', function () {
    return eq(new Date(daysAgoIso_(3)).getTime() < Date.now(), true);
  });

  /* ── 2. CSV parser ─────────────────────────────────────────────────── */
  check('parseCsv_ simple', function () {
    var rows = parseCsv_('a,b\n1,2\n');
    return eq(rows.length + ':' + rows[1][1], '2:2');
  });
  check('parseCsv_ quotes + comma', function () {
    var rows = parseCsv_('h1,h2\n"x, y",z\n');
    return eq(rows[1][0], 'x, y');
  });
  check('parseCsv_ escaped quote', function () {
    var rows = parseCsv_('a\n"he said ""hi"""\n');
    return eq(rows[1][0], 'he said "hi"');
  });
  check('parseCsv_ khaali lines chhodta hai', function () {
    return eq(parseCsv_('a\n\n\nb\n').length, 2);
  });

  /* ── 3. messages + invoice ─────────────────────────────────────────── */
  check('renderTemplate_ placeholders', function () {
    var out = renderTemplate_('shipped', { name: 'Riya', order: 'LK-ABC123', courier: 'Delhivery', awb: '123', track: 'x' });
    return eq(out.message.indexOf('Riya') >= 0 && out.message.indexOf('Delhivery') >= 0, true);
  });
  check('renderTemplate_ missing value khaali', function () {
    return eq(renderTemplate_('placed', {}).message.indexOf('{name}'), -1);
  });
  check('renderTemplate_ unknown status → placed', function () {
    return eq(renderTemplate_('kuch-bhi', { name: 'A' }).subject.indexOf('Order mila') >= 0, true);
  });
  check('whatsappLink_ 91 lagata hai', function () {
    return eq(whatsappLink_('9876543210', 'hi').indexOf('https://wa.me/919876543210?text=hi') === 0, true);
  });
  check('emailOk_ invoice mail guard', function () {
    return eq(emailOk_('owner@shop.in') && !emailOk_('owner@'), true);
  });
  check('invoiceNumberFor_ prefix', function () {
    return eq(invoiceNumberFor_('LK-ABC123').indexOf('LK-ABC123') > 0, true);
  });
  check('invoiceHtml_ printable page', function () {
    var html = invoiceHtml_({
      ok: true,
      invoiceNumber: 'TY/2026/LK-ABC123',
      date: '25/10/2026',
      brand: 'TRENDS YOUNIQUE',
      gstin: '',
      phone: '7740992663',
      order: {
        'Order ID': 'LK-ABC123',
        Customer: 'Riya',
        Address: '12, Malviya Nagar',
        City: 'Jaipur',
        State: 'Rajasthan',
        PIN: '302017',
        Phone: '9876543210',
        'Payment method': 'upi',
        'Payment status': 'paid',
      },
      items: [{ Product: 'Gown', Colour: 'Pink', Size: 'M', Qty: 1, 'Price ₹': 599, 'Line total ₹': 599 }],
      totals: { subtotal: 599, discount: 0, shipping: 0, total: 599, gst: 29, gstRate: 5, qty: 1 },
    });
    return eq(html.indexOf('<html') > 0 && html.indexOf('INVOICE') > 0 && html.indexOf('Gown') > 0, true);
  });
  check('invoiceHtml_ order na mile to saaf message', function () {
    return eq(invoiceHtml_({ ok: false }).indexOf('Invoice nahi mila') > 0, true);
  });

  /* ── 4. delivery + order hisaab ─────────────────────────────────────── */
  check('validateDelivery_ khaali PIN', function () {
    return eq(validateDelivery_('Rajasthan', '').error, 'pin_required');
  });
  check('validateDelivery_ galat PIN', function () {
    return eq(validateDelivery_('Rajasthan', '0123').error, 'pin_invalid');
  });
  check('validateDelivery_ theek PIN', function () {
    var out = validateDelivery_('Rajasthan', '302001');
    return eq(out.ok && out.region.indexOf('West') === 0, true);
  });
  check('orderTotals_ simple', function () {
    var totals = orderTotals_([{ price: 599, qty: 2 }], { freeShipping: true });
    return eq(totals.subtotal + ':' + totals.qty + ':' + totals.total, '1198:2:1198');
  });
  check('orderTotals_ coupon discount', function () {
    var totals = orderTotals_([{ price: 1000, qty: 1 }], { freeShipping: true, coupon: { discount: 100 } });
    return eq(totals.total, 900);
  });
  check('orderTotals_ discount subtotal se bada nahi', function () {
    var totals = orderTotals_([{ price: 100, qty: 1 }], { freeShipping: true, coupon: { discount: 500 } });
    return eq(totals.discount + ':' + totals.total, '100:0');
  });
  check('orderTotals_ qty minimum 1', function () {
    return eq(orderTotals_([{ price: 100, qty: 0 }], { freeShipping: true }).qty, 1);
  });

  /* ── 5. coupon logic (pure) ─────────────────────────────────────────── */
  check('couponReason_ code nahi mila', function () {
    return eq(couponReason_(null, 1000), 'Ye coupon code nahi mila.');
  });
  check('couponReason_ band coupon', function () {
    return eq(couponReason_({ Code: 'X', Active: 'no' }, 1000), 'Ye coupon abhi band hai.');
  });
  check('couponReason_ use khatam', function () {
    var reason = couponReason_({ Code: 'X', Active: 'yes', 'Usage limit': 5, Used: 5 }, 1000);
    return eq(reason.indexOf('saare use') > 0, true);
  });
  check('couponReason_ min order', function () {
    var reason = couponReason_({ Code: 'X', Active: 'yes', 'Min order ₹': 2000 }, 1000);
    return eq(reason.indexOf('₹2,000') > 0, true);
  });
  check('couponReason_ expire', function () {
    var reason = couponReason_({ Code: 'X', Active: 'yes', 'Valid till': '2020-01-01' }, 1000);
    return eq(reason.indexOf('expire') > 0, true);
  });
  check('couponReason_ theek coupon', function () {
    return eq(couponReason_({ Code: 'X', Active: 'yes' }, 1000), '');
  });

  /* ── 6. sheet utilities (scratch tab) ──────────────────────────────── */
  var scratch = null;
  try {
    scratch = ensureTab_('_selftest');
    scratch.clear();
    scratch.getRange(1, 1, 1, 3).setValues([['a', 'b', 'c']]);
    scratch.getRange(2, 1, 1, 3).setValues([[1, 2, 3]]);
  } catch (error) {
    results.push({ name: 'scratch tab banayi', ok: false, detail: String(error), ms: 0 });
  }
  check('scratch tab read/write', function () {
    if (!scratch) return { ok: false, error: 'no scratch tab' };
    var value = scratch.getRange(2, 2).getValue();
    return eq(value, 2);
  });
  check('headersOf_ scratch header padhta hai', function () {
    if (!scratch) return { ok: false, error: 'no scratch tab' };
    return eq(headersOf_(scratch).join(','), 'a,b,c');
  });
  check('ensureColumn_ naya column jodta hai', function () {
    if (!scratch) return { ok: false, error: 'no scratch tab' };
    var index = ensureColumn_(scratch, 'd');
    return eq(index + ':' + headersOf_(scratch).length, '3:4');
  });

  /* ── 7. stock + coupon sheet round-trip (rows wapas hataate hain) ───── */
  var stockTab = null;
  var stockStart = 0;
  check('stock set/read/reduce', function () {
    stockTab = ensureStockTab_();
    stockStart = stockTab.getLastRow();
    stockSet_(SELFTEST_MARK, 'M', 5);
    var read = stockOf_(SELFTEST_MARK, 'M');
    var reduced = stockReduce_(SELFTEST_MARK, 'M', 2);
    return eq(read + ':' + reduced.left, '5:3');
  });
  check('stock khatam hone par rok', function () {
    var out = stockReduce_(SELFTEST_MARK, 'M', 99);
    return eq(out.error, 'out_of_stock');
  });
  check('stock restore', function () {
    stockRestore_(SELFTEST_MARK, 'M', 2);
    return eq(stockOf_(SELFTEST_MARK, 'M'), 5);
  });
  check('stock unlimited (row nahi)', function () {
    return eq(stockOf_('koi-handle-jo-sheet-me-nahi', 'M'), null);
  });

  var couponTab = null;
  var couponStart = 0;
  check('coupon sheet round-trip', function () {
    couponTab = ensureCouponsTab_();
    couponStart = couponTab.getLastRow();
    var row = { Code: SELFTEST_MARK, Type: 'percent', Value: 10, 'Min order ₹': 500, Active: 'yes', Used: 0 };
    upsertRow_('Coupons', 'Code', row);
    var pass = couponCheck_(SELFTEST_MARK, 1000);
    var fail = couponCheck_(SELFTEST_MARK, 100);
    return eq(pass.ok + ':' + pass.discount + ':' + fail.ok, 'true:100:false');
  });
  check('coupon redeem count +1', function () {
    couponRedeem_(SELFTEST_MARK);
    return eq(int_(couponByCode_(SELFTEST_MARK).Used, 0) >= 1, true);
  });
  check('couponsPublic_ active hi deta hai', function () {
    var list = couponsPublic_();
    return eq(Array.isArray(list), true);
  });

  /* ── 8. order validation (kuch likhta nahi — pehle hi ruk jaata hai) ── */
  check('placeOrder_ khaali cart', function () {
    return eq(placeOrder_({ customer: {}, items: [] }).error, 'cart_empty');
  });
  check('placeOrder_ naam zaroori', function () {
    return eq(placeOrder_({ customer: { phone: '9876543210' }, items: [{ handle: 'x' }] }).error, 'name_required');
  });
  check('placeOrder_ phone zaroori', function () {
    return eq(
      placeOrder_({ customer: { name: 'Riya', phone: '123' }, items: [{ handle: 'x' }] }).error,
      'phone_invalid',
    );
  });
  check('placeOrder_ address zaroori', function () {
    return eq(
      placeOrder_({ customer: { name: 'Riya', phone: '9876543210', address: 'x' }, items: [{ handle: 'x' }] }).error,
      'address_required',
    );
  });
  check('findOrder_ galat number', function () {
    return eq(findOrder_('LK-ZZZZZZ', '9876543210').ok, false);
  });
  check('orderTimeline_ galat number', function () {
    return eq(orderTimeline_('LK-ZZZZZZ').ok, false);
  });
  check('createReturn_ order zaroori', function () {
    return eq(createReturn_({ order: '' }).error, 'order required');
  });

  /* ── 8b. email (queue + design) ────────────────────────────────────── */
  check('email_ok — galat email pakadta hai', function () {
    return eq(emailOk_('galat@') === false && emailOk_('a@b.co') === true, true);
  });
  check('emailUpdatesEnabled_ boolean', function () {
    return eq(typeof emailUpdatesEnabled_(), 'boolean');
  });
  check('mailRetryMinutes_ ladder', function () {
    return eq(mailRetryMinutes_(1) + ':' + mailRetryMinutes_(5) + ':' + mailRetryMinutes_(40), '1:20:360');
  });
  check('orderEmailSubject_ me order number', function () {
    return eq(orderEmailSubject_('shipped', { 'Order ID': 'LK-ABC123' }).indexOf('LK-ABC123') > 0, true);
  });
  check('emailStepIndex_ shipped = 3', function () {
    return eq(emailStepIndex_('shipped'), 3);
  });
  check('emailStepIndex_ cancel = -1', function () {
    return eq(emailStepIndex_('cancelled'), -1);
  });
  check('orderEmailHtml_ poora mail banata hai', function () {
    var html = orderEmailHtml_({
      brand: 'TRENDS YOUNIQUE',
      tagline: 'Couture',
      status: 'packed',
      step: 2,
      site: 'https://trendsyounique.fashion',
      trackUrl: 'https://trendsyounique.fashion/track-order/',
      helpUrl: 'https://wa.me/917740992663',
      whatsapp: '7740992663',
      order: {
        'Order ID': 'LK-ABC123',
        Customer: 'Riya',
        Address: '12, Malviya Nagar',
        City: 'Jaipur',
        State: 'Rajasthan',
        PIN: '302017',
        Phone: '9876543210',
        'Payment method': 'upi',
        'Payment status': 'paid',
        'Date & Time': nowIso_(),
        Courier: '',
        AWB: '',
      },
      items: [{ product: 'Gown', colour: 'Pink', size: 'M', qty: 1, price: 599, image: '' }],
      totals: { subtotal: 599, discount: 0, shipping: 0, total: 599, qty: 1 },
    });
    return eq(
      html.indexOf('<!doctype html>') === 0 &&
        html.indexOf('Aapka order') > 0 &&
        html.indexOf('Gown') > 0 &&
        html.indexOf('Order track karein') > 0,
      true,
    );
  });
  check('mail queue me daal kar nikal sakte hain', function () {
    var mailTab = ensureMailQueueTab_();
    var start = mailTab.getLastRow();
    var queued = queueMail_({
      to: 'selftest@example.com',
      orderId: 'LK-SELFT1',
      template: 'selftest',
      subject: 'Self-test mail',
      html: '<p>test</p>',
    });
    var added = mailTab.getLastRow() - start;
    // asli mail nahi bhejte — bas queue row banne/hatne ka check
    if (added > 0) mailTab.deleteRows(start + 1, added);
    return eq(String(queued.ok) + ':' + added, 'true:1');
  });
  check('mailQueueStats_ shape', function () {
    var stats = mailQueueStats_();
    return eq(typeof stats.total === 'number' && typeof stats.sent === 'number', true);
  });

  /* ── 9. reports + content (read-only) ──────────────────────────────── */
  check('reportSummary_ shape', function () {
    var summary = reportSummary_();
    return eq(typeof summary.orders === 'number' && typeof summary.revenue === 'number', true);
  });
  check('reportDaily_ 7 din', function () {
    var daily = reportDaily_(7);
    return eq(daily.days.length, 7);
  });
  check('reportTopProducts_ array', function () {
    return eq(Array.isArray(reportTopProducts_(5)), true);
  });
  check('reportTopCustomers_ array', function () {
    return eq(Array.isArray(reportTopCustomers_(5)), true);
  });
  check('bannersPublic_ array', function () {
    return eq(Array.isArray(bannersPublic_()), true);
  });
  check('faqsPublic_ array', function () {
    return eq(Array.isArray(faqsPublic_()), true);
  });
  check('categoriesPublic_ array', function () {
    return eq(Array.isArray(categoriesPublic_()), true);
  });
  check('searchProducts_ chhota query khaali', function () {
    return eq(searchProducts_('a').length, 0);
  });
  check('stockPublic_ map deta hai', function () {
    return eq(typeof stockPublic_() === 'object', true);
  });
  check('pendingReviewsCount_ number', function () {
    return eq(typeof pendingReviewsCount_(), 'number');
  });
  check('lowStockList_ array', function () {
    return eq(Array.isArray(lowStockList_()), true);
  });

  /* ── 10. live endpoints ka shape ───────────────────────────────────── */
  check('GET public → settings', function () {
    var body = JSON.parse(doGet({ parameter: { action: 'public' } }).getContent());
    return eq(body.ok && typeof body.settings === 'object', true);
  });
  check('GET ping → version', function () {
    var body = JSON.parse(doGet({ parameter: { action: 'ping' } }).getContent());
    return eq(body.version === VERSION, true);
  });
  check('GET schema → headers', function () {
    var body = JSON.parse(doGet({ parameter: { action: 'schema', token: MASTER_TOKEN } }).getContent());
    return eq(body.ok && Array.isArray(body.schema.Orders), true);
  });
  check('GET bina token admin action → unauthorized', function () {
    var body = JSON.parse(doGet({ parameter: { action: 'health' } }).getContent());
    return eq(body.error, 'unauthorized');
  });
  check('GET unknown action', function () {
    var body = JSON.parse(doGet({ parameter: { action: 'kuch-bhi', token: MASTER_TOKEN } }).getContent());
    return eq(body.error, 'unknown action');
  });
  check('GET reviews public (handle)', function () {
    var body = JSON.parse(doGet({ parameter: { action: 'reviews', handle: 'koi-nahi' } }).getContent());
    return eq(body.ok && Array.isArray(body.reviews), true);
  });
  check('GET products_public', function () {
    var body = JSON.parse(doGet({ parameter: { action: 'products_public' } }).getContent());
    return eq(body.ok && typeof (body.images || body.items || body.products) === 'object', true);
  });
  check('GET images_public', function () {
    var body = JSON.parse(doGet({ parameter: { action: 'images_public' } }).getContent());
    // purana key `items` hai (site isi ko padhti hai) — naya `images` bhi saath chalta hai
    return eq(body.ok && typeof (body.items || body.images) === 'object', true);
  });
  check('GET order_status bina order → saaf jawab', function () {
    var body = JSON.parse(doGet({ parameter: { action: 'order_status', order: 'LK-ZZZZZZ', phone: '9876543210' } }).getContent());
    return eq(body.ok, false);
  });
  check('GET coupons (code ke bina list)', function () {
    var body = JSON.parse(doGet({ parameter: { action: 'coupons' } }).getContent());
    return eq(body.ok && Array.isArray(body.coupons), true);
  });
  check('GET coupons (galat code)', function () {
    var body = JSON.parse(doGet({ parameter: { action: 'coupons', code: 'NOPE-NOPE', total: '1000' } }).getContent());
    return eq(body.ok, false);
  });
  check('GET stock', function () {
    var body = JSON.parse(doGet({ parameter: { action: 'stock' } }).getContent());
    return eq(body.ok, true);
  });
  check('GET banners/faqs/categories', function () {
    var banners = JSON.parse(doGet({ parameter: { action: 'banners' } }).getContent());
    var faqs = JSON.parse(doGet({ parameter: { action: 'faqs' } }).getContent());
    var categories = JSON.parse(doGet({ parameter: { action: 'categories' } }).getContent());
    return eq(banners.ok && faqs.ok && categories.ok, true);
  });
  check('GET search', function () {
    var body = JSON.parse(doGet({ parameter: { action: 'search', q: 'anarkali' } }).getContent());
    return eq(body.ok && Array.isArray(body.results), true);
  });
  check('GET invoice galat order → HTML', function () {
    var body = doGet({ parameter: { action: 'invoice', order: 'LK-ZZZZZZ', phone: '9876543210' } }).getContent();
    return eq(String(body).indexOf('Invoice nahi mila') > 0, true);
  });
  check('POST galat token → unauthorized', function () {
    var body = JSON.parse(
      doPost({ parameter: {}, postData: { contents: JSON.stringify({ action: 'append', token: 'galat', rows: [] }) } }).getContent(),
    );
    return eq(body.error, 'unauthorized');
  });
  check('POST khaali body → invalid json', function () {
    var body = JSON.parse(doPost({ parameter: {}, postData: { contents: '' } }).getContent());
    return eq(body.error, 'invalid json');
  });
  check('POST upsert bina master → unauthorized', function () {
    var body = JSON.parse(
      doPost({
        parameter: {},
        postData: { contents: JSON.stringify({ action: 'upsert', token: EFFECTIVE_WRITE_TOKEN, sheet: 'Products', row: {} }) },
      }).getContent(),
    );
    return eq(body.error, 'unauthorized');
  });

  /* ── 11. saaf-safai ────────────────────────────────────────────────── */
  try {
    if (stockTab && stockStart >= 1 && stockTab.getLastRow() > stockStart) {
      stockTab.deleteRows(stockStart + 1, stockTab.getLastRow() - stockStart);
    }
    if (couponTab && couponStart >= 1 && couponTab.getLastRow() > couponStart) {
      couponTab.deleteRows(couponStart + 1, couponTab.getLastRow() - couponStart);
    }
    if (scratch) book_().deleteSheet(scratch);
  } catch (error) {
    results.push({ name: 'self-test rows saaf karna', ok: false, detail: String(error), ms: 0 });
  }

  var failed = results.filter(function (entry) {
    return !entry.ok;
  });
  return {
    ok: failed.length === 0,
    version: VERSION,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    failures: failed,
    results: results,
    time: nowIso_(),
  };
}

/** Menu se: self-test chala kar sheet me chhota summary likhta hai */
function selfTestOnSheet() {
  var report = runSelfTests();
  var lines = [
    ['TRENDS self-test — ' + (report.ok ? 'SAB PASS' : 'KUCH FAIL'), ''],
    ['Version', report.version],
    ['Total checks', String(report.total)],
    ['Passed', String(report.passed)],
    ['Failed', String(report.failed)],
    ['Time', report.time],
    ['', ''],
  ];
  report.failures.forEach(function (entry) {
    lines.push(['FAIL: ' + entry.name, entry.detail]);
  });
  var tab = ensureTab_('_selftest_report');
  tab.clear();
  tab.getRange(1, 1, lines.length, 2).setValues(lines);
  tab.getRange(1, 1, 1, 2).setFontWeight('bold');
  tab.setColumnWidth(1, 380);
  tab.setColumnWidth(2, 320);

  try {
    SpreadsheetApp.getUi().alert(
      (report.ok ? '✅ Sab pass' : '❌ Kuch fail') +
        '\n\nTotal: ' + report.total + '\nPass: ' + report.passed + '\nFail: ' + report.failed +
        '\n\nPoori list `_selftest_report` tab me hai.',
    );
  } catch (error) {
    // ignore
  }
  return report;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  BHAG 9 — EMAIL (order status automatic, queue ke saath)
 * ---------------------------------------------------------------------------
 *  Owner ka rule: **customer ko har status par asli email jaye** — placed,
 *  confirmed, packed, shipped, delivered (aur cancel) — poori detail ke saath.
 *
 *  Email Google ke free `MailApp` se jaata hai (koi paid service nahi).
 *
 *  Bharosa kaise: har mail pehle `MailQueue` tab me **queue** hoti hai, phir
 *  turant bhejne ki koshish hoti hai. Net/quota problem ho to wahi row
 *  **30 baar tak** (MAX_MAIL_ATTEMPTS) retry hoti hai — har retry thodi der baad
 *  (`processMailQueue`, trigger se har 10 minute). Isliye ek bhi mail "gum"
 *  nahi hoti, aur `Notifications` tab me poora sach rehta hai.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** ek mail kitni baar try hogi (owner: "20-30 fallback rakhna, ya zyada") */
var MAX_MAIL_ATTEMPTS = 30;

/**
 * Retry ka gap (minute me) — pehle jaldi-jaldi, baad me ghante-ghante.
 * Attempt 12 ke baad har 6 ghante.
 */
function mailRetryMinutes_(attempts) {
  var ladder = [1, 2, 5, 10, 20, 30, 60, 120, 180, 240];
  var index = Math.max(0, int_(attempts, 0) - 1);
  if (index >= ladder.length) return 360;
  return ladder[index];
}

/** setting se email updates chalu/band */
function emailUpdatesEnabled_() {
  return settingBool_('email_updates', true);
}

function ensureMailQueueTab_() {
  var tab = ensureTab_('MailQueue');
  if (tab.getLastRow() < 1 || isBlank_(tab.getRange(1, 1).getValue())) {
    tab.getRange(1, 1, 1, HEADERS.MailQueue.length).setValues([HEADERS.MailQueue]);
    tab.getRange(1, 1, 1, HEADERS.MailQueue.length).setFontWeight('bold');
    tab.setFrozenRows(1);
    tab.setColumnWidth(6, 420);
    tab.setColumnWidth(10, 220);
  }
  return tab;
}

/** abhi kitni quota bachi hai (din me) — email bhejne se pehle dekhte hain */
function mailQuota_() {
  try {
    return Number(MailApp.getRemainingDailyQuota());
  } catch (error) {
    return -1;
  }
}

/**
 * Turant mail bhejo (queue ke andar se bhi yahi chalta hai).
 * Return `{ok}` ya `{ok:false, error}` — kabhi exception nahi.
 */
function sendMailNow_(to, subject, text, html, fromName) {
  var address = text_(to);
  if (!emailOk_(address)) return { ok: false, error: 'invalid_email' };
  var quota = mailQuota_();
  if (quota === 0) return { ok: false, error: 'quota_exhausted' };
  try {
    MailApp.sendEmail({
      to: address,
      subject: text_(subject, 140) || 'TRENDS YOUNIQUE',
      body: String(text || '').slice(0, 2000),
      htmlBody: String(html || text || ''),
      name: text_(fromName) || setting_('email_from_name', 'TRENDS YOUNIQUE'),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

/** mail ko queue me daalo — bhejna `processMailQueue_()` ka kaam */
function queueMail_(mail) {
  var data = mail || {};
  var to = text_(data.to);
  if (!emailOk_(to)) return { ok: false, error: 'invalid_email' };
  var tab = ensureMailQueueTab_();
  var head = headersOf_(tab);
  var row = new Array(head.length).fill('');
  row[head.indexOf('Queued At')] = nowIso_();
  row[head.indexOf('Order ID')] = text_(data.orderId);
  row[head.indexOf('To')] = to;
  row[head.indexOf('Template')] = text_(data.template);
  row[head.indexOf('Subject')] = text_(data.subject, 140);
  row[head.indexOf('Body')] = String(data.html || data.text || '');
  row[head.indexOf('Attempts')] = 0;
  row[head.indexOf('Next Try')] = nowIso_();
  row[head.indexOf('Status')] = 'queued';
  row[head.indexOf('Last Error')] = '';
  tab.getRange(tab.getLastRow() + 1, 1, 1, head.length).setValues([row]);
  return { ok: true, queued: true };
}

/**
 * Queue chalao — jo mail bhejni hain (aur jinki retry ka time aa gaya) bhej deta hai.
 * `limit` default 20 (Apps Script 6 minute/execution limit ke andar rehne ke liye).
 * `force` = true to "Next Try" ka waqt dekh kar nahi rukta (owner khud chala raha hai).
 */
function processMailQueue_(limit, force) {
  var tab = book_().getSheetByName('MailQueue');
  if (!tab || tab.getLastRow() < 2) return { ok: true, sent: 0, retried: 0, failed: 0, pending: 0 };
  var head = headersOf_(tab);
  var rows = tab.getRange(2, 1, tab.getLastRow() - 1, head.length).getValues();
  var col = function (name) {
    return head.indexOf(name);
  };
  var max = Math.max(1, Math.min(50, int_(limit, 20)));
  var now = Date.now();
  var sent = 0;
  var retried = 0;
  var failed = 0;

  for (var i = 0; i < rows.length; i += 1) {
    if (sent + retried >= max) break;
    var status = text_(rows[i][col('Status')]).toLowerCase();
    if (status === 'sent' || status === 'failed') continue;
    var attempts = int_(rows[i][col('Attempts')], 0);
    var nextTry = rows[i][col('Next Try')];
    var nextTime = nextTry ? new Date(nextTry).getTime() : 0;
    if (!force && nextTime && nextTime > now) continue;

    var to = text_(rows[i][col('To')]);
    var subject = text_(rows[i][col('Subject')]);
    var html = String(rows[i][col('Body')] || '');
    var result = sendMailNow_(to, subject, html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500), html);

    if (result.ok) {
      tab.getRange(i + 2, col('Status') + 1).setValue('sent');
      tab.getRange(i + 2, col('Attempts') + 1).setValue(attempts + 1);
      tab.getRange(i + 2, col('Last Error') + 1).setValue('');
      tab.getRange(i + 2, col('Next Try') + 1).setValue('');
      sent += 1;
      continue;
    }

    var nextAttempts = attempts + 1;
    var isFinal = nextAttempts >= MAX_MAIL_ATTEMPTS || result.error === 'invalid_email';
    tab.getRange(i + 2, col('Attempts') + 1).setValue(nextAttempts);
    tab.getRange(i + 2, col('Last Error') + 1).setValue(text_(result.error, 200));
    tab.getRange(i + 2, col('Status') + 1).setValue(isFinal ? 'failed' : 'retry');
    var when = new Date(Date.now() + mailRetryMinutes_(nextAttempts) * 60 * 1000);
    tab.getRange(i + 2, col('Next Try') + 1).setValue(isFinal ? '' : when.toISOString());
    if (isFinal) {
      failed += 1;
      logNotification_('email-failed', to, text_(rows[i][col('Order ID')]), text_(rows[i][col('Template')]), subject + ' — ' + result.error, 'failed');
      ownerAlert_('Email fail — ' + subject, 'Customer ko mail nahi gaya: ' + to + '\nReason: ' + result.error);
    } else {
      retried += 1;
    }
  }

  var pending = 0;
  for (var r = 0; r < rows.length; r += 1) {
    var state = text_(rows[r][col('Status')]).toLowerCase();
    if (state === 'queued' || state === 'retry') pending += 1;
  }
  return { ok: true, sent: sent, retried: retried, failed: failed, pending: pending, quota: mailQuota_() };
}

/** queue ka hisaab — admin/self-test ke liye */
function mailQueueStats_() {
  var tab = book_().getSheetByName('MailQueue');
  var stats = { total: 0, queued: 0, retry: 0, sent: 0, failed: 0, quota: mailQuota_() };
  if (!tab || tab.getLastRow() < 2) return stats;
  var head = headersOf_(tab);
  var statusCol = head.indexOf('Status');
  if (statusCol < 0) return stats;
  var rows = tab.getRange(2, statusCol + 1, tab.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < rows.length; i += 1) {
    var state = text_(rows[i][0]).toLowerCase();
    stats.total += 1;
    if (state === 'sent') stats.sent += 1;
    else if (state === 'failed') stats.failed += 1;
    else if (state === 'retry') stats.retry += 1;
    else stats.queued += 1;
  }
  return stats;
}

/* ─────────────────────── email ka design (HTML) ─────────────────────── */

var EMAIL_STEPS = [
  { key: 'placed', label: 'Order placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];

/** status → 0..4 (cancel = -1) — tracking page jaisa hi hisaab */
function emailStepIndex_(status) {
  var value = String(status || '').toLowerCase();
  if (/cancel|return|refund|rto/.test(value)) return -1;
  if (/out for deliver/.test(value)) return 3;
  if (/deliver|complete|handover/.test(value)) return 4;
  if (/ship|dispatch|transit|courier|awb/.test(value)) return 3;
  if (/pack|ready|label/.test(value)) return 2;
  if (/confirm|process|accept|prepar/.test(value)) return 1;
  return 0;
}

/** email ka subject — customer ko saaf pata chale kaunsa order kya hua */
function orderEmailSubject_(status, order) {
  var orderId = text_(order && order['Order ID']);
  var brand = setting_('brand_name', 'TRENDS YOUNIQUE');
  var label = {
    placed: 'Order mil gaya',
    confirmed: 'Order confirm ho gaya',
    packed: 'Packing ho gayi',
    shipped: 'Order ship ho gaya',
    delivered: 'Order deliver ho gaya',
    cancelled: 'Order cancel ho gaya',
    returned: 'Return update',
  }[String(status || '').toLowerCase()] || 'Order update';
  return label + ' — ' + orderId + ' · ' + brand;
}

/** 5 step ki patti (email me) */
function emailStepsHtml_(status) {
  var current = emailStepIndex_(status);
  var cells = EMAIL_STEPS.map(function (step, index) {
    var done = current >= 0 && current >= index;
    var active = current === index;
    var colour = done ? '#6f1d2b' : '#e6dccd';
    var textColour = done ? '#ffffff' : '#a49a90';
    return (
      '<td style="text-align:center;padding:0 2px">' +
      '<div style="width:26px;height:26px;line-height:26px;margin:0 auto;border-radius:50%;' +
      'background:' + colour + ';color:' + textColour + ';font:600 11px Arial;' +
      (active ? 'box-shadow:0 0 0 3px #f1e4cd;' : '') + '">' +
      (done ? '&#10003;' : String(index + 1)) +
      '</div>' +
      '<div style="font:9px Arial;letter-spacing:.4px;text-transform:uppercase;color:#8a7d72;padding-top:4px">' +
      escapeHtml_(step.label) + '</div></td>'
    );
  }).join('');
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 6px"><tr>' +
    cells +
    '</tr></table>'
  );
}

/** email ke liye data — order + items + totals */
function emailDataFor_(order, status) {
  var orderId = text_(order && order['Order ID']);
  var found = orderId ? findOrder_(orderId) : { ok: false };
  var items = found.ok ? found.items || [] : [];
  var total = num_(order && order['Total ₹'], 0);
  return {
    brand: setting_('brand_name', 'TRENDS YOUNIQUE'),
    tagline: setting_('tagline', ''),
    supportPhone: setting_('support_phone', ''),
    whatsapp: setting_('whatsapp', ''),
    site: WEBAPP_PUBLIC_BASE,
    status: text_(status),
    step: emailStepIndex_(status),
    order: order || {},
    items: items,
    totals: {
      subtotal: num_(order && order['Subtotal ₹'], 0),
      discount: num_(order && order['Discount ₹'], 0),
      shipping: num_(order && order['Shipping ₹'], 0),
      total: total,
      qty: num_(order && order['Qty total'], 0),
    },
    trackUrl: WEBAPP_PUBLIC_BASE + '/track-order/',
    helpUrl: 'https://wa.me/91' + phoneDigits_(setting_('whatsapp', '')),
  };
}

/**
 * Poora branded email — table layout + inline CSS (Gmail/Outlook dono me theek
 * dikhta hai). Har status ke liye alag head line.
 */
function orderEmailHtml_(data) {
  var order = data.order || {};
  var step = data.step;
  var headline = {
    placed: 'Aapka order mil gaya 🎉',
    confirmed: 'Order confirm ho gaya ✓',
    packed: 'Aapki dress pack ho gayi',
    shipped: 'Aapka order raste me hai 🚚',
    delivered: 'Order deliver ho gaya 🤍',
    cancelled: 'Order cancel ho gaya',
  }[String(data.status || '').toLowerCase()] || 'Aapke order ka update';
  var subline = {
    placed: 'Team 24 ghante me confirm karegi. Tab tak aap track page par status dekh sakti hain.',
    confirmed: 'Taiyari shuru ho gayi hai — quality check ke baad packing hogi.',
    packed: 'Packing ho gayi hai. Agla update ship hone par aayega (AWB ke saath).',
    shipped: 'Courier ko de diya gaya hai. Neeche AWB number se track kar sakti hain.',
    delivered: 'Umeed hai dress pasand aayi. Review likh kar humein zaroor batayein.',
    cancelled: 'Order cancel ho gaya hai. Koi sawaal ho to WhatsApp par pooch lein.',
  }[String(data.status || '').toLowerCase()] || 'Aapke order ka status update.';

  var itemRows = (data.items || [])
    .map(function (item) {
      var image = item.image
        ? '<img src="' + escapeHtml_(item.image) + '" width="54" height="72" alt="" ' +
          'style="display:block;border:0;object-fit:cover;background:#f6f1ec">'
        : '';
      return (
        '<tr>' +
        '<td style="padding:8px 0;width:56px;vertical-align:top">' + image + '</td>' +
        '<td style="padding:8px 10px;vertical-align:top;border-bottom:1px solid #f0e6d8">' +
        '<div style="font:600 13px Arial;color:#2b2622">' + escapeHtml_(item.product) + '</div>' +
        '<div style="font:11px Arial;color:#8a7d72;padding-top:2px">' +
        escapeHtml_([item.colour, item.size].filter(Boolean).join(' · ') || '—') +
        ' · Qty ' + escapeHtml_(item.qty) + '</div></td>' +
        '<td style="padding:8px 0;vertical-align:top;border-bottom:1px solid #f0e6d8;' +
        'font:600 13px Arial;color:#2b2622;text-align:right;white-space:nowrap">' +
        money_(num_(item.price, 0) * num_(item.qty, 1)) + '</td></tr>'
      );
    })
    .join('');

  var couponRow = data.totals.discount
    ? '<tr><td style="padding:3px 0;font:12px Arial;color:#8a7d72;text-align:right">Discount' +
      (order.Coupon ? ' (' + escapeHtml_(order.Coupon) + ')' : '') +
      '</td><td style="padding:3px 0 3px 12px;font:12px Arial;color:#2f7a3f;text-align:right;white-space:nowrap">-' +
      money_(data.totals.discount) + '</td></tr>'
    : '';

  var courierBlock =
    order.Courier || order.AWB
      ? '<div style="margin-top:14px;padding:12px 14px;background:#faf6f2;border-left:3px solid #6f1d2b">' +
        '<div style="font:10px Arial;letter-spacing:1.4px;text-transform:uppercase;color:#8a7d72">Courier</div>' +
        '<div style="font:600 13px Arial;color:#2b2622;padding-top:2px">' +
        escapeHtml_(text_(order.Courier) || '—') +
        ' · AWB ' + escapeHtml_(text_(order.AWB) || '—') + '</div>' +
        (order['Tracking URL']
          ? '<a href="' + escapeHtml_(order['Tracking URL']) + '" style="font:11px Arial;color:#6f1d2b">Courier site par dekhein →</a>'
          : '') +
        '</div>'
      : '';

  return (
    '<!doctype html><html><body style="margin:0;padding:0;background:#f6f1ec">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1ec;padding:20px 10px">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" ' +
    'style="max-width:600px;width:100%;background:#ffffff;border:1px solid #eadfd0">' +
    // header
    '<tr><td style="padding:22px 26px 6px;text-align:center">' +
    '<div style="font:600 19px Georgia,serif;letter-spacing:2px;color:#6f1d2b">' +
    escapeHtml_(data.brand) + '</div>' +
    (data.tagline
      ? '<div style="font:10px Arial;letter-spacing:2px;text-transform:uppercase;color:#a3948a;padding-top:4px">' +
        escapeHtml_(data.tagline) + '</div>'
      : '') +
    '</td></tr>' +
    // headline
    '<tr><td style="padding:14px 26px 0">' +
    '<div style="font:600 17px Arial;color:#2b2622">' + escapeHtml_(headline) + '</div>' +
    '<div style="font:12.5px Arial;line-height:1.6;color:#6f6259;padding-top:6px">' + escapeHtml_(subline) + '</div>' +
    '<div style="font:10px Arial;letter-spacing:1.4px;text-transform:uppercase;color:#a3948a;padding-top:14px">' +
    'Order ' + escapeHtml_(text_(order['Order ID'])) + ' · ' + escapeHtml_(fmtDate_(order['Date & Time'], false)) +
    '</div>' +
    emailStepsHtml_(data.status) +
    '</td></tr>' +
    // items
    '<tr><td style="padding:6px 26px 0">' +
    '<div style="font:10px Arial;letter-spacing:1.6px;text-transform:uppercase;color:#8a7d72;padding-bottom:4px">' +
    'Aapka order (' + escapeHtml_(data.totals.qty || (data.items || []).length) + ' pieces)</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + itemRows + '</table>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding-top:6px">' +
    '<tr><td style="padding:3px 0;font:12px Arial;color:#8a7d72;text-align:right">Subtotal</td>' +
    '<td style="padding:3px 0 3px 12px;font:12px Arial;color:#2b2622;text-align:right;white-space:nowrap">' +
    money_(data.totals.subtotal) + '</td></tr>' +
    couponRow +
    '<tr><td style="padding:3px 0;font:12px Arial;color:#8a7d72;text-align:right">Shipping</td>' +
    '<td style="padding:3px 0 3px 12px;font:12px Arial;color:#2b2622;text-align:right;white-space:nowrap">' +
    (data.totals.shipping ? money_(data.totals.shipping) : 'Free') + '</td></tr>' +
    '<tr><td style="padding:8px 0 0;font:700 14px Arial;color:#2b2622;text-align:right;border-top:1px solid #f0e6d8">Total</td>' +
    '<td style="padding:8px 0 0 12px;font:700 14px Arial;color:#6f1d2b;text-align:right;border-top:1px solid #f0e6d8;white-space:nowrap">' +
    money_(data.totals.total) + '</td></tr>' +
    '</table>' +
    courierBlock +
    // track button
    '<div style="padding:18px 0 4px">' +
    '<a href="' + escapeHtml_(data.trackUrl) + '" style="display:inline-block;background:#6f1d2b;color:#ffffff;' +
    'font:600 11px Arial;letter-spacing:1.6px;text-transform:uppercase;text-decoration:none;padding:12px 22px">' +
    'Order track karein</a></div>' +
    // address
    '<div style="margin-top:16px;padding-top:14px;border-top:1px solid #f0e6d8">' +
    '<div style="font:10px Arial;letter-spacing:1.4px;text-transform:uppercase;color:#8a7d72">Delivery address</div>' +
    '<div style="font:12.5px Arial;line-height:1.6;color:#3d332c;padding-top:4px">' +
    escapeHtml_(text_(order.Customer)) + '<br>' +
    escapeHtml_(text_(order.Address)) + '<br>' +
    escapeHtml_([text_(order.City), text_(order.State), text_(order.PIN)].filter(Boolean).join(', ')) + '<br>' +
    escapeHtml_(text_(order.Phone)) + '</div></div>' +
    '</td></tr>' +
    // footer
    '<tr><td style="padding:18px 26px 24px;background:#fdfaf5;border-top:1px solid #f0e6d8">' +
    '<div style="font:12px Arial;color:#6f6259">Koi sawaal ho to WhatsApp kariye: ' +
    '<a href="' + escapeHtml_(data.helpUrl) + '" style="color:#6f1d2b;text-decoration:none">' +
    escapeHtml_(waDisplay_(data.whatsapp)) + '</a></div>' +
    '<div style="font:11px Arial;color:#a49a90;padding-top:8px">Payment: ' +
    escapeHtml_(text_(order['Payment method']) || '—') + ' · ' +
    escapeHtml_(text_(order['Payment status']) || '—') +
    ' · 7 day return</div>' +
    '<div style="font:10px Arial;color:#bdb2a7;padding-top:10px">' +
    escapeHtml_(data.brand) + ' · ' + escapeHtml_(data.site) +
    ' · Ye email aapke order par apne aap bheji gayi hai.</div>' +
    '</td></tr></table></td></tr></table></body></html>'
  );
}

/**
 * Order par status badla → customer ko **asli email** (queue ke through) + owner copy.
 * Return `{ok, queued, subject, quota}`.
 */
function sendOrderEmail_(order, status, extraVars) {
  var orderId = text_(order && order['Order ID']);
  if (!orderId) return { ok: false, error: 'no_order' };
  if (!emailUpdatesEnabled_()) return { ok: false, error: 'email_disabled' };

  var customerEmail = text_(order.Email);
  var ownerEmail = setting_('owner_email', '');
  if (!emailOk_(customerEmail) && !emailOk_(ownerEmail)) {
    return { ok: false, error: 'no_email' };
  }

  var data = emailDataFor_(order, status);
  if (extraVars) {
    if (extraVars.message) data.customMessage = extraVars.message;
  }
  var html = orderEmailHtml_(data);
  var subject = orderEmailSubject_(status, order);

  var queued = 0;
  if (emailOk_(customerEmail)) {
    var toCustomer = queueMail_({
      to: customerEmail,
      orderId: orderId,
      template: 'order_' + text_(status).toLowerCase(),
      subject: subject,
      html: html,
    });
    if (toCustomer.ok) queued += 1;
  }
  if (emailOk_(ownerEmail)) {
    var toOwner = queueMail_({
      to: ownerEmail,
      orderId: orderId,
      template: 'order_' + text_(status).toLowerCase() + '_owner',
      subject: '[Owner copy] ' + subject,
      html: html,
    });
    if (toOwner.ok) queued += 1;
  }

  // turant bhejne ki koshish (customer ko wait na karna pade); fail ho to queue retry karegi
  var flushed = queued ? processMailQueue_(10) : { sent: 0, retried: 0 };

  logNotification_(
    'email',
    customerEmail || ownerEmail,
    orderId,
    'order_' + text_(status).toLowerCase(),
    subject,
    flushed.sent ? 'sent' : 'queued',
  );

  return {
    ok: queued > 0,
    queued: queued,
    sent: flushed.sent || 0,
    subject: subject,
    quota: mailQuota_(),
    error: queued ? '' : 'no_email',
  };
}

/** Test email — owner khud check kar le ki mail pahunch rahi hai */
function sendTestEmail_(to) {
  var address = text_(to) || setting_('owner_email', '');
  if (!emailOk_(address)) return { ok: false, error: 'invalid_email', message: 'Email id daaliye.' };
  var sampleOrder = {
    'Order ID': 'LK-TEST01',
    'Date & Time': nowIso_(),
    Status: 'shipped',
    Customer: 'Test Customer',
    Phone: '9876543210',
    Email: address,
    Address: '12, Malviya Nagar',
    City: 'Jaipur',
    State: 'Rajasthan',
    PIN: '302017',
    'Subtotal ₹': 1198,
    'Discount ₹': 120,
    'Shipping ₹': 0,
    'Total ₹': 1078,
    'Qty total': 2,
    Coupon: 'TRENDS10',
    'Payment method': 'upi',
    'Payment status': 'paid',
    Courier: 'Delhivery',
    AWB: 'AWB12345',
  };
  var html = orderEmailHtml_(
    Object.assign(emailDataFor_(sampleOrder, 'shipped'), {
      items: [
        {
          product: 'Anarkali Suit Set (3 Piece)',
          colour: 'Pink',
          size: 'M',
          qty: 2,
          price: 599,
          image: '',
        },
      ],
    }),
  );
  var sent = sendMailNow_(address, 'Test — ' + orderEmailSubject_('shipped', sampleOrder), 'Test email', html);
  logNotification_('email-test', address, 'LK-TEST01', 'test', 'Test email', sent.ok ? 'sent' : 'failed');
  return {
    ok: sent.ok,
    error: sent.error || '',
    to: address,
    quota: mailQuota_(),
    message: sent.ok ? 'Test email chala gaya — inbox (aur spam) dekh lein.' : 'Email nahi gaya: ' + sent.error,
  };
}

/** Menu: email adress poochh kar test mail bhejta hai */
function promptEmailTest() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    'Test email',
    'Kis email par test bhejein? (khaali chhodne par owner_email use hoga)',
    ui.ButtonSet.OK_CANCEL,
  );
  if (response.getSelectedButton() !== ui.Button.OK) return { ok: false, error: 'cancelled' };
  var result = sendTestEmail_(response.getResponseText());
  ui.alert(result.message + (result.quota >= 0 ? '\n\nAaj ki bachi quota: ' + result.quota + ' mail' : ''));
  return result;
}

/** Menu: queue abhi chalao (pending/retry mails) */
function runMailQueueNow() {
  var result = processMailQueue_(40, true);
  try {
    SpreadsheetApp.getUi().alert(
      'Email queue chala:\n' +
        'Bheji: ' + result.sent + '\n' +
        'Retry par: ' + result.retried + '\n' +
        'Fail: ' + result.failed + '\n' +
        'Bachi hui: ' + result.pending +
        (result.quota >= 0 ? '\n\nAaj ki quota: ' + result.quota : ''),
    );
  } catch (error) {
    // ignore
  }
  return result;
}
