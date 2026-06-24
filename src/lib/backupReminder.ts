/**
 * Local-only "back up your data" nudge. The app is local-first, so if the user
 * never syncs to the cloud their journal lives only in this browser. This module
 * tracks when they last exported a backup and decides when to gently remind them
 * — purely client-side, dismissible, never nagging more than necessary.
 */

const LAST_KEY = 'pnlcalendar.lastBackup.v1';
const SNOOZE_KEY = 'pnlcalendar.backupSnooze.v1';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Record that a backup was just exported. */
export function markBackedUp(now: number = Date.now()): void {
  try { localStorage.setItem(LAST_KEY, String(now)); } catch { /* ignore */ }
}

export function getLastBackup(): number | null {
  try {
    const v = localStorage.getItem(LAST_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

/** Snooze the nudge until `days` from now. */
export function snoozeBackup(days = 7, now: number = Date.now()): void {
  try { localStorage.setItem(SNOOZE_KEY, String(now + days * DAY_MS)); } catch { /* ignore */ }
}

function snoozedUntil(): number {
  try {
    const v = localStorage.getItem(SNOOZE_KEY);
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

/**
 * Pure decision: should we nudge the user to back up? True when they have data,
 * aren't snoozed, and either never backed up (and have been using it past the
 * grace period) or last backup is older than `intervalDays`.
 */
export function shouldNudgeBackup(opts: {
  hasTrades: boolean;
  signedIn: boolean;
  lastBackup: number | null;
  firstSeen: number | null;
  snoozeUntil: number;
  now: number;
  intervalDays?: number;
  graceDays?: number;
}): boolean {
  const interval = (opts.intervalDays ?? 14) * DAY_MS;
  const grace = (opts.graceDays ?? 3) * DAY_MS;
  // Cloud-synced users don't need local file backups as urgently.
  if (!opts.hasTrades || opts.signedIn) return false;
  if (opts.now < opts.snoozeUntil) return false;
  if (opts.lastBackup != null) return opts.now - opts.lastBackup >= interval;
  // Never backed up: wait out a short grace period after first use.
  if (opts.firstSeen == null) return false;
  return opts.now - opts.firstSeen >= grace;
}

/** Convenience wrapper reading from localStorage. */
export function backupNudgeDue(hasTrades: boolean, signedIn: boolean, firstSeen: number | null, now: number = Date.now()): boolean {
  return shouldNudgeBackup({
    hasTrades, signedIn,
    lastBackup: getLastBackup(),
    firstSeen,
    snoozeUntil: snoozedUntil(),
    now,
  });
}
