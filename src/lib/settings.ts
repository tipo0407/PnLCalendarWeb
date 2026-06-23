/** User preferences, persisted locally. Read synchronously across the app. */

export interface Settings {
  /** Currency symbol shown before money values. */
  currency: string;
  /** Starting account balance (for equity baseline & drawdown %). */
  accountSize: number;
  /** Typical risk per trade in account currency (for R-multiples). 0 = off. */
  riskPerTrade: number;
  /** Week start: 0 = Sunday, 1 = Monday. */
  weekStart: 0 | 1;
  /** Monthly net P&L goal (account currency). 0 = no goal. */
  monthlyGoal: number;
}

export const DEFAULT_SETTINGS: Settings = {
  currency: '$',
  accountSize: 0,
  riskPerTrade: 0,
  weekStart: 1,
  monthlyGoal: 0,
};

const KEY = 'pnlcalendar.settings.v1';
export const SETTINGS_EVENT = 'pnlcalendar:settings';

let current: Settings | null = null;

export function getSettings(): Settings {
  if (current) return current;
  try {
    current = { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Settings>) };
  } catch {
    current = { ...DEFAULT_SETTINGS };
  }
  return current;
}

export function saveSettings(patch: Partial<Settings>) {
  current = { ...getSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

export function currencySymbol(): string {
  return getSettings().currency || '$';
}
