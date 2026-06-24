import { describe, it, expect } from 'vitest';
import type { TradeRecord } from '../types';
import { riskStats, drawdownSeries } from './risk';

function trade(pnl: number, i: number): TradeRecord {
  return {
    rowNumber: i, date: `2025-01-${String(i + 1).padStart(2, '0')}`, entryTime: null, exitTime: null,
    tradeNumber: 1, duration: null, direction: 'LONG', symbol: 'MES',
    entryPrice: 0, exitPrice: 0, size: 1, profitLoss: pnl, setup: '',
    reasonEmotion: '', runningPnl: 0, note: '',
  };
}

describe('drawdownSeries', () => {
  it('tracks distance below the running peak', () => {
    const dd = drawdownSeries([trade(100, 0), trade(-40, 1), trade(-30, 2), trade(80, 3)]);
    expect(dd.map((p) => p.drawdown)).toEqual([0, -40, -70, 0]);
  });
  it('computes drawdown percent against account size + peak', () => {
    const dd = drawdownSeries([trade(100, 0), trade(-50, 1)], 900);
    // peak equity 100 -> base 1000, drawdown -50 -> -5%
    expect(dd[1].drawdownPct).toBeCloseTo(-5, 5);
  });
});

describe('riskStats', () => {
  it('reports max drawdown and account return', () => {
    const s = riskStats([trade(100, 0), trade(-40, 1), trade(-30, 2), trade(80, 3)], 1000);
    expect(s.maxDrawdown).toBe(-70);
    expect(s.returnPct).toBeCloseTo(11, 5); // total 110 / 1000
    expect(s.hasAccount).toBe(true);
  });
  it('computes R-multiples when risk per trade is set', () => {
    const s = riskStats([trade(200, 0), trade(-100, 1)], 0, 100);
    expect(s.hasRisk).toBe(true);
    expect(s.rMultiples).toEqual([2, -1]);
    expect(s.totalR).toBe(1);
    expect(s.avgR).toBeCloseTo(0.5, 5);
    expect(s.bestR).toBe(2);
    expect(s.worstR).toBe(-1);
  });
  it('omits R-multiples when risk is zero', () => {
    const s = riskStats([trade(50, 0)], 0, 0);
    expect(s.hasRisk).toBe(false);
    expect(s.rMultiples).toEqual([]);
  });
});


