// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { nextReminder, loadDismissed, markDismissed, type ReminderInput } from './reminders';

const base: ReminderInput = {
  now: new Date(2025, 2, 5), // Wed Mar 5 2025
  lastTradeDate: '2025-03-05',
  lastTradePnl: -120,
  lastTradeCount: 3,
};

describe('nextReminder', () => {
  it('nudges a daily review when there are recent trades', () => {
    const r = nextReminder(base);
    expect(r?.kind).toBe('daily-review');
    expect(r?.dismissKey).toBe('daily:2025-03-05');
    expect(r?.count).toBe(3);
  });

  it('returns null when there is nothing to review', () => {
    const r = nextReminder({
      ...base,
      lastTradeDate: null,
      lastTradeCount: 0,
    });
    expect(r).toBeNull();
  });
});

describe('markDismissed', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* node env */ } });

  it('keeps recent dismissals and expires ones older than the window', () => {
    const today = new Date().toISOString().slice(0, 10);
    markDismissed(`daily:${today}`);
    markDismissed('daily:2000-01-01'); // far in the past -> pruned on next write
    markDismissed(`daily:${today}`);   // triggers pruning
    const set = loadDismissed();
    expect(set.has(`daily:${today}`)).toBe(true);
    expect(set.has('daily:2000-01-01')).toBe(false);
  });
});
