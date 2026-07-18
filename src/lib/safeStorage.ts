/**
 * Safe localStorage wrapper. Never throws: if the browser blocks web storage
 * (privacy mode, disabled cookies, storage-disabled, or a sandboxed iframe) it
 * transparently falls back to an in-memory store so the app keeps working for
 * the current session instead of crashing at startup. JSON helpers also tolerate
 * corrupt/parse-failing values by returning a caller-provided fallback.
 */

const memory = new Map<string, string>();
let localOk: boolean | null = null;

/** Detect (once) whether window.localStorage is usable. */
function canUseLocal(): boolean {
  if (localOk !== null) return localOk;
  try {
    if (typeof window === 'undefined' || !window.localStorage) throw new Error('no localStorage');
    const probe = '__pnlcal_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    localOk = true;
  } catch {
    localOk = false;
  }
  return localOk;
}

export function getItem(key: string): string | null {
  if (canUseLocal()) {
    try {
      const v = window.localStorage.getItem(key);
      if (v !== null) return v;
    } catch {
      /* fall back to memory */
    }
  }
  return memory.has(key) ? memory.get(key)! : null;
}

export function setItem(key: string, value: string): void {
  if (canUseLocal()) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch {
      /* quota exceeded or blocked mid-session -> keep in memory */
    }
  }
  memory.set(key, value);
}

export function removeItem(key: string): void {
  memory.delete(key);
  if (canUseLocal()) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/** Parse a stored JSON value, returning `fallback` when missing or corrupt. */
export function getJSON<T>(key: string, fallback: T): T {
  const raw = getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Serialize and store a JSON value; never throws. */
export function setJSON(key: string, value: unknown): void {
  try {
    setItem(key, JSON.stringify(value));
  } catch {
    /* ignore serialization errors */
  }
}
