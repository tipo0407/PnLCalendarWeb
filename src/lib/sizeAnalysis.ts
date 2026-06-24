import type { TradeRecord } from '../types';

export interface SizeBucket {
  /** Bucket label, e.g. "1", "2–3", "10+". */
  label: string;
  /** Lower bound of the bucket (for sorting). */
  lo: number;
  trades: number;
  net: number;
  wins: number;
  winRate: number;
  expectancy: number;
}

/** Default size buckets tuned for futures/equities position counts. */
const DEFAULT_EDGES = [1, 2, 4, 6, 10];

function bucketLabel(edges: number[], idx: number): string {
  const lo = edges[idx];
  const hi = idx + 1 < edges.length ? edges[idx + 1] - 1 : Infinity;
  if (hi === Infinity) return `${lo}+`;
  if (lo === hi) return `${lo}`;
  return `${lo}–${hi}`;
}

/**
 * Group trades into position-size buckets and report net / win-rate /
 * expectancy per bucket. Surfaces whether the trader sizes up on their best
 * trades or just adds risk. Trades without a positive size are ignored. Pure.
 */
export function sizePerformance(trades: TradeRecord[], edges: number[] = DEFAULT_EDGES): SizeBucket[] {
  const sorted = [...edges].sort((a, b) => a - b);
  const buckets: SizeBucket[] = sorted.map((lo, i) => ({
    label: bucketLabel(sorted, i), lo, trades: 0, net: 0, wins: 0, winRate: 0, expectancy: 0,
  }));

  const idxFor = (size: number): number => {
    let idx = 0;
    for (let i = 0; i < sorted.length; i++) if (size >= sorted[i]) idx = i;
    return idx;
  };

  for (const t of trades) {
    const size = Math.abs(t.size);
    if (!size || size < sorted[0]) continue;
    const b = buckets[idxFor(size)];
    b.trades += 1;
    b.net += t.profitLoss;
    if (t.profitLoss > 0) b.wins += 1;
  }
  for (const b of buckets) {
    b.winRate = b.trades ? b.wins / b.trades : 0;
    b.expectancy = b.trades ? b.net / b.trades : 0;
  }
  return buckets.filter((b) => b.trades > 0);
}
