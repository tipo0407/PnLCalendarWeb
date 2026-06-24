import { describe, it, expect } from 'vitest';
import { nextReminder, type ReminderInput } from './reminders';

const base: ReminderInput = {
  now: new Date(2025, 2, 5), // Wed Mar 5 2025
  lastTradeDate: '2025-03-05',
  lastTradePnl: -120,
  lastTradeCount: 3,
  lastWeekKey: '2025-02-24',
  lastWeekPnl: 450,
  lastWeekWinRate: 0.6,
  lastWeekReviewed: false,
};

describe('nextReminder', () => {
  it('nudges a daily review on a weekday with unreviewed trades', () => {
    const r = nextReminder(base);
    expect(r?.kind).toBe('daily-review');
    expect(r?.dismissKey).toBe('daily:2025-03-05');
    expect(r?.count).toBe(3);
  });

  it('prioritizes the weekly summary on Monday when last week is unreviewed', () => {
    const r = nextReminder({ ...base, now: new Date(2025, 2, 3) }); // Mon
    expect(r?.kind).toBe('weekly-summary');
    expect(r?.weekKey).toBe('2025-02-24');
    expect(r?.pnl).toBe(450);
  });

  it('falls back to daily nudge on a weekend when last week is already reviewed', () => {
    const r = nextReminder({ ...base, now: new Date(2025, 2, 1), lastWeekReviewed: true }); // Sat
    expect(r?.kind).toBe('daily-review');
  });

  it('returns null when there is nothing to review', () => {
    const r = nextReminder({
      ...base,
      now: new Date(2025, 2, 5),
      lastTradeDate: null,
      lastTradeCount: 0,
      lastWeekReviewed: true,
    });
    expect(r).toBeNull();
  });
});
