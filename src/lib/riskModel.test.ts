import { describe, it, expect } from 'vitest';
import type { TradeRecord } from '../types';
import { riskModel } from './riskModel';

function trade(pnl: number, i: number): TradeRecord {
  return {
    rowNumber: i, date: '2025-01-06', entryTime: null, exitTime: null, tradeNumber: i, duration: null,
    direction: 'LONG', symbol: 'MES', entryPrice: 0, exitPrice: 0, size: 1,
    profitLoss: pnl, setup: '', reasonEmotion: '', runningPnl: 0, note: '',
  };
}

describe('riskModel', () => {
  it('computes win rate, payoff and a positive Kelly for an edge', () => {
    // 60% win at +100, 40% loss at -50 -> payoff 2, kelly = .6 - .4/2 = .4
    const trades = [
      ...Array.from({ length: 6 }, (_, i) => trade(100, i)),
      ...Array.from({ length: 4 }, (_, i) => trade(-50, i + 6)),
    ];
    const m = riskModel(trades);
    expect(m.winRate).toBeCloseTo(0.6, 5);
    expect(m.payoff).toBeCloseTo(2, 5);
    expect(m.kelly).toBeCloseTo(0.4, 5);
    expect(m.halfKelly).toBeCloseTo(0.2, 5);
    expect(m.riskOfRuin).toBeLessThan(0.5);
    expect(m.hasEdge).toBe(true);
  });

  it('reports certain ruin and non-positive Kelly with no edge', () => {
    // 40% win at +50, 60% loss at -100 -> negative expectancy
    const trades = [
      ...Array.from({ length: 4 }, (_, i) => trade(50, i)),
      ...Array.from({ length: 6 }, (_, i) => trade(-100, i + 4)),
    ];
    const m = riskModel(trades);
    expect(m.kelly).toBeLessThanOrEqual(0);
    expect(m.riskOfRuin).toBe(1);
  });

  it('lower risk units (smaller account) raises risk of ruin', () => {
    const trades = [
      ...Array.from({ length: 6 }, (_, i) => trade(100, i)),
      ...Array.from({ length: 4 }, (_, i) => trade(-50, i + 6)),
    ];
    const tight = riskModel(trades, 5);
    const safe = riskModel(trades, 40);
    expect(tight.riskOfRuin).toBeGreaterThanOrEqual(safe.riskOfRuin);
  });
});
