import type { TradeRecord } from '../types';

const KEY = 'pnlcalendar.trades.v1';

/** Persist the loaded trades locally so they survive a reload (local-first). */
export function savePersistedTrades(trades: TradeRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(trades));
  } catch {
    // Quota exceeded or storage unavailable — non-fatal.
  }
}

export function loadPersistedTrades(): TradeRecord[] | null {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return null;
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? (arr as TradeRecord[]) : null;
  } catch {
    return null;
  }
}

export function clearPersistedTrades(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
