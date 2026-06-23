import type { TradeRecord } from '../types';
import { loadUserTags, replaceAllUserTags } from './userTags';
import { loadRules, saveRules, DEFAULT_RULES } from './rules';
import { getSettings, replaceSettings, DEFAULT_SETTINGS } from './settings';
import { savePersistedTrades, clearPersistedTrades } from './persist';
import { clearAllShots } from './screenshots';
import { downloadText } from './exportCsv';

export interface Backup {
  app: 'pnlcalendar';
  version: 1;
  exportedAt: string;
  trades: TradeRecord[];
  userTags: ReturnType<typeof loadUserTags>;
  rules: ReturnType<typeof loadRules>;
  settings: ReturnType<typeof getSettings>;
}

/** Build a full local backup object (trades + tags + rules + settings). */
export function buildBackup(trades: TradeRecord[]): Backup {
  return {
    app: 'pnlcalendar',
    version: 1,
    exportedAt: new Date().toISOString(),
    trades,
    userTags: loadUserTags(),
    rules: loadRules(),
    settings: getSettings(),
  };
}

export function exportBackup(trades: TradeRecord[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadText(`pnlcalendar-backup-${stamp}.json`, JSON.stringify(buildBackup(trades), null, 2), 'application/json');
}

/** Restore a backup into local storage. Returns the trades to apply in the UI. */
export function restoreBackup(json: string): TradeRecord[] {
  const data = JSON.parse(json) as Partial<Backup>;
  if (data.app !== 'pnlcalendar' || !Array.isArray(data.trades)) {
    throw new Error('Not a valid PnL Calendar backup file.');
  }
  if (data.userTags) replaceAllUserTags(data.userTags);
  if (data.rules) saveRules({ ...DEFAULT_RULES, ...data.rules });
  if (data.settings) replaceSettings({ ...DEFAULT_SETTINGS, ...data.settings });
  savePersistedTrades(data.trades);
  return data.trades;
}

/** Wipe all locally stored app data. */
export async function clearAllData() {
  clearPersistedTrades();
  replaceAllUserTags({});
  saveRules(DEFAULT_RULES);
  replaceSettings(DEFAULT_SETTINGS);
  try { await clearAllShots(); } catch { /* ignore */ }
  for (const k of ['pnlcalendar.gsheet', 'pnlcalendar.lastSync']) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}

/** Approximate local storage usage, in MB, when the browser supports it. */
export async function storageUsageMB(): Promise<number | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const { usage } = await navigator.storage.estimate();
    return usage != null ? usage / (1024 * 1024) : null;
  } catch {
    return null;
  }
}
