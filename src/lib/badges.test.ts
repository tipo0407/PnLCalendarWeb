import { describe, it, expect } from 'vitest';
import type { DailyPnl, TradeRecord } from '../types';
import { earnedBadges, type BadgeInput } from './badges';

function day(date: string, pnl: number, trades: TradeRecord[] = []): DailyPnl {
  return { date, pnl, tradeCount: trades.length, wins: 0, losses: 0, trades };
}

function cleanDays(n: number, pnl: number): DailyPnl[] {
  return Array.from({ length: n }, (_, i) => day(`2025-01-${String(i + 1).padStart(2, '0')}`, pnl));
}

const base: BadgeInput = {
  winStreak: 0, reviewStreak: 0, days: [], monthPnl: 0, goalMet: false,
};

describe('earnedBadges', () => {
  it('returns nothing for a blank record', () => {
    expect(earnedBadges(base)).toEqual([]);
  });

  it('awards a streak badge at 3+ green days', () => {
    const b = earnedBadges({ ...base, winStreak: 4 });
    expect(b.some((x) => x.id === 'streak')).toBe(true);
  });

  it('awards a discipline badge for clean days', () => {
    const b = earnedBadges({ ...base, days: cleanDays(6, 100) });
    expect(b.some((x) => x.id === 'disciplined')).toBe(true);
  });

  it('awards reviewer and goal badges', () => {
    const b = earnedBadges({ ...base, reviewStreak: 3, goalMet: true });
    expect(b.some((x) => x.id === 'reviewer')).toBe(true);
    expect(b.some((x) => x.id === 'goal')).toBe(true);
  });

  it('awards a consistency badge for >=60% green over 10+ days', () => {
    const days = [...cleanDays(7, 50), ...Array.from({ length: 3 }, (_, i) => day(`2025-02-0${i + 1}`, -20))];
    const b = earnedBadges({ ...base, days });
    expect(b.some((x) => x.id === 'consistent')).toBe(true);
  });
});
