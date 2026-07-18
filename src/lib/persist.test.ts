import { describe, it, expect, beforeEach } from 'vitest';
import type { TradeRecord } from '../types';
import { savePersistedTrades, loadPersistedTrades, clearPersistedTrades } from './persist';

function trade(p: Partial<TradeRecord>): TradeRecord {
  return {
    rowNumber: 1, date: '2025-06-02', entryTime: null, exitTime: null, tradeNumber: 1,
    duration: null, direction: 'LONG', symbol: 'MES', entryPrice: 0, exitPrice: 0, size: 1,
    profitLoss: 10, setup: '', reasonEmotion: '', runningPnl: 0, note: '', ...p,
  };
}

describe('persist', () => {
  beforeEach(() => clearPersistedTrades());

  it('returns null when nothing is stored', () => {
    expect(loadPersistedTrades()).toBeNull();
  });

  it('round-trips trades', () => {
    savePersistedTrades([trade({ profitLoss: 42 })]);
    const loaded = loadPersistedTrades();
    expect(loaded).not.toBeNull();
    expect(loaded).toHaveLength(1);
    expect(loaded![0].profitLoss).toBe(42);
  });

  it('clears stored trades', () => {
    savePersistedTrades([trade({})]);
    clearPersistedTrades();
    expect(loadPersistedTrades()).toBeNull();
  });
});
