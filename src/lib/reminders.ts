/**
 * Local, privacy-preserving review reminders. Pure logic so it can be unit
 * tested; the UI layer feeds it the current date, the trading history and which
 * weeks are already reviewed, and renders whatever descriptor comes back.
 *
 * No push notifications, no network — just a dismissible in-app nudge whose
 * "seen" state lives in localStorage keyed by day/week so it never nags twice.
 */

export type ReminderKind = 'daily-review' | 'weekly-summary';

export interface ReminderInput {
  /** Local "now" — only the calendar date and weekday are used. */
  now: Date;
  /** ISO date (yyyy-mm-dd) of the most recent day that has trades, or null. */
  lastTradeDate: string | null;
  /** Net P&L of that most recent trading day. */
  lastTradePnl: number;
  /** Number of trades on the most recent trading day. */
  lastTradeCount: number;
  /** Week-start key (ISO) of the most recently *completed* week, or null. */
  lastWeekKey: string | null;
  /** Net P&L of that completed week. */
  lastWeekPnl: number;
  /** Winning-day ratio (0–1) of that completed week. */
  lastWeekWinRate: number;
  /** True when the completed week has already been marked reviewed. */
  lastWeekReviewed: boolean;
}

export interface Reminder {
  kind: ReminderKind;
  /** Stable id for the dismiss record (per day / per week). */
  dismissKey: string;
  /** Pre-formatted, locale-agnostic numbers folded into the message by the UI. */
  pnl: number;
  count: number;
  winRate: number;
  weekKey: string | null;
  date: string | null;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Decide which (if any) reminder to surface. The weekly summary takes priority
 * on weekends and Mondays when last week is unreviewed; otherwise an unreviewed
 * recent trading day produces a daily nudge. Returns null when nothing is due.
 */
export function nextReminder(input: ReminderInput): Reminder | null {
  const dow = input.now.getDay(); // 0 = Sun … 6 = Sat
  const weekendOrMonday = dow === 0 || dow === 6 || dow === 1;

  if (weekendOrMonday && input.lastWeekKey && !input.lastWeekReviewed) {
    return {
      kind: 'weekly-summary',
      dismissKey: `weekly:${input.lastWeekKey}`,
      pnl: input.lastWeekPnl,
      count: 0,
      winRate: input.lastWeekWinRate,
      weekKey: input.lastWeekKey,
      date: null,
    };
  }

  if (input.lastTradeDate && input.lastTradeCount > 0) {
    return {
      kind: 'daily-review',
      dismissKey: `daily:${input.lastTradeDate}`,
      pnl: input.lastTradePnl,
      count: input.lastTradeCount,
      winRate: 0,
      weekKey: null,
      date: input.lastTradeDate,
    };
  }

  return null;
}

const DISMISS_KEY = 'pnlcalendar.reminders.dismissed.v1';

/** Read the set of dismissed reminder keys from localStorage. */
export function loadDismissed(): Set<string> {
  try {
    const arr = JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]') as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/** Persist a dismissal so the same nudge never reappears. Keeps last 60 keys. */
export function markDismissed(key: string): void {
  try {
    const set = loadDismissed();
    set.add(key);
    const trimmed = [...set].slice(-60);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

export const __test = { isoDate };
