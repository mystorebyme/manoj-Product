/**
 * Apps Script harness — `scripts/google-apps-script/trends-sheets.gs` ko Node me
 * chalane ke liye chhota sa "Google" banata hai.
 *
 * Kyun: owner ka rule hai "saare function run karein". Sheet me paste karne se
 * pehle yahan **asli** script chalti hai (doGet/doPost, setup, order flow,
 * self-test) — isliye galat code push hone ka chance kam ho jaata hai.
 *
 * Ye sirf test ke liye hai, production me koi asar nahi.
 */
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** A1 notation → { row, col, rows, cols } (1-based) */
function parseA1(a1) {
  const text = String(a1 ?? "").replace(/\$/g, "");
  const match = /^(?:'([^']+)'!)?([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i.exec(text.trim());
  if (!match) throw new Error(`A1 galat: ${a1}`);
  const colToNumber = (letters) =>
    letters
      .toUpperCase()
      .split("")
      .reduce((sum, char) => sum * 26 + (char.charCodeAt(0) - 64), 0);
  const col = colToNumber(match[2]);
  const row = Number(match[3]);
  const endCol = match[4] ? colToNumber(match[4]) : col;
  const endRow = match[5] ? Number(match[5]) : row;
  return { row, col, rows: Math.max(1, endRow - row + 1), cols: Math.max(1, endCol - col + 1) };
}

class FakeRange {
  constructor(sheet, row, col, rows, cols) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.rows = rows;
    this.cols = cols;
  }
  getSheet() {
    return this.sheet;
  }
  getRow() {
    return this.row;
  }
  getColumn() {
    return this.col;
  }
  getA1Notation() {
    return `${this.sheet.getName()}!R${this.row}C${this.col}`;
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.rows; r += 1) {
      const line = [];
      for (let c = 0; c < this.cols; c += 1) line.push(this.sheet.readCell(this.row + r, this.col + c));
      out.push(line);
    }
    return out;
  }
  getValue() {
    return this.sheet.readCell(this.row, this.col);
  }
  setValues(values) {
    values.forEach((line, r) => {
      line.forEach((value, c) => {
        this.sheet.writeCell(this.row + r, this.col + c, value);
      });
    });
    return this;
  }
  setValue(value) {
    this.sheet.writeCell(this.row, this.col, value);
    return this;
  }
  setFormula(formula) {
    // harness formulas ko value ki tarah rakhta hai (IMPORTDATA yahan nahi chalti)
    this.sheet.writeCell(this.row, this.col, formula);
    return this;
  }
  setNumberFormat() {
    return this;
  }
  setFontWeight() {
    return this;
  }
  setDataValidation() {
    return this;
  }
  clear() {
    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.cols; c += 1) this.sheet.writeCell(this.row + r, this.col + c, "");
    }
    return this;
  }
}

/** Apps Script ke formatting methods — test me inka koi asar nahi, par chain tootni nahi chahiye */
const CHAINABLE_NOOPS = [
  'setFontSize', 'setFontFamily', 'setFontColor', 'setFontStyle', 'setFontLine', 'setBackground',
  'setBackgroundRGB', 'setHorizontalAlignment', 'setVerticalAlignment', 'setWrap', 'setWrapStrategy',
  'setBorder', 'setNote', 'setRichTextValue', 'setNumberFormats', 'merge', 'mergeAcross', 'breakApart',
  'setTextRotation', 'setTextDirection', 'copyTo', 'setDataValidations', 'setFormulaR1C1', 'setFormulas',
  'setFormulasR1C1', 'sort', 'activate', 'setShowHyperlink',
];
for (const name of CHAINABLE_NOOPS) {
  FakeRange.prototype[name] = function noop() {
    return this;
  };
}

