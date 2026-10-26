import test from "node:test";
import assert from "node:assert/strict";
import { createLocalStore } from "../../apps/web/src/lib/local-store.ts";

/**
 * `lib/local-store.ts` — wishlist/cart jaise hisse isi par hain.
 *
 * Yahan asli `window.localStorage` ki jagah ek chhota fake lagaya hai, taaki Node me hi
 * wo sab check ho jaye jo browser me hota hai:
 *   • khaali storage par fallback
 *   • `set()` → snapshot badalta hai aur listeners ko call jaata hai
 *   • same raw value par **stable reference** (React ko yahi chahiye, warna infinite loop)
 *   • purani key (`liksha:…`) ka ek-baar migration
 *   • kharab JSON par crash nahi, fallback
 *   • dusre tab ka `storage` event
 */

type FakeWindow = {
  localStorage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  };
  addEventListener: (type: string, listener: (event: StorageEvent) => void) => void;
  removeEventListener: (type: string, listener: (event: StorageEvent) => void) => void;
};

function installWindow(seed: Record<string, string> = {}): {
  store: Map<string, string>;
  fire: (key: string, value: string) => void;
} {
  const store = new Map(Object.entries(seed));
  const listeners = new Set<(event: StorageEvent) => void>();
  const fake: FakeWindow = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key)! : null),
      setItem: (key, value) => {
        store.set(key, String(value));
      },
      removeItem: (key) => {
        store.delete(key);
      },
    },
    addEventListener: (type, listener) => {
      if (type === "storage") listeners.add(listener);
    },
    removeEventListener: (type, listener) => {
      if (type === "storage") listeners.delete(listener);
    },
  };
  (globalThis as unknown as { window: FakeWindow }).window = fake;
  return {
    store,
    fire: (key, value) => {
      store.set(key, value);
      for (const listener of listeners) listener({ key, newValue: value } as StorageEvent);
    },
  };
}

const parseHandles = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];

test("local-store: khaali storage par fallback", () => {
  installWindow();
  const store = createLocalStore<string[]>({ key: "k", fallback: [], parse: parseHandles });
  assert.deepEqual(store.getSnapshot(), []);
  assert.deepEqual(store.getServerSnapshot(), []);
});

test("local-store: set() snapshot badalta hai aur listener chalta hai", () => {
  const win = installWindow();
  const store = createLocalStore<string[]>({ key: "k", fallback: [], parse: parseHandles });
  let calls = 0;
  const unsubscribe = store.subscribe(() => {
    calls += 1;
  });

  store.set(["a", "b"]);
  assert.deepEqual(store.getSnapshot(), ["a", "b"]);
  assert.equal(win.store.get("k"), '["a","b"]');
  assert.equal(calls, 1);

  // functional update
  store.set((current) => [...current, "c"]);
  assert.deepEqual(store.getSnapshot(), ["a", "b", "c"]);
  assert.equal(calls, 2);

  unsubscribe();
  store.set(["z"]);
  assert.equal(calls, 2, "unsubscribe ke baad listener nahi chalna chahiye");
});

test("local-store: same data par snapshot ka reference same rehta hai (React requirement)", () => {
  installWindow({ k: '["a"]' });
  const store = createLocalStore<string[]>({ key: "k", fallback: [], parse: parseHandles });
  const first = store.getSnapshot();
  const second = store.getSnapshot();
  assert.equal(first, second, "har read par naya array banega to React infinite loop me chala jayega");
});

test("local-store: purani key (legacy) ka data ek baar migrate hota hai", () => {
  const win = installWindow({ "liksha:wishlist:v1": '["old-1","old-2"]' });
  const store = createLocalStore<string[]>({
    key: "trends:wishlist:v1",
    legacyKey: "liksha:wishlist:v1",
    fallback: [],
    parse: parseHandles,
  });
  const unsubscribe = store.subscribe(() => undefined);
  assert.deepEqual(store.getSnapshot(), ["old-1", "old-2"]);
  assert.equal(win.store.get("trends:wishlist:v1"), '["old-1","old-2"]');
  assert.equal(win.store.has("liksha:wishlist:v1"), false, "purani key hatni chahiye");
  unsubscribe();
});

test("local-store: kharab JSON par crash nahi, fallback milta hai", () => {
  installWindow({ k: "{not json" });
  const store = createLocalStore<string[]>({ key: "k", fallback: [], parse: parseHandles });
  assert.deepEqual(store.getSnapshot(), []);
});

test("local-store: dusre tab ka storage event refresh karta hai", () => {
  const win = installWindow({ k: '["a"]' });
  const store = createLocalStore<string[]>({ key: "k", fallback: [], parse: parseHandles });
  let calls = 0;
  const unsubscribe = store.subscribe(() => {
    calls += 1;
  });
  assert.deepEqual(store.getSnapshot(), ["a"]);

  win.fire("k", '["a","b"]');
  assert.equal(calls, 1);
  assert.deepEqual(store.getSnapshot(), ["a", "b"]);
  unsubscribe();
});

test("collection-filters: URL se sort/price padhna aur wapas likhna", async () => {
  const { parseCollectionFilters, collectionFiltersQuery, isDefaultFilters } = await import(
    "../../apps/web/src/lib/collection-filters.ts"
  );

  assert.deepEqual(parseCollectionFilters(""), { sort: "featured", price: "all" });
  assert.deepEqual(parseCollectionFilters("?sort=price-low&price=under-500"), {
    sort: "price-low",
    price: "under-500",
  });
  assert.deepEqual(parseCollectionFilters("?sort=%20&price="), { sort: "featured", price: "all" });
  assert.equal(isDefaultFilters({ sort: "featured", price: "all" }), true);
  assert.equal(isDefaultFilters({ sort: "new", price: "all" }), false);
  assert.equal(collectionFiltersQuery({ sort: "featured", price: "all" }), "");
  assert.equal(collectionFiltersQuery({ sort: "price-high", price: "under-1000" }), "?sort=price-high&price=under-1000");
});
