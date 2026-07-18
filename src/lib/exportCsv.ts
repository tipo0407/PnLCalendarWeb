import type { TradeRecord } from '../types';
import { getSettings } from './settings';
import { getActiveProfile, DEFAULT_PROFILE } from './profiles';

function hms(secs: number | null): string {
  if (secs == null) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

// Characters that make a spreadsheet treat a cell as a formula. Prefixing such
// a cell with a single quote neutralizes CSV injection when opened in Excel/Sheets.
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

function csvCell(v: string | number): string {
  const s = String(v);
  // Only neutralize string cells; genuine numbers (e.g. a negative P&L) are safe.
  if (typeof v === 'string' && s.length > 0 && FORMULA_TRIGGERS.includes(s[0])) {
    const escaped = `'${s}`;
    return `"${escaped.replace(/"/g, '""')}"`;
  }
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const COLUMNS: { header: string; get: (t: TradeRecord) => string | number }[] = [
  { header: 'Date', get: (t) => t.date },
  { header: 'Trade #', get: (t) => t.tradeNumber || '' },
  { header: 'Entry time', get: (t) => hms(t.entryTime) },
  { header: 'Exit time', get: (t) => hms(t.exitTime) },
  { header: 'Direction', get: (t) => t.direction },
  { header: 'Symbol', get: (t) => t.symbol },
  { header: 'Entry price', get: (t) => t.entryPrice || '' },
  { header: 'Exit price', get: (t) => t.exitPrice || '' },
  { header: 'Size', get: (t) => t.size || '' },
  { header: 'P&L', get: (t) => t.profitLoss },
  { header: 'Setup', get: (t) => t.setup },
  { header: 'Reason & emotion', get: (t) => t.reasonEmotion },
  { header: 'Note', get: (t) => t.note },
];

/** Serialize trades to a CSV string (header + computed Cumulative & R columns). */
export function tradesToCsv(trades: TradeRecord[]): string {
  const risk = getSettings().riskPerTrade;
  const head = [...COLUMNS.map((c) => csvCell(c.header)), 'Cumulative', 'R'].join(',');
  let cum = 0;
  const rows = trades.map((t) => {
    cum += t.profitLoss;
    const r = risk > 0 ? (t.profitLoss / risk).toFixed(2) : '';
    return [...COLUMNS.map((c) => csvCell(c.get(t))), cum.toFixed(2), r].join(',');
  });
  return [head, ...rows].join('\r\n');
}

function profileSlug(): string {
  const p = getActiveProfile();
  if (p.id === DEFAULT_PROFILE.id) return '';
  const s = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s ? `${s}-` : '';
}

/** Trigger a client-side download of text content. */
export function downloadText(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportTradesCsv(trades: TradeRecord[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadText(`trades-${profileSlug()}${stamp}.csv`, tradesToCsv(trades), 'text/csv');
}
