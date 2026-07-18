import { profileKey } from './profiles';
import * as storage from './safeStorage';

export type TableSortKey = 'date' | 'symbol' | 'direction' | 'size' | 'profitLoss' | 'setup';
export type SortDir = 'asc' | 'desc';

export interface TablePrefs {
  sortKey: TableSortKey;
  dir: SortDir;
}

const BASE_KEY = 'pnlcalendar.tableprefs.v1';
const VALID_KEYS: TableSortKey[] = ['date', 'symbol', 'direction', 'size', 'profitLoss', 'setup'];
const DEFAULT: TablePrefs = { sortKey: 'date', dir: 'desc' };

/** Validate/normalize an unknown value into TablePrefs (pure, defensive). */
export function sanitizePrefs(raw: unknown): TablePrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT };
  const r = raw as Record<string, unknown>;
  const sortKey = VALID_KEYS.includes(r.sortKey as TableSortKey) ? (r.sortKey as TableSortKey) : DEFAULT.sortKey;
  const dir = r.dir === 'asc' || r.dir === 'desc' ? (r.dir as SortDir) : DEFAULT.dir;
  return { sortKey, dir };
}

/** Read the active profile's persisted table sort preference. */
export function getTablePrefs(): TablePrefs {
  return sanitizePrefs(storage.getJSON<unknown>(profileKey(BASE_KEY), {}));
}

/** Persist the active profile's table sort preference. */
export function saveTablePrefs(prefs: TablePrefs): void {
  storage.setJSON(profileKey(BASE_KEY), sanitizePrefs(prefs));
}
