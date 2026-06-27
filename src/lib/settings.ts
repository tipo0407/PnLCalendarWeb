/** User preferences, persisted per profile. Read synchronously across the app. */

import { profileKey, PROFILE_EVENT } from './profiles';

export interface Settings {
  /** Currency symbol shown before money values. */
  currency: string;
  /** Starting account balance (for equity baseline & drawdown %). */
  accountSize: number;
  /** Typical risk per trade in account currency (for R-multiples). 0 = off. */
  riskPerTrade: number;
  /** Week start: 0 = Sunday, 1 = Monday. */
  weekStart: 0 | 1;
  /** Opt-in: capture runtime errors locally to help diagnose crashes. */
  errorLogging: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  currency: '$',
  accountSize: 0,
  riskPerTrade: 0,
  weekStart: 1,
  errorLogging: false,
};

const BASE_KEY = 'pnlcalendar.settings.v1';
const keyName = () => profileKey(BASE_KEY);
export const SETTINGS_EVENT = 'pnlcalendar:settings';

let current: Settings | null = null;

// Settings are per-profile; reset the cache when the active profile changes.
if (typeof window !== 'undefined') {
  window.addEventListener(PROFILE_EVENT, () => {
    current = null;
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  });
}

export function getSettings(): Settings {
  if (current) return current;
  try {
    current = { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(keyName()) || '{}') as Partial<Settings>) };
  } catch {
    current = { ...DEFAULT_SETTINGS };
  }
  return current;
}

export function saveSettings(patch: Partial<Settings>) {
  current = { ...getSettings(), ...patch };
  try {
    localStorage.setItem(keyName(), JSON.stringify(current));
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SETTINGS_EVENT));
}

export function currencySymbol(): string {
  return getSettings().currency || '$';
}

/** Replace all settings (used by backup restore / reset). */
export function replaceSettings(s: Partial<Settings>) {
  current = { ...DEFAULT_SETTINGS, ...s };
  try {
    localStorage.setItem(keyName(), JSON.stringify(current));
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SETTINGS_EVENT));
}
