import { describe, it, expect } from 'vitest';
import type { TradeRecord } from '../types';
import { dataHealth } from './dataHealth';

function trade(p: Partial<TradeRecord>): TradeRecord {
  return {
    rowNumber: 0, date: '2025-01-06', entryTime: null, exitTime: null, tradeNumber: 1, duration: null,
    direction: '', symbol: '', entryPrice: 0, exitPrice: 0, size: 0,
    profitLoss: 0, setup: '', reasonEmotion: '', runningPnl: 0, note: '', ...p,
  };
}

describe('dataHealth', () => {
  it('reports zeros for an empty set', () => {
    const h = dataHealth([]);
    expect(h.count).toBe(0);
    expect(h.start).toBeNull();
    expect(h.coverage.symbol).toBe(0);
  });

  it('computes date range, symbols and coverage', () => {
    const h = dataHealth([
      trade({ date: '2025-01-02', symbol: 'MES', direction: 'LONG', size: 1, profitLoss: 10 }),
      trade({ date: '2025-03-09', symbol: 'NQ', size: 2, profitLoss: -5 }),
    ]);
    expect(h.count).toBe(2);
    expect(h.start).toBe('2025-01-02');
    expect(h.end).toBe('2025-03-09');
    expect(h.symbols).toBe(2);
    expect(h.coverage.symbol).toBe(1);
    expect(h.coverage.direction).toBe(0.5);
    expect(h.coverage.setup).toBe(0);
  });

  it('counts exact-duplicate rows that would be merged', () => {
    const t = { date: '2025-01-02', symbol: 'MES', direction: 'LONG', size: 1, profitLoss: 10 };
    const h = dataHealth([trade(t), trade(t), trade({ ...t, profitLoss: 20 })]);
    expect(h.duplicates).toBe(1);
  });
});
