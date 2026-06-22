import * as XLSX from 'xlsx';
import type { TradeRecord } from '../types';

const HEADER_ALIASES: Record<string, string[]> = {
  date: ['date'],
  entryTime: ['entrytime'],
  exitTime: ['exittime'],
  tradeNumber: ['noofday'],
  duration: ['duration'],
  direction: ['direction'],
  symbol: ['symbol'],
  entryPrice: ['entryprice'],
  exitPrice: ['exitprice'],
  size: ['size'],
  profitLoss: ['pl'],
  setup: ['setup'],
  reasonEmotion: ['reason&emotion', 'reasonemotion', 'reason&motion'],
  runningPnl: ['apl'],
  note: ['note'],
};

/** Excel serial number (days since 1899-12-30) -> ISO YYYY-MM-DD (UTC). */
function excelSerialToISODate(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Excel time fraction of a day -> seconds from midnight. */
function fractionToSeconds(fraction: number): number {
  return Math.round((fraction % 1) * 86400);
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

/**
 * Parse a Trading workbook ArrayBuffer into trade records.
 * Mirrors the desktop app: reads the 3rd worksheet, matches header names,
 * interprets Date/time columns as Excel serial values.
 */
export function parseWorkbook(data: ArrayBuffer): TradeRecord[] {
  const wb = XLSX.read(data, { type: 'array' });
  if (wb.SheetNames.length < 3) {
    throw new Error(
      `工作簿只有 ${wb.SheetNames.length} 个 sheet，需要第 3 个 sheet 作为交易日志。`
    );
  }
  const sheet = wb.Sheets[wb.SheetNames[2]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    blankrows: false,
    defval: null,
  });
  if (rows.length === 0) return [];

  const headerRow = rows[0].map((c) => toStr(c).toLowerCase());
  const col: Record<string, number> = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = headerRow.findIndex((h) => aliases.includes(h));
    col[key] = idx;
  }
  if (col.date < 0) {
    throw new Error('未找到 "Date" 列，请确认第 3 个 sheet 是交易日志表。');
  }

  const get = (row: unknown[], key: string): unknown =>
    col[key] >= 0 ? row[col[key]] : null;

  const trades: TradeRecord[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const dateSerial = toNumber(get(row, 'date'));
    if (dateSerial === null) continue;

    const entry = toNumber(get(row, 'entryTime'));
    const exit = toNumber(get(row, 'exitTime'));
    const dur = toNumber(get(row, 'duration'));

    trades.push({
      rowNumber: r + 1,
      date: excelSerialToISODate(dateSerial),
      entryTime: entry === null ? null : fractionToSeconds(entry),
      exitTime: exit === null ? null : fractionToSeconds(exit),
      tradeNumber: Math.trunc(toNumber(get(row, 'tradeNumber')) ?? 0),
      duration: dur === null ? null : fractionToSeconds(dur),
      direction: toStr(get(row, 'direction')),
      symbol: toStr(get(row, 'symbol')).toUpperCase(),
      entryPrice: toNumber(get(row, 'entryPrice')) ?? 0,
      exitPrice: toNumber(get(row, 'exitPrice')) ?? 0,
      size: toNumber(get(row, 'size')) ?? 0,
      profitLoss: toNumber(get(row, 'profitLoss')) ?? 0,
      setup: toStr(get(row, 'setup')),
      reasonEmotion: toStr(get(row, 'reasonEmotion')),
      runningPnl: toNumber(get(row, 'runningPnl')) ?? 0,
      note: toStr(get(row, 'note')),
    });
  }

  trades.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ae = a.entryTime ?? 0;
    const be = b.entryTime ?? 0;
    if (ae !== be) return ae - be;
    return a.tradeNumber - b.tradeNumber;
  });

  return trades;
}

const SHEET_ID_RE = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;

/** Extract a Google Sheets document id from a pasted URL or raw id. */
export function extractSheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(SHEET_ID_RE);
  if (m) return m[1];
  // Allow pasting a bare id.
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Fetch a Google Sheet as xlsx (via the dev proxy) and parse it.
 */
export async function fetchGoogleSheet(input: string): Promise<TradeRecord[]> {
  const id = extractSheetId(input);
  if (!id) {
    throw new Error('无法识别 Google Sheet 链接或 ID。');
  }
  const url = `/gsheet/spreadsheets/d/${id}/export?format=xlsx`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(
      `下载 Google Sheet 失败 (${resp.status})。请确认表格已设置为"知道链接的人可查看"。`
    );
  }
  const buf = await resp.arrayBuffer();
  return parseWorkbook(buf);
}
