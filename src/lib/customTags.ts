/**
 * User-defined custom mistake / emotion tags. These extend the built-in
 * taxonomies and are applied manually to trades (no keyword auto-detection).
 * Stored globally (the taxonomy is shared across profiles).
 */

export interface TagDef {
  key: string;
  label: string;
}

export interface CustomTags {
  mistakes: TagDef[];
  emotions: TagDef[];
}

const KEY = 'pnlcalendar.customtags.v1';
export const CUSTOM_TAGS_EVENT = 'pnlcalendar:customtags';

let cache: CustomTags | null = null;

function load(): CustomTags {
  if (cache) return cache;
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<CustomTags>;
    cache = { mistakes: data.mistakes ?? [], emotions: data.emotions ?? [] };
  } catch {
    cache = { mistakes: [], emotions: [] };
  }
  return cache;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(cache ?? { mistakes: [], emotions: [] })); } catch { /* ignore */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CUSTOM_TAGS_EVENT));
}

export function getCustomTags(): CustomTags {
  const c = load();
  return { mistakes: [...c.mistakes], emotions: [...c.emotions] };
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'tag';
}

/** Add a custom tag; returns the created def (or the existing one with same label). */
export function addCustomTag(kind: 'mistake' | 'emotion', label: string): TagDef {
  const trimmed = label.trim();
  const c = load();
  const list = kind === 'mistake' ? c.mistakes : c.emotions;
  const existing = list.find((d) => d.label.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;
  let key = `custom-${slug(trimmed)}`;
  let i = 1;
  while (list.some((d) => d.key === key)) key = `custom-${slug(trimmed)}-${i++}`;
  const def = { key, label: trimmed };
  if (kind === 'mistake') c.mistakes = [...c.mistakes, def];
  else c.emotions = [...c.emotions, def];
  persist();
  return def;
}

export function removeCustomTag(kind: 'mistake' | 'emotion', key: string) {
  const c = load();
  if (kind === 'mistake') c.mistakes = c.mistakes.filter((d) => d.key !== key);
  else c.emotions = c.emotions.filter((d) => d.key !== key);
  persist();
}

export function renameCustomTag(kind: 'mistake' | 'emotion', key: string, label: string) {
  const c = load();
  const list = kind === 'mistake' ? c.mistakes : c.emotions;
  const def = list.find((d) => d.key === key);
  if (def) def.label = label.trim() || def.label;
  persist();
}
