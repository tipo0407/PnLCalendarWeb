import type { TradeRecord } from '../types';

export interface PeriodStats {
  pnl: number;
  trades: number;
  winRate: number; // 0–1 over trades
  expectancy: number; // pnl / trades
}

export interface PeriodComparison {
  current: PeriodStats;
  previous: PeriodStats;
  /** Absolute deltas (current - previous). */
  deltaPnl: number;
  deltaWinRate: number;
  deltaExpectancy: number;
  hasPrevious: boolean;
}

function statsFor(trades: TradeRecord[]): PeriodStats {
  const n = trades.length;
  const pnl = trades.reduce((s, t) => s + t.profitLoss, 0);
  const wins = trades.filter((t) => t.profitLoss > 0).length;
  return { pnl, trades: n, winRate: n ? wins / n : 0, expectancy: n ? pnl / n : 0 };
}

/** Inclusive prefix match on the ISO date (e.g. '2025-03' for a month). */
function inPeriod(date: string, prefix: string): boolean {
  return date.startsWith(prefix);
}

/**
 * Compare the current calendar month (of the latest trade) against the previous
 * month. Returns both periods' stats and the deltas. Pure and deterministic.
 */
export function compareMonths(trades: TradeRecord[]): PeriodComparison | null {
  if (trades.length === 0) return null;
  const latest = trades.reduce((m, t) => (t.date > m ? t.date : m), trades[0].date);
  const [y, m] = latest.slice(0, 7).split('-').map(Number);
  const curPrefix = `${y}-${String(m).padStart(2, '0')}`;
  const prevDate = new Date(Date.UTC(y, m - 2, 1)); // m is 1-based; m-2 = previous month index
  const prevPrefix = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;

  const cur = statsFor(trades.filter((t) => inPeriod(t.date, curPrefix)));
  const prev = statsFor(trades.filter((t) => inPeriod(t.date, prevPrefix)));

  return {
    current: cur,
    previous: prev,
    deltaPnl: cur.pnl - prev.pnl,
    deltaWinRate: cur.winRate - prev.winRate,
    deltaExpectancy: cur.expectancy - prev.expectancy,
    hasPrevious: prev.trades > 0,
  };
}
