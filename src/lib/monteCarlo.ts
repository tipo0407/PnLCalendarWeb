import type { TradeRecord } from '../types';

export interface MonteCarloResult {
  /** Number of simulated runs. */
  runs: number;
  /** Trades per run (= sample size). */
  horizon: number;
  /** Median final cumulative P&L across runs. */
  medianFinal: number;
  /** 5th / 95th percentile final P&L (confidence band). */
  p5Final: number;
  p95Final: number;
  /** Median of each run's worst peak-to-trough drawdown (<= 0). */
  medianMaxDrawdown: number;
  /** Worst (most negative) max drawdown observed across runs. */
  worstMaxDrawdown: number;
  /** Probability (0–1) a run's equity ever falls to/below -ruinThreshold. */
  riskOfRuin: number;
  /** Probability (0–1) a run ends above 0. */
  probProfit: number;
}

/** Small, fast, deterministic PRNG (mulberry32) so results are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.round((p / 100) * (sortedAsc.length - 1))));
  return sortedAsc[idx];
}

/**
 * Bootstrap Monte-Carlo of future equity by resampling realized trade P&Ls
 * (with replacement). Projects the distribution of final P&L and max drawdown,
 * and estimates the probability of ruin (equity dropping to -ruinThreshold) and
 * of finishing profitable. Deterministic given `seed`. Pure.
 */
export function monteCarlo(
  trades: TradeRecord[],
  opts: { runs?: number; horizon?: number; ruinThreshold?: number; seed?: number } = {},
): MonteCarloResult | null {
  const pnls = trades.map((t) => t.profitLoss);
  if (pnls.length < 5) return null;

  const runs = Math.max(50, opts.runs ?? 1000);
  const horizon = Math.max(1, opts.horizon ?? pnls.length);
  const ruinThreshold = opts.ruinThreshold ?? 0; // 0 disables ruin tracking
  const rng = mulberry32(opts.seed ?? 12345);

  const finals: number[] = [];
  const maxDDs: number[] = [];
  let ruinHits = 0;
  let profitable = 0;

  for (let r = 0; r < runs; r++) {
    let equity = 0;
    let peak = 0;
    let maxDD = 0;
    let ruined = false;
    for (let i = 0; i < horizon; i++) {
      equity += pnls[Math.floor(rng() * pnls.length)];
      if (equity > peak) peak = equity;
      const dd = equity - peak;
      if (dd < maxDD) maxDD = dd;
      if (ruinThreshold > 0 && equity <= -ruinThreshold) ruined = true;
    }
    finals.push(equity);
    maxDDs.push(maxDD);
    if (ruined) ruinHits++;
    if (equity > 0) profitable++;
  }

  finals.sort((a, b) => a - b);
  maxDDs.sort((a, b) => a - b);

  return {
    runs,
    horizon,
    medianFinal: percentile(finals, 50),
    p5Final: percentile(finals, 5),
    p95Final: percentile(finals, 95),
    medianMaxDrawdown: percentile(maxDDs, 50),
    worstMaxDrawdown: maxDDs[0],
    riskOfRuin: ruinThreshold > 0 ? ruinHits / runs : 0,
    probProfit: profitable / runs,
  };
}
