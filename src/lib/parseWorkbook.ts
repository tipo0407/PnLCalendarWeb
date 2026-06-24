import * as XLSX from 'xlsx';
import type { TradeRecord } from '../types';

/** One worksheet as an array-of-arrays (raw cell values). */
export interface SheetData {
  name: string;
  rows: unknown[][];
}

export type FieldKey =
  | 'date' | 'profitLoss' | 'entryTime' | 'exitTime' | 'duration' | 'tradeNumber'
  | 'direction' | 'symbol' | 'entryPrice' | 'exitPrice' | 'size'
  | 'setup' | 'reasonEmotion' | 'runningPnl' | 'note' | 'account';

export type FieldKind = 'date' | 'time' | 'number' | 'int' | 'text';

export interface FieldDef {
  key: FieldKey;
  label: string;
  kind: FieldKind;
  required?: boolean;
  aliases: string[];
}

/** Column definitions, in the order shown in the import wizard. */
export const FIELDS: FieldDef[] = [
  { key: 'date', label: 'Date', kind: 'date', required: true, aliases: ['date', 'tradedate', 'day', 'datetime'] },
  { key: 'profitLoss', label: 'P&L', kind: 'number', required: true, aliases: ['pl', 'pnl', 'profit', 'profitloss', 'netpnl', 'net', 'realizedpnl', 'gainloss', 'result'] },
  { key: 'entryTime', label: 'Entry time', kind: 'time', aliases: ['entrytime', 'timein', 'opentime', 'entrytime', 'intime'] },
  { key: 'exitTime', label: 'Exit time', kind: 'time', aliases: ['exittime', 'timeout', 'closetime', 'exittime', 'outtime'] },
  { key: 'duration', label: 'Duration', kind: 'time', aliases: ['duration', 'holdtime', 'held'] },
  { key: 'tradeNumber', label: 'Trade # (of day)', kind: 'int', aliases: ['noofday', 'no', 'tradenumber', 'tradeno', 'seq', 'ofday', 'tradecount'] },
  { key: 'direction', label: 'Direction', kind: 'text', aliases: ['direction', 'side', 'longshort', 'type', 'buysell', 'position'] },
  { key: 'symbol', label: 'Symbol', kind: 'text', aliases: ['symbol', 'ticker', 'instrument', 'contract', 'market', 'asset'] },
  { key: 'entryPrice', label: 'Entry price', kind: 'number', aliases: ['entryprice', 'buyprice', 'openprice', 'avgentryprice', 'entryfill', 'priceentry'] },
  { key: 'exitPrice', label: 'Exit price', kind: 'number', aliases: ['exitprice', 'sellprice', 'closeprice', 'avgexitprice', 'exitfill', 'priceexit'] },
  { key: 'size', label: 'Size', kind: 'number', aliases: ['size', 'qty', 'quantity', 'contracts', 'shares', 'lots', 'volume', 'units'] },
  { key: 'setup', label: 'Setup', kind: 'text', aliases: ['setup', 'strategy', 'playbook', 'tag', 'pattern'] },
  { key: 'reasonEmotion', label: 'Reason & emotion', kind: 'text', aliases: ['reasonemotion', 'reasonandemotion', 'reasonmotion', 'reason', 'emotion', 'rationale', 'psychology'] },
  { key: 'runningPnl', label: 'Cumulative P&L', kind: 'number', aliases: ['apl', 'cumulative', 'cumpnl', 'runningpnl', 'equity', 'balance'] },
  { key: 'note', label: 'Note', kind: 'text', aliases: ['note', 'notes', 'comment', 'comments', 'remark', 'journal', 'lesson'] },
  { key: 'account', label: 'Account', kind: 'text', aliases: ['account', 'accountname', 'acct', 'accountid', 'accountnumber'] },
];

export type Mapping = Partial<Record<FieldKey, number>>;

