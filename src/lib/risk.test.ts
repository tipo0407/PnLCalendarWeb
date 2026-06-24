import { describe, it, expect } from 'vitest';
import type { TradeRecord } from '../types';
import { riskStats, drawdownSeries, rMultipleHistogram, drawdownDuration } from './risk';

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

describe('rMultipleHistogram', () => {
  it('returns empty when no R-multiples', () => {
    expect(rMultipleHistogram([])).toEqual([]);
  });
  it('buckets R-multiples across the fixed ranges', () => {
    const h = rMultipleHistogram([-3, -1.5, -0.5, 0.5, 1.5, 2.5, 4]);
    expect(h.map((b) => b.count)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    // Boundaries: exactly -2 goes to the lowest bucket; exactly +3 to the top.
    const edges = rMultipleHistogram([-2, 3]);
    expect(edges[0].count).toBe(1);
    expect(edges[6].count).toBe(1);
  });
});

describe('drawdownDuration', () => {
  it('measures longest underwater stretch and recovery', () => {
    // equity path via trade pnls: +100 (peak), -40, -30 (trough), +20, +60 (new peak)
    const trades = [100, -40, -30, 20, 60].map((p, i) => trade(p, i));
    // Spread dates one day apart for day math.
    trades.forEach((t, i) => { t.date = `2025-01-0${i + 1}`; });
    const dd = drawdownSeries(trades);
    const d = drawdownDuration(dd);
    expect(d.longestTrades).toBeGreaterThanOrEqual(3);
    expect(d.recovered).toBe(true);
    expect(d.recoveryTrades).toBeGreaterThanOrEqual(2);
    expect(d.recoveryDays).toBeGreaterThan(0);
  });

  it('reports an ongoing drawdown that never recovered', () => {
    const trades = [100, -50, -10].map((p, i) => trade(p, i));
    trades.forEach((t, i) => { t.date = `2025-02-0${i + 1}`; });
    const d = drawdownDuration(drawdownSeries(trades));
    expect(d.currentTrades).toBeGreaterThan(0);
    expect(d.recovered).toBe(false);
  });

  it('is all zeros with no drawdown', () => {
    const trades = [10, 20, 30].map((p, i) => trade(p, i));
    const d = drawdownDuration(drawdownSeries(trades));
    expect(d.longestTrades).toBe(0);
    expect(d.currentTrades).toBe(0);
  });
});
