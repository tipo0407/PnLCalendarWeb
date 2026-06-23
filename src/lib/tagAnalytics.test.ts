import { describe, it, expect } from 'vitest';
import type { TradeRecord } from '../types';
import { tagTrend, tagCooccurrence } from './tagAnalytics';

function trade(p: Partial<TradeRecord>): TradeRecord {
  return {
    rowNumber: 0, date: '2025-01-06', entryTime: null, exitTime: null,
    tradeNumber: 1, duration: null, direction: 'LONG', symbol: 'MES',
    entryPrice: 0, exitPrice: 0, size: 1, profitLoss: 0, setup: '',
    reasonEmotion: '', runningPnl: 0, note: '', ...p,
  };
}

describe('tagTrend', () => {
  it('counts mistake tags per month', () => {
    const trend = tagTrend([
      trade({ date: '2025-01-06', reasonEmotion: 'fomo' }),
      trade({ date: '2025-01-20', reasonEmotion: 'fomo' }),
      trade({ date: '2025-02-03', reasonEmotion: 'fomo, revenge' }),
    ]);
    expect(trend.months).toEqual(["Jan '25", "Feb '25"]);
    const fomo = trend.series.find((s) => s.label === 'FOMO')!;
    expect(fomo.counts).toEqual([2, 1]);
  });
});

describe('tagCooccurrence', () => {
  it('finds tag pairs on the same trade', () => {
    const pairs = tagCooccurrence([
      trade({ reasonEmotion: 'fomo, oversize', profitLoss: -100 }),
      trade({ reasonEmotion: 'fomo, oversize', profitLoss: -50 }),
      trade({ reasonEmotion: 'fomo', profitLoss: -10 }),
    ]);
    expect(pairs.length).toBeGreaterThan(0);
    const top = pairs[0];
    expect(top.count).toBe(2);
    expect(top.pnl).toBe(-150);
    expect([top.labelA, top.labelB].sort()).toEqual(['FOMO', 'Oversize']);
  });
});