export interface ImportResult {
  trades: TradeRecord[];
  skipped: { row: number; reason: string }[];
  total: number;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pad2 = (n: number) => String(n).padStart(2, '0');
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function isoDate(y: number, m: number, d: number): string | null {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2200)) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Excel serial (days since 1899-12-30) -> ISO date. */
function excelSerialToISO(serial: number): string | null {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Parse a date cell from a serial number, Date, or many text formats. */
export function parseDateCell(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? excelSerialToISO(v) : null;
  if (v instanceof Date) return isoDate(v.getFullYear(), v.getMonth() + 1, v.getDate());
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); // 2026-06-23, 2026/6/23
  if (m) return isoDate(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/); // 6/23/2026 (US) or 23/6/2026
  if (m) {
    let mo = +m[1]; let d = +m[2]; let y = +m[3];
    if (y < 100) y += 2000;
    if (mo > 12 && d <= 12) { const t = mo; mo = d; d = t; } // looks like D/M
    return isoDate(y, mo, d);
  }
  m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3,})[- ](\d{2,4})/); // 23-Jun-2026
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) { let y = +m[3]; if (y < 100) y += 2000; return isoDate(y, mo, +m[1]); }
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) { const d = new Date(t); return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  return null;
}

/** Parse a time cell (fraction of day, seconds, or HH:MM / h:mm AM/PM) -> seconds of day. */
export function parseTimeCell(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round((v % 1) * 86400) : null;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i);
  if (m) {
    let h = +m[1]; const mi = +m[2]; const se = m[3] ? +m[3] : 0;
    const ap = m[4] ? m[4][0].toLowerCase() : '';
    if (ap === 'p' && h < 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
    return h * 3600 + mi * 60 + se;
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round((n % 1) * 86400) : null;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

/**
 * Sniff the most likely delimiter of a delimited-text file by counting how
 * consistently each candidate splits the first few non-empty lines. Supports
 * comma, semicolon (common in European locales), tab (TSV) and pipe. Falls back
 * to comma when nothing stands out.
 */
export function sniffDelimiter(sample: string): ',' | ';' | '\t' | '|' {
  const candidates: (',' | ';' | '\t' | '|')[] = [',', ';', '\t', '|'];
  const lines = sample.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 10);
  if (lines.length === 0) return ',';
  let best: ',' | ';' | '\t' | '|' = ',';
  let bestScore = -1;
  for (const d of candidates) {
    const counts = lines.map((l) => l.split(d).length - 1);
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    // Reward many delimiters that are consistent across lines.
    const avg = total / counts.length;
    const variance = counts.reduce((a, c) => a + (c - avg) ** 2, 0) / counts.length;
    const score = avg - variance;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

/** True when the buffer is NOT a binary spreadsheet (xlsx 'PK', xls 0xD0CF). */
function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length < 2) return false;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return false; // PK → xlsx/zip
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) return false; // OLE → legacy xls
  return true;
}

/** Read all worksheets of an xlsx/csv buffer into arrays-of-arrays. */
export function readSheets(data: ArrayBuffer): SheetData[] {
  const bytes = new Uint8Array(data);
  // For delimited text, sniff the separator so semicolon/tab/pipe files parse
  // correctly instead of collapsing into a single column.
  if (looksLikeText(bytes)) {
    try {
      const text = new TextDecoder('utf-8').decode(bytes);
      const FS = sniffDelimiter(text);
      const wb = XLSX.read(text, { type: 'string', FS, raw: true });
      return wb.SheetNames.map((name) => ({
        name,
        rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
          header: 1, raw: true, blankrows: false, defval: null,
        }),
      }));
    } catch {
      /* fall through to the binary reader below */
    }
  }
  const wb = XLSX.read(data, { type: 'array' });
  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1, raw: true, blankrows: false, defval: null,
    }),
  }));
}

/** First row that looks like a header (has 2+ non-empty cells). */
export function headerRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const nonEmpty = rows[i].filter((c) => toStr(c) !== '').length;
    if (nonEmpty >= 2) return i;
  }
  return 0;
}

/** Guess column → field mapping from a header row using aliases. */
export function autoMap(headerRow: unknown[]): Mapping {
  const headers = headerRow.map((c) => norm(toStr(c)));
  const mapping: Mapping = {};
  for (const f of FIELDS) {
    const idx = headers.findIndex((h) => h !== '' && f.aliases.some((a) => h === norm(a)));
    if (idx >= 0) mapping[f.key] = idx;
  }
  return mapping;
}

/** Score how well a sheet's header matches known fields (for sheet auto-selection). */
function sheetScore(rows: unknown[][]): number {
  if (rows.length === 0) return -1;
  const hr = rows[headerRowIndex(rows)];
  const map = autoMap(hr);
  let score = Object.keys(map).length;
  if (map.date !== undefined) score += 3;
  if (map.profitLoss !== undefined) score += 3;
  return score;
}

