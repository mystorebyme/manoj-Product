"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Chhoti external store — **localStorage** par, `useSyncExternalStore` ke liye.
 *
 * Pehle cart/wishlist jaise hisse `useEffect(() => setState(readLocal()), [])` karte the.
 * Usse do dikkat thi: (1) React "cascading render" warn karta hai, (2) har component
 * apni copy rakhta tha. Ab ek hi store hai, snapshot cached hai (React ko stable
 * reference chahiye, warna infinite loop), aur cross-tab `storage` event par bhi update
 * hota hai.
 *
 * Server snapshot hamesha `fallback` hi hota hai → hydration mismatch nahi.
 */
export type LocalStore<T> = {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  set: (next: T | ((current: T) => T)) => void;
  /** storage se dobara padho (dusre tab me badla ho) */
  reload: () => void;
};

export function createLocalStore<T>(options: {
  key: string;
  fallback: T;
  parse: (raw: unknown) => T;
  /** purani key se ek baar data migrate karne ke liye */
  legacyKey?: string;
}): LocalStore<T> {
  const { key, fallback, parse, legacyKey } = options;
  const listeners = new Set<() => void>();

  let cached: T = fallback;
  let cachedRaw: string | null | undefined; // undefined = kabhi padha nahi

  function readRaw(): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function migrateLegacy(): void {
    if (!legacyKey || typeof window === "undefined") return;
    try {
      const legacy = window.localStorage.getItem(legacyKey);
      if (!legacy) return;
      // pehli visit: purane (cloned project ke) key ka data naye key me le aao
      if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, legacy);
      window.localStorage.removeItem(legacyKey);
    } catch {
      /* private mode / quota — chhod do */
    }
  }

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function getSnapshot(): T {
    const raw = readRaw();
    if (cachedRaw !== undefined && raw === cachedRaw) return cached;
    cachedRaw = raw;
    if (raw === null) {
      cached = fallback;
      return cached;
    }
    try {
      cached = parse(JSON.parse(raw) as unknown);
    } catch {
      cached = fallback;
    }
    return cached;
  }

  const subscribe = (onChange: () => void): (() => void) => {
    listeners.add(onChange);
    migrateLegacy();
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== key) return;
      cachedRaw = undefined;
      onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  };

  const set = (next: T | ((current: T) => T)): void => {
    const current = getSnapshot();
    const value = typeof next === "function" ? (next as (current: T) => T)(current) : next;
    const raw = JSON.stringify(value);
    cached = value;
    cachedRaw = raw;
    try {
      window.localStorage.setItem(key, raw);
    } catch {
      /* quota / private mode */
    }
    notify();
  };

  return {
    subscribe,
    getSnapshot,
    getServerSnapshot: () => fallback,
    set,
    reload: () => {
      cachedRaw = undefined;
      notify();
    },
  };
}

/** store ko ek component me use karo (React ka official external-store hook) */
export function useLocalStore<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

/** store ka setter (stable reference) */
export function useLocalStoreSetter<T>(store: LocalStore<T>): (next: T | ((current: T) => T)) => void {
  return useCallback((next: T | ((current: T) => T)) => store.set(next), [store]);
}
