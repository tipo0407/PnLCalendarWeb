import { describe, it, expect } from 'vitest';
import type { DailyPnl } from '../types';
import { streakStats } from './streaks';

function day(date: string, pnl: number): DailyPnl {
  return { date, pnl, tradeCount: 1, wins: pnl > 0 ? 1 : 0, losses: pnl < 0 ? 1 : 0, trades: [] };
}

describe('streakStats', () => {
  it('finds max and average run lengths', () => {
    // W W W L L W L  -> win runs: [3,1], loss runs: [2,1]
    const days = [
      day('2025-01-01', 5), day('2025-01-02', 5), day('2025-01-03', 5),
      day('2025-01-06', -5), day('2025-01-07', -5),
      day('2025-01-08', 5), day('2025-01-09', -5),
    ];
    const s = streakStats(days);
    expect(s.maxWinStreak).toBe(3);
    expect(s.maxLossStreak).toBe(2);
    expect(s.winRuns).toEqual({ 1: 1, 3: 1 });
    expect(s.lossRuns).toEqual({ 1: 1, 2: 1 });
    expect(s.avgWinStreak).toBe(2);
    expect(s.avgLossStreak).toBe(1.5);
  });

  it('flat days break a streak', () => {
    const days = [day('2025-01-01', 5), day('2025-01-02', 0), day('2025-01-03', 5)];
    const s = streakStats(days);
    expect(s.winRuns).toEqual({ 1: 2 });
    expect(s.maxWinStreak).toBe(1);
  });

  it('returns zeros for empty input', () => {
    const s = streakStats([]);
    expect(s.maxWinStreak).toBe(0);
    expect(s.avgLossStreak).toBe(0);
  });
});
