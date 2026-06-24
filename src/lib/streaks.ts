import type { DailyPnl } from '../types';

export interface StreakStats {
  /** Longest run of consecutive green days. */
  maxWinStreak: number;
  /** Longest run of consecutive red days. */
  maxLossStreak: number;
  /** Average length of a winning run. */
  avgWinStreak: number;
  /** Average length of a losing run. */
  avgLossStreak: number;
  /** Distribution of run lengths, e.g. { '1': 4, '2': 2 } for wins. */
  winRuns: Record<number, number>;
  lossRuns: Record<number, number>;
}

/**
 * Analyze runs of consecutive winning / losing days. Days are taken in date
 * order; flat days (pnl === 0) break a streak without counting either way.
 * Pure and deterministic.
 */
export function streakStats(days: DailyPnl[]): StreakStats {
  const ordered = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const winRuns: Record<number, number> = {};
  const lossRuns: Record<number, number> = {};
  let cur = 0;
  let curSign: 1 | -1 | 0 = 0;

  const flush = () => {
    if (cur > 0 && curSign === 1) winRuns[cur] = (winRuns[cur] ?? 0) + 1;
    else if (cur > 0 && curSign === -1) lossRuns[cur] = (lossRuns[cur] ?? 0) + 1;
    cur = 0; curSign = 0;
  };

  for (const d of ordered) {
    const sign: 1 | -1 | 0 = d.pnl > 0 ? 1 : d.pnl < 0 ? -1 : 0;
    if (sign === 0) { flush(); continue; }
    if (sign === curSign) cur++;
    else { flush(); curSign = sign; cur = 1; }
  }
  flush();

  const stats = (runs: Record<number, number>) => {
    const lengths = Object.keys(runs).map(Number);
    const total = lengths.reduce((s, len) => s + runs[len], 0);
    const sum = lengths.reduce((s, len) => s + len * runs[len], 0);
    return { max: lengths.length ? Math.max(...lengths) : 0, avg: total ? sum / total : 0 };
  };
  const w = stats(winRuns);
  const l = stats(lossRuns);

  return {
    maxWinStreak: w.max,
    maxLossStreak: l.max,
    avgWinStreak: w.avg,
    avgLossStreak: l.avg,
    winRuns,
    lossRuns,
  };
}