class FakeSheet {
  constructor(name) {
    this.name = name;
    this.cells = new Map(); // "row:col" → value
    this.frozenRows = 0;
    this.lastTouchedRow = 0;
  }
  getName() {
    return this.name;
  }
  readCell(row, col) {
    const value = this.cells.get(`${row}:${col}`);
    return value === undefined ? "" : value;
  }
  writeCell(row, col, value) {
    if (value === "" || value === null || value === undefined) {
      this.cells.delete(`${row}:${col}`);
    } else {
      this.cells.set(`${row}:${col}`, value);
    }
    if (value !== "" && value !== null && value !== undefined) {
      this.lastTouchedRow = Math.max(this.lastTouchedRow, row);
    }
  }
  maxRow() {
    let max = 0;
    for (const key of this.cells.keys()) max = Math.max(max, Number(key.split(":")[0]));
    return max;
  }
  maxCol() {
    let max = 0;
    for (const key of this.cells.keys()) max = Math.max(max, Number(key.split(":")[1]));
    return max;
  }
  getLastRow() {
    return this.maxRow();
  }
  getLastColumn() {
    return Math.max(1, this.maxCol());
  }
  getRange(a, b, c, d) {
    if (typeof a === "string") {
      const parsed = parseA1(a);
      return new FakeRange(this, parsed.row, parsed.col, parsed.rows, parsed.cols);
    }
    return new FakeRange(this, a, b, c ?? 1, d ?? 1);
  }
  getDataRange() {
    return new FakeRange(this, 1, 1, Math.max(1, this.maxRow()), Math.max(1, this.maxCol()));
  }
  appendRow(values) {
    const row = this.maxRow() + 1;
    values.forEach((value, index) => this.writeCell(row, index + 1, value));
    return this;
  }
  clear() {
    this.cells.clear();
    return this;
  }
  deleteRows(start, count) {
    const next = new Map();
    for (const [key, value] of this.cells.entries()) {
      const [row, col] = key.split(":").map(Number);
      if (row >= start && row < start + count) continue;
      const shifted = row >= start + count ? row - count : row;
      next.set(`${shifted}:${col}`, value);
    }
    this.cells = next;
    return this;
  }
  insertRows() {
    return this;
  }
  setFrozenRows(count) {
    this.frozenRows = count;
    return this;
  }
  setColumnWidth() {
    return this;
  }
  autoResizeColumn() {
    return this;
  }
  autoResizeColumns() {
    return this;
  }
  setTabColor() {
    return this;
  }
  getMaxRows() {
    return Math.max(1000, this.maxRow());
  }
  getMaxColumns() {
    return Math.max(26, this.maxCol());
  }
  getSheetId() {
    return this.name.length;
  }
  getIndex() {
    return 1;
  }
  hideSheet() {
    return this;
  }
  showSheet() {
    return this;
  }
}

class FakeBook {
  constructor(name) {
    this.name = name;
    this.sheets = [];
  }
  getId() {
    return "fake-spreadsheet-id";
  }
  getName() {
    return this.name;
  }
  getSheetByName(name) {
    return this.sheets.find((sheet) => sheet.getName() === name) ?? null;
  }
  insertSheet(name) {
    const sheet = new FakeSheet(name);
    this.sheets.push(sheet);
    return sheet;
  }
  getSheets() {
    return this.sheets;
  }
  toast() {
    return undefined;
  }
  getUrl() {
    return "https://docs.google.com/spreadsheets/d/fake/edit";
  }
  getSpreadsheetTimeZone() {
    return "Asia/Kolkata";
  }
  setSpreadsheetTimeZone() {
    return this;
  }
  deleteSheet(sheet) {
    this.sheets = this.sheets.filter((entry) => entry !== sheet);
  }
}

