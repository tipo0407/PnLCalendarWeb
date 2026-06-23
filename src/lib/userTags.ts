/**
 * Manual, user-assigned mistake & emotion tags per trade, persisted locally.
 * These complement the auto-detected tags (tags.ts / emotions.ts) and let a
 * trader override or enrich the analysis for trades whose journal text is empty
 * or ambiguous.
 */

export interface TradeTags {
  mistakes: string[];
  emotions: string[];
}

import { profileKey, PROFILE_EVENT } from './profiles';

export interface TradeTags {
  mistakes: string[];
  emotions: string[];
}

const BASE_KEY = 'pnlcalendar.usertags.v1';
const keyName = () => profileKey(BASE_KEY);
export const USER_TAGS_EVENT = 'pnlcalendar:usertags';

export function tradeTagKey(date: string, tradeNumber: number, rowNumber: number): string {
  return `${date}#${tradeNumber || rowNumber}`;
}

let cache: Record<string, TradeTags> | null = null;

// Reset the cache when the active profile changes so each profile is isolated.
if (typeof window !== 'undefined') {
  window.addEventListener(PROFILE_EVENT, () => {
    cache = null;
    window.dispatchEvent(new Event(USER_TAGS_EVENT));
  });
}

function load(): Record<string, TradeTags> {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(keyName()) || '{}') as Record<string, TradeTags>;
  } catch {
    cache = {};
  }
  return cache;
}

function persist() {
  try {
    localStorage.setItem(keyName(), JSON.stringify(cache ?? {}));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(USER_TAGS_EVENT));
}

/** A shallow copy of the whole store (key -> tags). */
export function loadUserTags(): Record<string, TradeTags> {
  return { ...load() };
}

export function getTradeTags(key: string): TradeTags {
  const t = load()[key];
  return { mistakes: t?.mistakes ?? [], emotions: t?.emotions ?? [] };
}

export function setTradeTags(key: string, tags: TradeTags) {
  const c = load();
  if (tags.mistakes.length === 0 && tags.emotions.length === 0) delete c[key];
  else c[key] = tags;
  persist();
}

export function toggleTag(key: string, kind: 'mistake' | 'emotion', tagKey: string): TradeTags {
  const cur = getTradeTags(key);
  const arr = kind === 'mistake' ? cur.mistakes : cur.emotions;
  const nextArr = arr.includes(tagKey) ? arr.filter((x) => x !== tagKey) : [...arr, tagKey];
  const next: TradeTags = kind === 'mistake'
    ? { ...cur, mistakes: nextArr }
    : { ...cur, emotions: nextArr };
  setTradeTags(key, next);
  return next;
}

export function hasAnyUserTags(): boolean {
  return Object.keys(load()).length > 0;
}

/** Replace the entire manual-tags store (used by backup restore / clear-all). */
export function replaceAllUserTags(map: Record<string, TradeTags>) {
  cache = { ...map };
  persist();
}
