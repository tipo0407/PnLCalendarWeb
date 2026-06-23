import type { TradeRecord } from '../types';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isoOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Monday (ISO) of the week containing the given date. */
export function weekKeyOf(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return isoOf(dt);
}

/** "Mar 3 – Mar 9, 2025" for a Monday-keyed week. */
export function weekLabel(mondayIso: string): string {
  const [y, m, d] = mondayIso.split('-').map(Number);
  const mon = new Date(Date.UTC(y, m - 1, d));
  const sun = new Date(mon);
  sun.setUTCDate(sun.getUTCDate() + 6);
  const a = `${MONTH_ABBR[mon.getUTCMonth()]} ${mon.getUTCDate()}`;
  const b = `${MONTH_ABBR[sun.getUTCMonth()]} ${sun.getUTCDate()}`;
  return `${a} – ${b}, ${sun.getUTCFullYear()}`;
}

/** Group trades by ISO week (Monday key), returned newest-week first. */
export function groupByWeek(trades: TradeRecord[]): { key: string; trades: TradeRecord[] }[] {
  const map = new Map<string, TradeRecord[]>();
  for (const t of trades) {
    const k = weekKeyOf(t.date);
    const arr = map.get(k) ?? [];
    arr.push(t);
    map.set(k, arr);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, ts]) => ({ key, trades: ts }));
}
