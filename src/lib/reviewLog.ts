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

export function setReviewed(weekKey: string, reviewed: boolean) {
  const c = load();
  if (reviewed) c.add(weekKey); else c.delete(weekKey);
  persist();
}

/** Count of consecutive most-recent weeks (newest-first keys) marked reviewed. */
export function reviewStreak(weekKeysNewestFirst: string[]): number {
  const c = load();
  let n = 0;
  for (const k of weekKeysNewestFirst) {
    if (c.has(k)) n++; else break;
  }
  return n;
}

export function reviewedCount(): number {
  return load().size;
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
