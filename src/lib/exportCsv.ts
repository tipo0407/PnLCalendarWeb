import type { TradeRecord } from '../types';

function hms(secs: number | null): string {
  if (secs == null) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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

/** Serialize trades to a CSV string (header row + one row per trade). */
export function tradesToCsv(trades: TradeRecord[]): string {
  const head = COLUMNS.map((c) => csvCell(c.header)).join(',');
  const rows = trades.map((t) => COLUMNS.map((c) => csvCell(c.get(t))).join(','));
  return [head, ...rows].join('\r\n');
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
  downloadText(`trades-${stamp}.csv`, tradesToCsv(trades), 'text/csv');
}
