import { describe, it, expect } from 'vitest';
import type { TradeRecord } from '../types';
import { sizePerformance } from './sizeAnalysis';

function trade(size: number, pnl: number): TradeRecord {
  return {
    rowNumber: 0, date: '2025-01-06', entryTime: null, exitTime: null, tradeNumber: 1, duration: null,
    direction: 'LONG', symbol: 'MES', entryPrice: 0, exitPrice: 0, size,
    profitLoss: pnl, setup: '', reasonEmotion: '', runningPnl: 0, note: '',
  };
}

describe('sizePerformance', () => {
  it('buckets trades by size and computes per-bucket stats', () => {
    const trades = [
      trade(1, 50), trade(1, -20),     // size 1 bucket
      trade(3, 100), trade(2, -30),    // 2–3 bucket
      trade(12, -200),                 // 10+ bucket
    ];
    const b = sizePerformance(trades);
    const one = b.find((x) => x.label === '1')!;
    expect(one.trades).toBe(2);
    expect(one.net).toBe(30);
    expect(one.winRate).toBe(0.5);
    const big = b.find((x) => x.label === '10+')!;
    expect(big.net).toBe(-200);
    expect(big.expectancy).toBe(-200);
  });

  it('ignores trades without a usable size', () => {
    const b = sizePerformance([trade(0, 100), trade(1, 50)]);
    expect(b.reduce((s, x) => s + x.trades, 0)).toBe(1);
  });

  it('returns only non-empty buckets', () => {
    const b = sizePerformance([trade(1, 10), trade(1, 20)]);
    expect(b).toHaveLength(1);
    expect(b[0].label).toBe('1');
  });
});
