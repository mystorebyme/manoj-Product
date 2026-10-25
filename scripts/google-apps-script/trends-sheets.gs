/**
 * TRENDS YOUNIQUE — Google Sheet ↔ website bridge (Apps Script)
 * ------------------------------------------------------------
 * Yahi script aapki sheet ko website ka **database** banata hai.
 *
 *   Products    → admin panel se jo product upload hota hai, uski row (upsert: same
 *                 handle ho to row update, warna nayi row).
 *   Orders      → har order ki ek row (customer, address, total, status, payment).
 *   Order Items → us order ka har item alag row (product, colour, size, qty, price).
 *   Enquiries   → jo customer WhatsApp par order bhejta hai (cart se / product page se).
 *   Payments    → payment reference / verification ki rows.
 *   Settings    → WhatsApp number, UPI ID, announcement, quantity limits — owner yahan
 *                 badalta hai, website 15 second me utha leti hai (redeploy nahi).
 *   Messages    → contact form ke messages.
 *   Newsletter  → email subscribers.
 *
 *   Reviews     → har review ke saath **Product ID**; `Status` = publish/approved
 *                 hone par hi site par dikhta hai (yahi approval hai).
 *   ProductList → saare products ki list (ID, Handle, Title, Price, Main image).
 *                 `IMPORTDATA` se khud bharti hai — menu: TRENDS tools → 1.
 *   MainImage   → Handle + Image URL — site us product ki **main photo** wahi
 *                 dikhati hai (home, collection, product page).
 *
 * SETUP (ek baar, 5 minute) — steps 0-madad ke liye docs/09-devops/google-sheets.md:
 *   1. Sheet kholiye → Extensions → Apps Script.
 *   2. Is file ka poora code paste kariye.
 *   3. Neeche TOKEN me apna lamba random word daaliye (jaise 'trends-9f3k2m-2026').
 *   4. Save → Run → `setup` (permission maange to Review permissions → Allow).
 *   5. Deploy → New deployment → type "Web app"
 *        Execute as: Me
 *        Who has access: Anyone        ← zaroori (website anonymous request bhejti hai)
 *      → Deploy → Web app URL copy kariye (…/exec par khatam hota hai).
 *   6. Website/admin ke env me daaliye:
 *        GOOGLE_SHEETS_WEBAPP_URL = <wahi /exec URL>
 *        GOOGLE_SHEETS_TOKEN      = <TOKEN jaisa hi>
 *
 * Code badalne par: Deploy → Manage deployments → Edit → New version → Deploy.
 * URL wahi rehta hai.
 */

/**
 * **Master token** — settings padhna/likhna aur rows add karna, sab allowed.
 * Owner ko chat me diya gaya `tym-…` token yahan paste karna hai (ek line).
 * Jab tak paste nahi karte, ye placeholder hi rahega — yaani sheet par kisi ko
 * read access nahi milega (safe by default), par order save hota rahega.
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
var WRITE_SHEETS = ['Orders', 'Order Items', 'Enquiries', 'Messages', 'Newsletter', 'Reviews'];
var MAX_WRITE_ROWS = 40;

/** Script version — `?action=ping` se dikhta hai (kaun sa code deploy hai). */
var VERSION = '2026-10-25.r12';

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
  Reviews: ['Timestamp', 'Handle', 'Product', 'Name', 'Rating', 'Title', 'Body', 'Status', 'Source', 'Product ID'],
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
var PRODUCT_LIST_URL = 'https://www.trendsyounique.fashion/data/products-sheet.csv';

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
  return tab;
}

/** Menu: ProductList tab me saare products (ID + photo link) bhar deta hai */
function syncProductList() {
  var tab = ensureProductListTab_();
  tab.getRange(1, 1).setFormula('=IMPORTDATA("' + PRODUCT_LIST_URL + '")');
  SpreadsheetApp.flush();
  var rows = Math.max(0, tab.getLastRow() - 1);
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
    [''],
    ['Settings tab badalne ke baad', 'Kuch nahi karna — website khud refresh kar leti hai (redeploy nahi).'],
    ['Apps Script code badla ho to', 'Deploy → Manage deployments → Edit → New version → Deploy (URL wahi rehta hai).'],
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
    'max_qty_per_item', 'max_qty_bulk', 'max_qty_per_order'];
  var camel = {
    brand_name: 'brandName', tagline: 'tagline', support_phone: 'supportPhone',
    whatsapp: 'whatsapp', support_email: 'supportEmail', upi_id: 'upiId',
    upi_name: 'upiName', announcement: 'announcement', free_shipping: 'freeShipping',
    shipping_fee: 'shippingFee', max_qty_per_item: 'maxQtyPerItem',
    max_qty_bulk: 'maxQtyBulk', max_qty_per_order: 'maxQtyPerOrder',
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
    SpreadsheetApp.getUi()
      .createMenu('TRENDS tools')
      .addItem('1. Saare products ki list bharo (ID ke saath)', 'syncProductList')
      .addItem('2. Import all reviews', 'importAllReviews')
      .addItem('3. Reviews: approval kaise karein', 'showReviewHelp')
      .addItem('4. Purane reviews me Product ID bharo', 'backfillReviewProductIds')
      .addToUi();
  } catch (error) {
    // sheet ke bahar se call hua (web app) — menu ki zaroorat nahi
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
