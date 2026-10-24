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

/** Apna secret token yahan daaliye (website ke GOOGLE_SHEETS_TOKEN se bilkul same) */
var TOKEN = 'CHANGE-ME-trends-token';

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
  Newsletter: ['Timestamp', 'Email'],
};

/** Settings ke default keys — website inhe padhti hai */
var DEFAULT_SETTINGS = [
  ['brand_name', 'TRENDS YOUNIQUE', 'Header / invoice / WhatsApp name'],
  ['tagline', 'Couture for the woman who arrives', 'Home hero sub-line'],
  ['support_phone', '8005900581', 'Footer + contact page'],
  ['whatsapp', '8005900581', 'Sabhi WhatsApp order links yahin se (10 digit)'],
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

function book_() {
  return SpreadsheetApp.getActiveSpreadsheet();
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

  // Orders tab par filter + sort (date descending) — owner ko latest pehle
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
  if (TOKEN && String(params.token || '') !== TOKEN) {
    return json_({ ok: false, error: 'unauthorized' });
  }
  var action = params.action || 'settings';
  if (action === 'settings') {
    return json_({ ok: true, settings: readSettings_(), time: new Date().toISOString() });
  }
  if (action === 'recent') {
    var name = String(params.sheet || 'Orders');
    var limit = Math.min(100, Math.max(1, Number(params.limit || 20)));
    return json_({ ok: true, sheet: name, rows: recentRows_(name, limit) });
  }
  if (action === 'health') {
    return json_({ ok: true, time: new Date().toISOString(), sheets: counts_() });
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

function appendRows_(rows) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var written = 0;
  try {
    rows.forEach(function (entry) {
      var name = String(entry.sheet || 'Orders');
      if (!HEADERS[name]) return;
      var sheet = sheet_(name);
      var headers = headersOf_(sheet);
      var row = [];
      for (var i = 0; i < headers.length; i += 1) {
        var value = entry.row ? entry.row[headers[i]] : '';
        row.push(value === undefined || value === null ? '' : value);
      }
      sheet.appendRow(row);
      written += 1;
    });
  } finally {
    lock.releaseLock();
  }
  return written;
}

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
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (error) {
    return json_({ ok: false, error: 'invalid json' });
  }
  if (TOKEN && String(body.token || '') !== TOKEN) {
    return json_({ ok: false, error: 'unauthorized' });
  }

  try {
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