/** Pick the sheet most likely to hold the trade log. */
export function guessSheetIndex(sheets: SheetData[]): number {
  let best = 0; let bestScore = -1;
  sheets.forEach((s, i) => {
    let score = sheetScore(s.rows);
    if (i === 2) score += 0.5; // legacy: trade log was historically the 3rd tab
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

/** Parse a sheet into trades using an explicit column mapping. */
export function parseSheet(sheet: SheetData, mapping: Mapping): ImportResult {
  const rows = sheet.rows;
  const hIdx = headerRowIndex(rows);
  const trades: TradeRecord[] = [];
  const skipped: { row: number; reason: string }[] = [];
  let total = 0;

  const cell = (row: unknown[], key: FieldKey): unknown => {
    const i = mapping[key];
    return i === undefined || i < 0 ? null : row[i];
  };

  for (let r = hIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => toStr(c) === '')) continue; // blank line
    total++;
    const date = parseDateCell(cell(row, 'date'));
    if (date === null) {
      skipped.push({ row: r + 1, reason: 'missing or unrecognized Date' });
      continue;
    }
    trades.push({
      rowNumber: r + 1,
      date,
      entryTime: parseTimeCell(cell(row, 'entryTime')),
      exitTime: parseTimeCell(cell(row, 'exitTime')),
      tradeNumber: Math.trunc(toNumber(cell(row, 'tradeNumber')) ?? 0),
      duration: parseTimeCell(cell(row, 'duration')),
      direction: toStr(cell(row, 'direction')),
      symbol: toStr(cell(row, 'symbol')).toUpperCase(),
      entryPrice: toNumber(cell(row, 'entryPrice')) ?? 0,
      exitPrice: toNumber(cell(row, 'exitPrice')) ?? 0,
      size: toNumber(cell(row, 'size')) ?? 0,
      profitLoss: toNumber(cell(row, 'profitLoss')) ?? 0,
      setup: toStr(cell(row, 'setup')),
      reasonEmotion: toStr(cell(row, 'reasonEmotion')),
      runningPnl: toNumber(cell(row, 'runningPnl')) ?? 0,
      note: toStr(cell(row, 'note')),
      account: toStr(cell(row, 'account')),
    });
  }

  trades.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ae = a.entryTime ?? 0; const be = b.entryTime ?? 0;
    if (ae !== be) return ae - be;
    return a.tradeNumber - b.tradeNumber;
  });

  return { trades: dedupeTrades(trades), skipped, total };
}

/** Signature used to detect duplicate trade rows. */
function tradeSignature(t: TradeRecord): string {
  return [t.date, t.entryTime ?? '', t.exitTime ?? '', t.symbol, t.tradeNumber, t.profitLoss, t.size].join('|');
}

/** Drop exact-duplicate trades (same date/time/symbol/#/P&L/size), keeping the first. */
export function dedupeTrades(trades: TradeRecord[]): TradeRecord[] {
  const seen = new Set<string>();
  const out: TradeRecord[] = [];
  for (const t of trades) {
    const sig = tradeSignature(t);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(t);
  }
  return out;
}

/**
 * Parse a workbook buffer into trades with zero configuration — picks the most
 * likely sheet and auto-maps columns. Used by the auto-load path.
 */
export function parseWorkbook(data: ArrayBuffer): TradeRecord[] {
  const sheets = readSheets(data);
  if (sheets.length === 0) return [];
  const sheet = sheets[guessSheetIndex(sheets)];
  const mapping = autoMap(sheet.rows[headerRowIndex(sheet.rows)] ?? []);
  if (mapping.date === undefined) {
    throw new Error('No "Date" column found — could not detect the trade log.');
  }
  return parseSheet(sheet, mapping).trades;
}

const SHEET_ID_RE = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;

/** Extract a Google Sheets document id from a pasted URL or raw id. */
export function extractSheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(SHEET_ID_RE);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

/** Fetch a Google Sheet as an xlsx buffer (via the dev/prod proxy). */
export async function fetchGoogleSheetBuffer(input: string): Promise<ArrayBuffer> {
  const id = extractSheetId(input);
  if (!id) throw new Error('Could not recognize that Google Sheet link or ID.');
  const url = `/gsheet/spreadsheets/d/${id}/export?format=xlsx`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to download the Google Sheet (${resp.status}). Make sure it is shared as "Anyone with the link can view".`);
  }
  return resp.arrayBuffer();
}
