import type { TradeRecord, DailyPnl } from '../types';
import { currencySymbol } from './settings';

export function groupByDay(trades: TradeRecord[]): Map<string, DailyPnl> {
  const map = new Map<string, DailyPnl>();
  for (const t of trades) {
    let d = map.get(t.date);
    if (!d) {
      d = { date: t.date, pnl: 0, tradeCount: 0, wins: 0, losses: 0, trades: [] };
      map.set(t.date, d);
    }
    d.pnl += t.profitLoss;
    d.tradeCount += 1;
    if (t.profitLoss > 0) d.wins += 1;
    else if (t.profitLoss < 0) d.losses += 1;
    d.trades.push(t);
  }
  return map;
}

export interface EquityPoint {
  index: number;
  date: string;
  cumulative: number;
  pnl: number;
}

export interface Summary {
  totalPnl: number;
  tradeCount: number;
  tradingDays: number;
  winDays: number;
  lossDays: number;
  winRateDays: number;
  winTrades: number;
  lossTrades: number;
  winRateTrades: number;
  avgWin: number;
  avgLoss: number;
  avgDayPnl: number;
  profitFactor: number;
  bestDay: DailyPnl | null;
  worstDay: DailyPnl | null;
  bestTrade: TradeRecord | null;
  worstTrade: TradeRecord | null;
  expectancy: number;
  maxDrawdown: number;
  winningStreak: number;
  firstDate: string | null;
  lastDate: string | null;
  daysSinceFirst: number;
}

export function computeSummary(trades: TradeRecord[]): Summary {
  const days = [...groupByDay(trades).values()].sort((a, b) =>
    a.date < b.date ? -1 : 1
  );
  const totalPnl = trades.reduce((s, t) => s + t.profitLoss, 0);
  const winTradesArr = trades.filter((t) => t.profitLoss > 0);
  const lossTradesArr = trades.filter((t) => t.profitLoss < 0);
  const grossWin = winTradesArr.reduce((s, t) => s + t.profitLoss, 0);
  const grossLoss = Math.abs(lossTradesArr.reduce((s, t) => s + t.profitLoss, 0));

  const winDays = days.filter((d) => d.pnl > 0).length;
  const lossDays = days.filter((d) => d.pnl < 0).length;

  let bestDay: DailyPnl | null = null;
  let worstDay: DailyPnl | null = null;
  for (const d of days) {
    if (!bestDay || d.pnl > bestDay.pnl) bestDay = d;
    if (!worstDay || d.pnl < worstDay.pnl) worstDay = d;
  }

  let bestTrade: TradeRecord | null = null;
  let worstTrade: TradeRecord | null = null;
  for (const t of trades) {
    if (!bestTrade || t.profitLoss > bestTrade.profitLoss) bestTrade = t;
    if (!worstTrade || t.profitLoss < worstTrade.profitLoss) worstTrade = t;
  }

  // Max drawdown from the cumulative trade-by-trade equity curve.
  let cum = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const t of trades) {
    cum += t.profitLoss;
    if (cum > peak) peak = cum;
    const dd = cum - peak;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }

  // Trailing consecutive winning days.
  let winningStreak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].pnl > 0) winningStreak++;
    else break;
  }

  const firstDate = days.length ? days[0].date : null;
  const lastDate = days.length ? days[days.length - 1].date : null;
  let daysSinceFirst = 0;
  if (firstDate) {
    const [y, m, d] = firstDate.split('-').map(Number);
    daysSinceFirst = Math.max(
      0,
      Math.round((Date.now() - Date.UTC(y, m - 1, d)) / 86400000)
    );
  }

  const winRateTrades = trades.length ? winTradesArr.length / trades.length : 0;
  const avgWin = winTradesArr.length ? grossWin / winTradesArr.length : 0;
  const avgLoss = lossTradesArr.length ? grossLoss / lossTradesArr.length : 0;

  return {
    totalPnl,
    tradeCount: trades.length,
    tradingDays: days.length,
    winDays,
    lossDays,
    winRateDays: days.length ? winDays / days.length : 0,
    winTrades: winTradesArr.length,
    lossTrades: lossTradesArr.length,
    winRateTrades,
    avgWin,
    avgLoss,
    avgDayPnl: days.length ? totalPnl / days.length : 0,
    profitFactor: grossLoss === 0 ? (grossWin > 0 ? Infinity : 0) : grossWin / grossLoss,
    bestDay,
    worstDay,
    bestTrade,
    worstTrade,
    expectancy: winRateTrades * avgWin - (1 - winRateTrades) * avgLoss,
    maxDrawdown,
    winningStreak,
    firstDate,
    lastDate,
    daysSinceFirst,
  };
}

/** Cumulative equity curve per trade (in chronological order). */
export function equityCurve(trades: TradeRecord[]): EquityPoint[] {
  let cum = 0;
  return trades.map((t, i) => {
    cum += t.profitLoss;
    return { index: i + 1, date: t.date, cumulative: cum, pnl: t.profitLoss };
  });
}

/** Daily cumulative equity curve. */
export function dailyEquityCurve(trades: TradeRecord[]): EquityPoint[] {
  const days = [...groupByDay(trades).values()].sort((a, b) =>
    a.date < b.date ? -1 : 1
  );
  let cum = 0;
  return days.map((d, i) => {
    cum += d.pnl;
    return { index: i + 1, date: d.date, cumulative: cum, pnl: d.pnl };
  });
}

export interface MonthBucket {
  year: number;
  month: number; // 0-based
  pnl: number;
  tradeCount: number;
}

