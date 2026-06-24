/**
 * Opt-in browser notifications for the daily review reminder. Strictly local and
 * permission-gated: nothing fires unless the user explicitly enables it and the
 * browser grants permission. We de-dupe so at most one nudge is shown per day,
 * mirroring the in-app reminder's "never nag twice" behavior.
 */

const ENABLED_KEY = 'pnlcalendar.notify.enabled.v1';
const LAST_KEY = 'pnlcalendar.notify.lastDay.v1';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationsEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1'
      && notificationsSupported()
      && Notification.permission === 'granted';
  } catch {
    return false;
  }
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

/** Ask the browser for permission and remember the opt-in. Returns true if on. */
export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  let perm = Notification.permission;
  if (perm === 'default') {
    try { perm = await Notification.requestPermission(); } catch { return false; }
  }
  const ok = perm === 'granted';
  try { localStorage.setItem(ENABLED_KEY, ok ? '1' : '0'); } catch { /* ignore */ }
  return ok;
}

export function disableNotifications(): void {
  try { localStorage.setItem(ENABLED_KEY, '0'); } catch { /* ignore */ }
}

/** True when a notification for `dayKey` has already been shown. */
export function alreadyNotified(dayKey: string): boolean {
  try { return localStorage.getItem(LAST_KEY) === dayKey; } catch { return false; }
}

/**
 * Show the daily review notification once per `dayKey`. No-op when disabled,
 * unsupported, already shown today, or the tab is currently focused (the in-app
 * banner already covers that case). Returns true if a notification was shown.
 */
export function notifyDailyReview(dayKey: string, title: string, body: string): boolean {
  if (!notificationsEnabled() || alreadyNotified(dayKey)) return false;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return false;
  try {
    new Notification(title, { body, tag: `pnlcal-review-${dayKey}` });
    localStorage.setItem(LAST_KEY, dayKey);
    return true;
  } catch {
    return false;
  }
}
