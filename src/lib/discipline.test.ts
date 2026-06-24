import { describe, it, expect } from 'vitest';
import type { DailyPnl, TradeRecord } from '../types';
import { disciplineTrend, dayDiscipline } from './discipline';

function trade(p: Partial<TradeRecord>): TradeRecord {
  return {
    rowNumber: 0, date: '2025-01-06', entryTime: 8 * 3600, exitTime: null,
    tradeNumber: 1, duration: null, direction: 'LONG', symbol: 'MES',
    entryPrice: 0, exitPrice: 0, size: 1, profitLoss: 0, setup: 'Breakout',
    reasonEmotion: '', runningPnl: 0, note: '', ...p,
  };
}

function day(date: string, trades: TradeRecord[]): DailyPnl {
  return { date, pnl: 0, tradeCount: trades.length, wins: 0, losses: 0, trades };
}

// Group everything into one bucket vs distinct buckets via a stub week key.
const weekOfMonth = (d: string) => d.slice(0, 7); // YYYY-MM as the "week"

describe('disciplineTrend', () => {
  it('buckets by the provided key and averages, oldest first', () => {
    const days = [
      day('2025-01-06', [trade({ reasonEmotion: 'clean' })]),                 // 100
      day('2025-02-03', [trade({ reasonEmotion: 'revenge trade, no stop' })]), // deductions
    ];
    const pts = disciplineTrend(days, weekOfMonth);
    expect(pts.map((p) => p.week)).toEqual(['2025-01', '2025-02']);
    expect(pts[0].score).toBe(100);
    expect(pts[1].score).toBeLessThan(100);
    expect(pts[1].days).toBe(1);
  });

  it('a clean low-volume day scores 100', () => {
    expect(dayDiscipline(day('2025-01-06', [trade({})]))).toBe(100);
  });
});
