import { describe, it, expect } from 'vitest';
import type { TradeRecord } from '../types';
import { compareMonths } from './periodCompare';

function trade(date: string, pnl: number): TradeRecord {
  return {
    rowNumber: 0, date, entryTime: null, exitTime: null, tradeNumber: 1, duration: null,
    direction: 'LONG', symbol: 'MES', entryPrice: 0, exitPrice: 0, size: 1,
    profitLoss: pnl, setup: '', reasonEmotion: '', runningPnl: 0, note: '',
  };
}

describe('compareMonths', () => {
  it('returns null for no trades', () => {
    expect(compareMonths([])).toBeNull();
  });

  it('compares the latest month vs the previous month', () => {
    const trades = [
      trade('2025-02-10', 100), trade('2025-02-20', -40), // prev: net 60, 50% win
      trade('2025-03-05', 200), trade('2025-03-15', 50),  // cur: net 250, 100% win
    ];
    const c = compareMonths(trades)!;
    expect(c.current.pnl).toBe(250);
    expect(c.previous.pnl).toBe(60);
    expect(c.deltaPnl).toBe(190);
    expect(c.current.winRate).toBe(1);
    expect(c.deltaWinRate).toBeCloseTo(0.5, 5);
    expect(c.hasPrevious).toBe(true);
  });

  it('handles a missing previous month', () => {
    const c = compareMonths([trade('2025-03-05', 100)])!;
    expect(c.hasPrevious).toBe(false);
    expect(c.previous.trades).toBe(0);
  });

  it('crosses the year boundary (Jan vs prior Dec)', () => {
    const trades = [trade('2024-12-20', 30), trade('2025-01-10', 70)];
    const c = compareMonths(trades)!;
    expect(c.current.pnl).toBe(70);
    expect(c.previous.pnl).toBe(30);
  });
});
