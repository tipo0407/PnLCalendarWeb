import type { TradeRecord } from '../types';
import { profileKey, PROFILE_EVENT } from './profiles';
import * as storage from './safeStorage';

export interface SetupStat {
  setup: string;
  count: number;
  net: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;      // positive magnitude
  expectancy: number;   // per-trade expected value
  profitFactor: number; // grossWin / grossLoss (Infinity if no losses)
}

const EMPTY_LABEL = '(no setup)';

/** Per-setup performance stats, best expectancy first. */
export function setupStats(trades: TradeRecord[]): SetupStat[] {
  const groups = new Map<string, TradeRecord[]>();
  for (const t of trades) {
    const key = (t.setup ?? '').trim() || EMPTY_LABEL;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }
  const out: SetupStat[] = [];
  for (const [setup, ts] of groups) {
    let net = 0, wins = 0, losses = 0, grossWin = 0, grossLoss = 0;
    for (const t of ts) {
      net += t.profitLoss;
      if (t.profitLoss > 0) { wins++; grossWin += t.profitLoss; }
      else if (t.profitLoss < 0) { losses++; grossLoss += -t.profitLoss; }
    }
    const count = ts.length;
    const winRate = count ? wins / count : 0;
    const avgWin = wins ? grossWin / wins : 0;
    const avgLoss = losses ? grossLoss / losses : 0;
    out.push({
      setup, count, net, wins, losses, winRate, avgWin, avgLoss,
      expectancy: count ? net / count : 0,
      profitFactor: grossLoss === 0 ? (grossWin > 0 ? Infinity : 0) : grossWin / grossLoss,
    });
  }
  return out.sort((a, b) => b.expectancy - a.expectancy);
}

// ---- Playbook notes (checklist + note per setup), persisted locally ----

export interface PlaybookEntry {
  checklist: string[];
  note: string;
}

const BASE_KEY = 'pnlcalendar.playbook.v1';
const keyName = () => profileKey(BASE_KEY);
export const PLAYBOOK_EVENT = 'pnlcalendar:playbook';

let cache: Record<string, PlaybookEntry> | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener(PROFILE_EVENT, () => {
    cache = null;
    window.dispatchEvent(new Event(PLAYBOOK_EVENT));
  });
}

function load(): Record<string, PlaybookEntry> {
  if (cache) return cache;
  cache = storage.getJSON<Record<string, PlaybookEntry>>(keyName(), {});
  return cache;
}

export function getPlaybookEntry(setup: string): PlaybookEntry {
  const e = load()[setup];
  return { checklist: e?.checklist ?? [], note: e?.note ?? '' };
}

export function setPlaybookEntry(setup: string, entry: PlaybookEntry) {
  const c = load();
  if (entry.checklist.length === 0 && !entry.note.trim()) delete c[setup];
  else c[setup] = entry;
  storage.setJSON(keyName(), c);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PLAYBOOK_EVENT));
}

/** Whole playbook store for the active profile (backup). */
export function exportPlaybook(): Record<string, PlaybookEntry> {
  return { ...load() };
}

/** Replace the playbook store for the active profile (restore). */
export function importPlaybook(data: Record<string, PlaybookEntry>) {
  cache = { ...data };
  storage.setJSON(keyName(), cache);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PLAYBOOK_EVENT));
}