export function monthlyBreakdown(trades: TradeRecord[]): MonthBucket[] {
  const map = new Map<string, MonthBucket>();
  for (const t of trades) {
    const [y, m] = t.date.split('-').map(Number);
    const key = `${y}-${m}`;
    let b = map.get(key);
    if (!b) {
      b = { year: y, month: m - 1, pnl: 0, tradeCount: 0 };
      map.set(key, b);
    }
    b.pnl += t.profitLoss;
    b.tradeCount += 1;
  }
  return [...map.values()].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  );
}

export interface GroupEdge {
  key: string;
  pnl: number;
  count: number;
  wins: number;
  winRate: number;
}

export function edgeByField(
  trades: TradeRecord[],
  field: (t: TradeRecord) => string
): GroupEdge[] {
  const map = new Map<string, GroupEdge>();
  for (const t of trades) {
    const key = field(t) || '(未填写)';
    let g = map.get(key);
    if (!g) {
      g = { key, pnl: 0, count: 0, wins: 0, winRate: 0 };
      map.set(key, g);
    }
    g.pnl += t.profitLoss;
    g.count += 1;
    if (t.profitLoss > 0) g.wins += 1;
  }
  const out = [...map.values()];
  out.forEach((g) => (g.winRate = g.count ? g.wins / g.count : 0));
  return out.sort((a, b) => b.pnl - a.pnl);
}

/** Edge bucketed by hour of entry. */
export function edgeByHour(trades: TradeRecord[]): GroupEdge[] {
  return edgeByField(trades, (t) =>
    t.entryTime === null ? '未知' : `${String(Math.floor(t.entryTime / 3600)).padStart(2, '0')}:00`
  ).sort((a, b) => a.key.localeCompare(b.key));
}

/** Distinct trade symbols (uppercased), most-frequent first. */
export function distinctSymbols(trades: TradeRecord[]): string[] {
  const counts = new Map<string, number>();
  for (const t of trades) {
    const s = (t.symbol ?? '').trim().toUpperCase();
    if (!s) continue;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
}

/** Distinct account names present in the data (non-empty), most-traded first. */
export function distinctAccounts(trades: TradeRecord[]): string[] {
  const counts = new Map<string, number>();
  for (const t of trades) {
    const a = (t.account ?? '').trim();
    if (!a) continue;
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
}

export interface HourEdge {
  hour: number;
  key: string; // 12-hour label, e.g. "9a", "12p"
  avg: number; // average P&L per trade in this hour
  pnl: number; // total P&L
  count: number;
}

function hourLabel12(h: number): string {
  const period = h < 12 ? 'a' : 'p';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${period}`;
}

/** Average P&L per trade by entry hour, optionally filtered to one symbol ('All' = no filter). */
export function hourEdgeBySymbol(trades: TradeRecord[], symbol: string): HourEdge[] {
  const map = new Map<number, { pnl: number; count: number }>();
  for (const t of trades) {
    if (t.entryTime == null) continue;
    if (symbol !== 'All' && (t.symbol ?? '').trim().toUpperCase() !== symbol) continue;
    const h = Math.floor(t.entryTime / 3600);
    const e = map.get(h) ?? { pnl: 0, count: 0 };
    e.pnl += t.profitLoss;
    e.count += 1;
    map.set(h, e);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, v]) => ({
      hour,
      key: hourLabel12(hour),
      avg: v.count ? v.pnl / v.count : 0,
      pnl: v.pnl,
      count: v.count,
    }));
}

/** Rolling win-rate (%) over the last `window` trades. Starts at the first
 *  fully-populated window so the curve doesn't ramp up from 0. */
export function movingWinRate(trades: TradeRecord[], window = 20): { i: number; rate: number }[] {
  const out: { i: number; rate: number }[] = [];
  const buf: number[] = [];
  let winsInWindow = 0;
  const startAt = trades.length >= window ? window - 1 : 0;
  trades.forEach((t, idx) => {
    buf.push(t.profitLoss > 0 ? 1 : 0);
    winsInWindow += buf[buf.length - 1];
    if (buf.length > window) winsInWindow -= buf.shift() ?? 0;
    if (idx >= startAt) out.push({ i: idx + 1, rate: (winsInWindow / buf.length) * 100 });
  });
  return out;
}

/** P&L distribution histogram buckets. */
export function pnlHistogram(trades: TradeRecord[], bucketCount = 11): { label: string; count: number }[] {
  if (trades.length === 0) return [];
  const vals = trades.map((t) => t.profitLoss);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (min === max) return [{ label: min.toFixed(0), count: vals.length }];
  const span = max - min;
  const size = span / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    label: `${(min + i * size).toFixed(0)}`,
    count: 0,
  }));
  for (const v of vals) {
    let idx = Math.floor((v - min) / size);
    if (idx >= bucketCount) idx = bucketCount - 1;
    buckets[idx].count += 1;
  }
  return buckets;
}

export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}${currencySymbol()}${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Signed money with an explicit leading + for non-negative values. */
export function formatMoneySigned(n: number): string {
  return (n >= 0 ? '+' : '') + formatMoney(n);
}

/** Compact money for axis ticks, e.g. 1234 -> "$1.2k", -1234 -> "-$1.2k". */
export function compactMoney(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  const c = currencySymbol();
  if (a >= 1000) return `${sign}${c}${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k`;
  return `${sign}${c}${a.toFixed(0)}`;
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-06-11" -> "Jun 11". */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTH_ABBR[m - 1]} ${d}`;
}

/** "2026-06-11" -> "Jun 11, 2026". */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTH_ABBR[m - 1]} ${d}, ${y}`;
}

export function formatSeconds(sec: number | null): string {
  if (sec === null) return '--';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
