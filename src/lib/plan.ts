/**
 * Local plan / entitlement state. The app is local-first, so "Pro" is unlocked
 * with a license key (or the demo key) rather than a server check. This module
 * is the single source of truth for what tier the user is on.
 */

export type Plan = 'free' | 'pro';

const KEY = 'pnlcalendar.plan.v1';
export const PLAN_EVENT = 'pnlcalendar:plan';

/** Offline demo key so reviewers/early users can try Pro features. */
export const DEMO_KEY = 'PNLCAL-PRO-DEMO';

interface PlanState {
  plan: Plan;
  key?: string;
  since?: string;
}

let cache: PlanState | null = null;

function load(): PlanState {
  if (cache) return cache;
  try {
    cache = { plan: 'free', ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<PlanState>) };
  } catch {
    cache = { plan: 'free' };
  }
  return cache;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache ?? { plan: 'free' }));
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PLAN_EVENT));
}

export function getPlan(): Plan {
  return load().plan;
}

export function isPro(): boolean {
  return load().plan === 'pro';
}

/** A license key is valid if it's the demo key or matches the PNLCAL-XXXX-XXXX shape. */
export function isValidKey(key: string): boolean {
  const k = key.trim().toUpperCase();
  if (k === DEMO_KEY) return true;
  return /^PNLCAL(-[A-Z0-9]{4,}){2,}$/.test(k);
}

/** Activate Pro with a license key. Returns true on success. */
export function activatePro(key: string): boolean {
  if (!isValidKey(key)) return false;
  cache = { plan: 'pro', key: key.trim().toUpperCase(), since: new Date().toISOString() };
  persist();
  return true;
}

export function deactivatePro() {
  cache = { plan: 'free' };
  persist();
}

export function planKey(): string | undefined {
  return load().key;
}
