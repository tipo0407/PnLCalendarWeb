/**
 * Local, privacy-preserving review reminders. Pure logic so it can be unit
 * tested; the UI layer feeds it the current date, the trading history and which
 * weeks are already reviewed, and renders whatever descriptor comes back.
 *
 * No push notifications, no network — just a dismissible in-app nudge whose
 * "seen" state lives in localStorage keyed by day/week so it never nags twice.
 */

export type ReminderKind = 'daily-review';

export interface ReminderInput {
  /** Local "now" — only the calendar date is used. */
  now: Date;
  /** ISO date (yyyy-mm-dd) of the most recent day that has trades, or null. */
  lastTradeDate: string | null;
  /** Net P&L of that most recent trading day. */
  lastTradePnl: number;
  /** Number of trades on the most recent trading day. */
  lastTradeCount: number;
}

export interface Reminder {
  kind: ReminderKind;
  /** Stable id for the dismiss record (per day). */
  dismissKey: string;
  /** Pre-formatted, locale-agnostic numbers folded into the message by the UI. */
  pnl: number;
  count: number;
  date: string | null;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Nudge to journal the most recent trading day, or null when nothing is due. */
export function nextReminder(input: ReminderInput): Reminder | null {
  if (input.lastTradeDate && input.lastTradeCount > 0) {
    return {
      kind: 'daily-review',
      dismissKey: `daily:${input.lastTradeDate}`,
      pnl: input.lastTradePnl,
      count: input.lastTradeCount,
      date: input.lastTradeDate,
    };
  }

  return null;
}

const DISMISS_KEY = 'pnlcalendar.reminders.dismissed.v1';
const DISMISS_MAX_AGE_DAYS = 90;

/** Extract the yyyy-mm-dd embedded in a dismiss key (e.g. "daily:2026-06-01"). */
function keyDate(key: string): string | null {
  const m = key.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Read the set of dismissed reminder keys from localStorage. */
export function loadDismissed(): Set<string> {
  try {
    const arr = JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]') as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/**
 * Persist a dismissal so the same nudge never reappears. Prunes by age (drops
 * dated keys older than DISMISS_MAX_AGE_DAYS) rather than by count, so a recent
 * dismissal can't be evicted and re-surface just because many keys accumulated.
 */
export function markDismissed(key: string): void {
  try {
    const set = loadDismissed();
    set.add(key);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DISMISS_MAX_AGE_DAYS);
    const cutoffIso = isoDate(cutoff);
    const kept = [...set].filter((k) => {
      const d = keyDate(k);
      return d === null || d >= cutoffIso; // keep undated keys and recent dated ones
    });
    localStorage.setItem(DISMISS_KEY, JSON.stringify(kept));
  } catch {
    /* ignore */
  }
}

export const __test = { isoDate };
