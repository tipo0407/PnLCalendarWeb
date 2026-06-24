import { describe, it, expect } from 'vitest';
import type { DailyPnl } from '../types';
import { buildYearHeatmap } from './yearHeatmap';

function day(date: string, pnl: number): DailyPnl {
  return { date, pnl, tradeCount: 1, wins: pnl > 0 ? 1 : 0, losses: pnl < 0 ? 1 : 0, trades: [] };
}

describe('buildYearHeatmap', () => {
  it('aggregates totals and finds the max magnitude', () => {
    const map = new Map<string, DailyPnl>([
      ['2025-01-02', day('2025-01-02', 100)],
      ['2025-06-15', day('2025-06-15', -250)],
      ['2025-12-31', day('2025-12-31', 50)],
    ]);
    const h = buildYearHeatmap(map, 2025);
    expect(h.year).toBe(2025);
    expect(h.totalPnl).toBe(-100);
    expect(h.greenDays).toBe(2);
    expect(h.redDays).toBe(1);
    expect(h.maxAbs).toBe(250);
  });

  it('produces 7 rows per week column and marks traded days', () => {
    const map = new Map<string, DailyPnl>([['2025-03-10', day('2025-03-10', 10)]]);
    const h = buildYearHeatmap(map, 2025);
    expect(h.weeks.every((c) => c.length === 7)).toBe(true);
    const traded = h.weeks.flat().filter((c) => c.traded);
    expect(traded).toHaveLength(1);
    expect(traded[0].date).toBe('2025-03-10');
  });

  it('pads days outside the year with null dates', () => {
    const h = buildYearHeatmap(new Map(), 2025);
    const firstCol = h.weeks[0];
    // Jan 1 2025 is a Wednesday, so the first two cells (Mon, Tue) are padding.
    expect(firstCol[0].date).toBeNull();
    expect(firstCol[2].date).toBe('2025-01-01');
  });
});
