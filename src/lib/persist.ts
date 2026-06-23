import type { TradeRecord } from '../types';
import { getActiveProfileId, profileTradesKey } from './profiles';

function key(): string {
  return profileTradesKey(getActiveProfileId());
}

/** Persist the loaded trades locally so they survive a reload (local-first). */
export function savePersistedTrades(trades: TradeRecord[]): void {
  try {
    localStorage.setItem(key(), JSON.stringify(trades));
  } catch {
    // Quota exceeded or storage unavailable — non-fatal.
  }
}

export function loadPersistedTrades(): TradeRecord[] | null {
  try {
    const s = localStorage.getItem(key());
    if (!s) return null;
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? (arr as TradeRecord[]) : null;
  } catch {
    return null;
  }
}

export function clearPersistedTrades(): void {
  try {
    localStorage.removeItem(key());
  } catch {
    // ignore
  }
}
