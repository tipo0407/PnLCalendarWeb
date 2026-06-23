import { describe, it, expect } from 'vitest';
import type { DailyPnl } from '../types';
import { dayStreaks, monthProgress } from './goals';

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
