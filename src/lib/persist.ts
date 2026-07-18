import type { TradeRecord } from '../types';
import { getActiveProfileId, profileTradesKey } from './profiles';
import * as storage from './safeStorage';

function key(): string {
  return profileTradesKey(getActiveProfileId());
}

/** Persist the loaded trades locally so they survive a reload (local-first). */
export function savePersistedTrades(trades: TradeRecord[]): void {
  storage.setJSON(key(), trades);
}

export function loadPersistedTrades(): TradeRecord[] | null {
  const arr = storage.getJSON<TradeRecord[] | null>(key(), null);
  return Array.isArray(arr) ? arr : null;
}

export function clearPersistedTrades(): void {
  storage.removeItem(key());
}
