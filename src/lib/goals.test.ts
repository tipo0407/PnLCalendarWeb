import { describe, it, expect } from 'vitest';
import type { DailyPnl } from '../types';
import { dayStreaks, monthProgress, monthBenchmark, yearProgress } from './goals';

function day(date: string, pnl: number): DailyPnl {
  return { date, pnl, tradeCount: 1, wins: pnl > 0 ? 1 : 0, losses: pnl < 0 ? 1 : 0, trades: [] };
}

describe('dayStreaks', () => {
  it('finds current and best streaks', () => {
    const days = [
      day('2025-01-01', 10), day('2025-01-02', 20), day('2025-01-03', -5),
      day('2025-01-06', 5), day('2025-01-07', 8), day('2025-01-08', 12),
    ];
    const s = dayStreaks(days);
    expect(s.currentType).toBe('win');
    expect(s.current).toBe(3);
    expect(s.bestWin).toBe(3);
    expect(s.bestLoss).toBe(1);
  });
  it('reports loss streak when trailing days are negative', () => {
    const s = dayStreaks([day('2025-01-01', 10), day('2025-01-02', -5), day('2025-01-03', -8)]);
    expect(s.currentType).toBe('loss');
    expect(s.current).toBe(2);
  });
});

describe('monthBenchmark', () => {
  it('projects at pace and scores consistency', () => {
    const days = [day('2025-06-02', 100), day('2025-06-03', 100), day('2025-06-04', -50)];
    const b = monthBenchmark(days, 21);
    // avg day = 50 -> projected 1050
    expect(b.projected).toBeCloseTo(1050, 5);
    // two equal green days -> top day share 0.5 -> consistency 50
    expect(b.topDayShare).toBeCloseTo(0.5, 5);
    expect(b.consistency).toBe(50);
  });
  it('is zero with no green days', () => {
    const b = monthBenchmark([day('2025-06-02', -10)], 20);
    expect(b.consistency).toBe(0);
  });
});

describe('monthProgress', () => {
  it('sums P&L and goal percentage for the month', () => {
    const days = [day('2025-06-02', 100), day('2025-06-03', -40), day('2025-07-01', 999)];
    const p = monthProgress(days, 2025, 5, 200); // June (month index 5)
    expect(p.pnl).toBe(60);
    expect(p.greenDays).toBe(1);
    expect(p.redDays).toBe(1);
    expect(p.pct).toBeCloseTo(30, 5);
  });
});

describe('yearProgress', () => {
  it('sums P&L and progress across a calendar year', () => {
    const days = [
      day('2025-01-10', 100), day('2025-06-02', -40), day('2025-12-30', 240),
      day('2024-11-01', 999),
    ];
    const y = yearProgress(days, 2025, 600);
    expect(y.pnl).toBe(300);
    expect(y.tradeDays).toBe(3);
    expect(y.greenDays).toBe(2);
    expect(y.redDays).toBe(1);
    expect(Math.round(y.pct)).toBe(50);
  });
});
