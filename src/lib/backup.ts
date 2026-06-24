import type { TradeRecord } from '../types';
import { loadUserTags, replaceAllUserTags } from './userTags';
import { loadRules, saveRules, DEFAULT_RULES } from './rules';
import { getSettings, replaceSettings, DEFAULT_SETTINGS } from './settings';
import { savePersistedTrades, clearPersistedTrades } from './persist';
import { clearAllShots, exportAllShots, importAllShots } from './screenshots';
import { dedupeTrades } from './parseWorkbook';
import { exportPlaybook, importPlaybook, type PlaybookEntry } from './playbook';
import { exportReviewed, importReviewed } from './reviewLog';
import { getActiveProfile } from './profiles';
import { downloadText } from './exportCsv';

export interface Backup {
  app: 'pnlcalendar';
  version: 1 | 2;
  exportedAt: string;
  profile?: string;
  trades: TradeRecord[];
  userTags: ReturnType<typeof loadUserTags>;
  rules: ReturnType<typeof loadRules>;
  settings: ReturnType<typeof getSettings>;
  playbook?: Record<string, PlaybookEntry>;
  reviewed?: string[];
  shots?: Record<string, string>;
}

/** Build a full local backup of the active profile (data + preferences + shots). */
export async function buildBackup(trades: TradeRecord[]): Promise<Backup> {
  let shots: Record<string, string> = {};
  try { shots = await exportAllShots(); } catch { /* screenshots optional */ }
  return {
    app: 'pnlcalendar',
    version: 2,
    exportedAt: new Date().toISOString(),
    profile: getActiveProfile().name,
    trades,
    userTags: loadUserTags(),
    rules: loadRules(),
    settings: getSettings(),
    playbook: exportPlaybook(),
    reviewed: exportReviewed(),
    shots,
  };
}

export async function exportBackup(trades: TradeRecord[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  const backup = await buildBackup(trades);
  downloadText(`pnlcalendar-backup-${stamp}.json`, JSON.stringify(backup, null, 2), 'application/json');
}

/** Restore a backup into local storage. Returns the trades to apply in the UI. */
export async function restoreBackup(json: string): Promise<TradeRecord[]> {
  const data = JSON.parse(json) as Partial<Backup>;
  if (data.app !== 'pnlcalendar' || !Array.isArray(data.trades)) {
    throw new Error('Not a valid PnL Calendar backup file.');
  }
  if (data.userTags) replaceAllUserTags(data.userTags);
  if (data.rules) saveRules({ ...DEFAULT_RULES, ...data.rules });
  if (data.settings) replaceSettings({ ...DEFAULT_SETTINGS, ...data.settings });
  if (data.playbook) importPlaybook(data.playbook);
  if (data.reviewed) importReviewed(data.reviewed);
  if (data.shots) { try { await importAllShots(data.shots); } catch { /* skip */ } }
  savePersistedTrades(data.trades);
  return data.trades;
}

/**
 * Merge two backups: union+dedupe trades, union tag/playbook/shots maps and the
 * reviewed list, and keep local rules/settings. Local wins on per-key conflicts.
 */
export function mergeBackups(local: Backup, cloud: Backup): Backup {
  const trades = dedupeTrades([...cloud.trades, ...local.trades]).sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.entryTime ?? 0) - (b.entryTime ?? 0);
  });
  return {
    ...local,
    exportedAt: new Date().toISOString(),
    trades,
    userTags: { ...(cloud.userTags || {}), ...(local.userTags || {}) },
    playbook: { ...(cloud.playbook || {}), ...(local.playbook || {}) },
    reviewed: Array.from(new Set([...(cloud.reviewed || []), ...(local.reviewed || [])])),
    shots: { ...(cloud.shots || {}), ...(local.shots || {}) },
  };
}

/** Wipe all locally stored app data. */
export async function clearAllData() {
  clearPersistedTrades();
  replaceAllUserTags({});
  saveRules(DEFAULT_RULES);
  replaceSettings(DEFAULT_SETTINGS);
  importPlaybook({});
  importReviewed([]);
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
