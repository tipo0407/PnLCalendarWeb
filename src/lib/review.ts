import type { TradeRecord } from '../types';
import { getSettings } from './settings';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isoOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Start-of-week (ISO) of the week containing the given date, honoring weekStart. */
export function weekKeyOf(dateIso: string, weekStart: 0 | 1 = 1): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() - weekStart + 7) % 7));
  return isoOf(dt);
}

/** "Mar 3 – Mar 9, 2025" for a week-start-keyed week. */
export function weekLabel(startIso: string): string {
  const [y, m, d] = startIso.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const a = `${MONTH_ABBR[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const b = `${MONTH_ABBR[end.getUTCMonth()]} ${end.getUTCDate()}`;
  return `${a} – ${b}, ${end.getUTCFullYear()}`;
}

/** Group trades by week (start key from settings), returned newest-week first. */
export function groupByWeek(trades: TradeRecord[]): { key: string; trades: TradeRecord[] }[] {
  const weekStart = getSettings().weekStart;
  const map = new Map<string, TradeRecord[]>();
  for (const t of trades) {
    const k = weekKeyOf(t.date, weekStart);
    const arr = map.get(k) ?? [];
    arr.push(t);
    map.set(k, arr);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, ts]) => ({ key, trades: ts }));
}

/** Group trades by calendar month (key = YYYY-MM-01), newest month first. */
export function groupByMonth(trades: TradeRecord[]): { key: string; trades: TradeRecord[] }[] {
  const map = new Map<string, TradeRecord[]>();
  for (const t of trades) {
    const k = `${t.date.slice(0, 7)}-01`;
    const arr = map.get(k) ?? [];
    arr.push(t);
    map.set(k, arr);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, ts]) => ({ key, trades: ts }));
}

/** "March 2025" label for a month-start key. */
export function monthLabel(startIso: string): string {
  const [y, m] = startIso.split('-').map(Number);
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${MONTHS[(m - 1) % 12]} ${y}`;
}