/** poora Apps Script environment */
export function createHarness(options = {}) {
  const book = new FakeBook(options.name ?? "TRENDS YOUNIQUE — Store DB");
  (options.sheets ?? []).forEach((name) => book.insertSheet(name));

  const properties = new Map(Object.entries(options.properties ?? {}));
  const cache = new Map();
  const mails = [];
  /** test ise badal kar mail fail/success kar sakta hai */
  const mailState = { failAll: false, quota: 100, errorMessage: 'mail quota / network error (test)' };
  const fetches = [];
  const triggers = [];
  const alerts = [];

  const range = (sheet, values) => {
    if (values.length) sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  };

  const spreadsheetApp = {
    getActiveSpreadsheet: () => book,
    getActive: () => book,
    openById: () => book,
    flush: () => undefined,
    getSpreadsheetTimeZone: () => "Asia/Kolkata",
    getUi: () => ({
      createMenu: () => {
        const menu = {
          addItem: () => menu,
          addSubMenu: () => menu,
          addSeparator: () => menu,
          addToUi: () => undefined,
        };
        return menu;
      },
      alert: (message) => {
        alerts.push(String(message));
      },
    }),
    newDataValidation: () => {
      const builder = {
        requireValueInList: () => builder,
        requireValueInRange: () => builder,
        setAllowInvalid: () => builder,
        build: () => ({}),
      };
      return builder;
    },
  };

  const contentService = {
    MimeType: { JSON: "application/json", HTML: "text/html", TEXT: "text/plain" },
    createTextOutput: (text) => {
      const output = {
        text: String(text ?? ""),
        mime: "text/plain",
        setMimeType(mime) {
          output.mime = mime;
          return output;
        },
        getContent: () => output.text,
        getMimeType: () => output.mime,
      };
      return output;
    },
  };

  const urlFetchApp = {
    fetch: (url, opts) => {
      fetches.push({ url: String(url), opts: opts ?? {} });
      const handler = options.fetch;
      const answer = handler ? handler(String(url)) : null;
      if (!answer) {
        return { getResponseCode: () => 404, getContentText: () => "" };
      }
      return {
        getResponseCode: () => answer.status ?? 200,
        getContentText: () => (typeof answer.body === "string" ? answer.body : JSON.stringify(answer.body)),
      };
    },
  };

  const utilities = {
    DigestAlgorithm: { MD5: "MD5", SHA_256: "SHA256" },
    Charset: { UTF_8: "UTF-8" },
    computeDigest: (algorithm, value) => {
      const digest = crypto.createHash(algorithm === "MD5" ? "md5" : "sha256").update(String(value)).digest();
      return [...digest].map((byte) => (byte > 127 ? byte - 256 : byte));
    },
    base64DecodeWebSafe: (value) => [...Buffer.from(String(value), "base64url")].map((b) => (b > 127 ? b - 256 : b)),
    newBlob: (bytes) => ({
      getDataAsString: () => Buffer.from(bytes.map((b) => (b < 0 ? b + 256 : b))).toString("utf8"),
    }),
    formatDate: (date) => new Date(date).toISOString().slice(0, 10),
    sleep: () => undefined,
  };

  const scriptApp = {
    getProjectTriggers: () => triggers.slice(),
    deleteTrigger: (trigger) => {
      const index = triggers.indexOf(trigger);
      if (index >= 0) triggers.splice(index, 1);
    },
    newTrigger: (handler) => {
      const builder = {
        forSpreadsheet: () => builder,
        timeBased: () => builder,
        onEdit: () => builder,
        atHour: () => builder,
        everyDays: () => builder,
        everyMinutes: () => builder,
        everyHours: () => builder,
        create: () => {
          triggers.push({ handler, getHandlerFunction: () => handler });
          return triggers[triggers.length - 1];
        },
      };
      return builder;
    },
  };

  const context = {
    console,
    SpreadsheetApp: spreadsheetApp,
    ContentService: contentService,
    UrlFetchApp: urlFetchApp,
    MailApp: {
      getRemainingDailyQuota: () => mailState.quota,
      sendEmail: (message) => {
        if (mailState.failAll) throw new Error(mailState.errorMessage);
        mails.push(message);
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => (properties.has(key) ? properties.get(key) : null),
        setProperty: (key, value) => properties.set(key, String(value)),
        deleteProperty: (key) => properties.delete(key),
        getProperties: () => Object.fromEntries(properties),
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => (cache.has(key) ? cache.get(key) : null),
        put: (key, value) => cache.set(key, value),
        remove: (key) => cache.delete(key),
      }),
    },
    LockService: {
      getScriptLock: () => ({ waitLock: () => undefined, releaseLock: () => undefined }),
    },
    ScriptApp: scriptApp,
    Utilities: utilities,
    Logger: { log: () => undefined },
  };
  context.globalThis = context;

  const source = fs.readFileSync(
    path.join(repoRoot, "scripts/google-apps-script/trends-sheets.gs"),
    "utf8",
  );
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "trends-sheets.gs" });

  return { book, context, mails, mailState, fetches, alerts, triggers, cache, properties, range };
}

/** seed data (ProductList / Settings) ek hi jagah */
export const SELFTEST_MASTER_TOKEN = "master-token-for-tests";

export function seedProductList(book, rows) {
  const sheet = book.getSheetByName("ProductList") ?? book.insertSheet("ProductList");
  sheet.clear();
  sheet.getRange(1, 1, 1, 10).setValues([
    ["ID", "Handle", "Title", "Price", "MRP", "Main Image", "Images", "Image count", "Collections", "URL"],
  ]);
  if (!rows.length) return;
  sheet.getRange(2, 1, rows.length, 10).setValues(rows);
}
