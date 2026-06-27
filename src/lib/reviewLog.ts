/** Tracks which weeks the trader has marked "reviewed", persisted per profile. */

import { profileKey, PROFILE_EVENT } from './profiles';

const BASE_KEY = 'pnlcalendar.reviewed.v1';
const keyName = () => profileKey(BASE_KEY);
export const REVIEW_LOG_EVENT = 'pnlcalendar:reviewlog';

let cache: Set<string> | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener(PROFILE_EVENT, () => {
    cache = null;
    window.dispatchEvent(new Event(REVIEW_LOG_EVENT));
  });
}

function load(): Set<string> {
  if (cache) return cache;
  try {
    const arr = JSON.parse(localStorage.getItem(keyName()) || '[]') as string[];
    cache = new Set(Array.isArray(arr) ? arr : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

function persist() {
  try { localStorage.setItem(keyName(), JSON.stringify([...(cache ?? [])])); } catch { /* ignore */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REVIEW_LOG_EVENT));
}

export function isReviewed(weekKey: string): boolean {
  return load().has(weekKey);
}

/** All reviewed week keys for the active profile (backup). */
export function exportReviewed(): string[] {
  return [...load()];
}

/** Replace reviewed week keys for the active profile (restore). */
export function importReviewed(keys: string[]) {
  cache = new Set(Array.isArray(keys) ? keys : []);
  persist();
}
