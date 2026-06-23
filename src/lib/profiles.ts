/**
 * Named local profiles, each an isolated trade dataset (e.g. "Funded", "Personal",
 * "Backtest"). Only the trades store is namespaced per profile; preferences stay
 * global. The "default" profile keeps the original storage key for back-compat.
 */

export interface Profile {
  id: string;
  name: string;
}

const LIST_KEY = 'pnlcalendar.profiles.v1';
const ACTIVE_KEY = 'pnlcalendar.activeProfile.v1';
export const PROFILE_EVENT = 'pnlcalendar:profile';

export const DEFAULT_PROFILE: Profile = { id: 'default', name: 'Default' };

function readList(): Profile[] {
  try {
    const arr = JSON.parse(localStorage.getItem(LIST_KEY) || '[]') as Profile[];
    if (Array.isArray(arr) && arr.length > 0) return arr;
  } catch {
    /* ignore */
  }
  return [DEFAULT_PROFILE];
}

function writeList(list: Profile[]) {
  try { localStorage.setItem(LIST_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROFILE_EVENT));
}

export function listProfiles(): Profile[] {
  return readList();
}

export function getActiveProfileId(): string {
  try {
    const id = localStorage.getItem(ACTIVE_KEY);
    if (id && readList().some((p) => p.id === id)) return id;
  } catch {
    /* ignore */
  }
  return DEFAULT_PROFILE.id;
}

export function getActiveProfile(): Profile {
  const id = getActiveProfileId();
  return readList().find((p) => p.id === id) ?? DEFAULT_PROFILE;
}

export function setActiveProfile(id: string) {
  if (!readList().some((p) => p.id === id)) return;
  try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* ignore */ }
  emit();
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'profile';
}

export function createProfile(name: string): Profile {
  const list = readList();
  const base = slug(name);
  let id = base;
  let i = 1;
  while (list.some((p) => p.id === id)) id = `${base}-${i++}`;
  const profile = { id, name: name.trim() || id };
  writeList([...list, profile]);
  emit();
  return profile;
}

export function renameProfile(id: string, name: string) {
  writeList(readList().map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)));
  emit();
}

/** Delete a profile (never the last one). Returns the id to switch to if needed. */
export function deleteProfile(id: string): string {
  const list = readList();
  if (list.length <= 1) return getActiveProfileId();
  const next = list.filter((p) => p.id !== id);
  writeList(next);
  let active = getActiveProfileId();
  if (active === id) {
    active = next[0].id;
    setActiveProfile(active);
  }
  // Drop the deleted profile's trades.
  try { localStorage.removeItem(profileTradesKey(id)); } catch { /* ignore */ }
  emit();
  return active;
}

const TRADES_BASE = 'pnlcalendar.trades.v1';

/** Storage key for a profile's trades ('default' keeps the legacy key). */
export function profileTradesKey(id: string): string {
  return id === DEFAULT_PROFILE.id ? TRADES_BASE : `${TRADES_BASE}::${id}`;
}

/** Namespace any base storage key by the active profile (default keeps base). */
export function profileKey(base: string): string {
  const id = getActiveProfileId();
  return id === DEFAULT_PROFILE.id ? base : `${base}::${id}`;
}
