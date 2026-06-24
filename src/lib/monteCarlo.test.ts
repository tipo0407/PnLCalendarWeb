import { describe, it, expect } from 'vitest';
import type { TradeRecord } from '../types';
import { monteCarlo } from './monteCarlo';

function trade(pnl: number, i: number): TradeRecord {
  return {
    rowNumber: i, date: '2025-01-06', entryTime: null, exitTime: null, tradeNumber: i, duration: null,
    direction: 'LONG', symbol: 'MES', entryPrice: 0, exitPrice: 0, size: 1,
    profitLoss: pnl, setup: '', reasonEmotion: '', runningPnl: 0, note: '',
  };
}

describe('monteCarlo', () => {
  it('returns null for too few trades', () => {
    expect(monteCarlo([trade(10, 0)])).toBeNull();
  });

  it('is deterministic for a fixed seed', () => {
    const trades = [10, -5, 20, -8, 15, -12, 30].map((p, i) => trade(p, i));
    const a = monteCarlo(trades, { runs: 200, seed: 7 });
    const b = monteCarlo(trades, { runs: 200, seed: 7 });
    expect(a).toEqual(b);
  });

  it('a positive-edge system is usually profitable with bounded drawdown', () => {
    const trades = Array.from({ length: 20 }, (_, i) => trade(i % 2 === 0 ? 100 : -40, i));
    const m = monteCarlo(trades, { runs: 500, seed: 1 })!;
    expect(m.probProfit).toBeGreaterThan(0.8);
    expect(m.medianFinal).toBeGreaterThan(0);
    expect(m.medianMaxDrawdown).toBeLessThanOrEqual(0);
    expect(m.p5Final).toBeLessThanOrEqual(m.p95Final);
  });

  it('tracks risk of ruin against a threshold', () => {
    // A losing system should frequently hit a small ruin threshold.
    const trades = Array.from({ length: 20 }, (_, i) => trade(i % 3 === 0 ? 50 : -50, i));
    const m = monteCarlo(trades, { runs: 500, seed: 2, ruinThreshold: 200 })!;
    expect(m.riskOfRuin).toBeGreaterThan(0);
    expect(m.riskOfRuin).toBeLessThanOrEqual(1);
  });
});
