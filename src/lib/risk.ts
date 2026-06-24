import type { TradeRecord } from '../types';
import { equityCurve } from './metrics';

export interface DrawdownPoint {
  index: number;
  date: string;
  equity: number;
  drawdown: number;     // <= 0, distance below running peak (account currency)
  drawdownPct: number;  // <= 0, percent of (accountSize + peak)
}

/** Underwater curve: distance below the running equity peak per trade. */
export function drawdownSeries(trades: TradeRecord[], accountSize = 0): DrawdownPoint[] {
  const eq = equityCurve(trades);
  let peak = 0;
  return eq.map((p) => {
    if (p.cumulative > peak) peak = p.cumulative;
    const drawdown = p.cumulative - peak;
    const base = accountSize + peak;
    const drawdownPct = base > 0 ? (drawdown / base) * 100 : 0;
    return { index: p.index, date: p.date, equity: p.cumulative, drawdown, drawdownPct };
  });
}

export interface DrawdownDuration {
  /** Longest underwater stretch, in trades and calendar days. */
  longestTrades: number;
  longestDays: number;
  /** Current ongoing underwater stretch (0 when at an all-time peak). */
  currentTrades: number;
  currentDays: number;
  /** Recovery from the deepest drawdown's trough back to a new peak. */
  recovered: boolean;
  recoveryTrades: number;
  recoveryDays: number;
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : 0;
}

/**
 * Time-in-drawdown analytics from an underwater series: how long the worst dry
 * spells lasted (trades + days), how long the current one has run, and how long
 * it took to climb out of the deepest hole. Pure and deterministic.
 */
export function drawdownDuration(series: DrawdownPoint[]): DrawdownDuration {
  const empty: DrawdownDuration = {
    longestTrades: 0, longestDays: 0, currentTrades: 0, currentDays: 0,
    recovered: false, recoveryTrades: 0, recoveryDays: 0,
  };
  if (series.length === 0) return empty;

  let longestTrades = 0, longestDays = 0;
  let runStart = -1; // index of the peak just before going underwater
  let troughIdx = -1;
  let globalTroughIdx = -1;

  for (let i = 0; i < series.length; i++) {
    const dd = series[i].drawdown;
    if (dd < 0) {
      if (runStart < 0) runStart = i - 1 >= 0 ? i - 1 : i;
      if (troughIdx < 0 || dd < series[troughIdx].drawdown) troughIdx = i;
      if (globalTroughIdx < 0 || dd < series[globalTroughIdx].drawdown) globalTroughIdx = i;
    } else {
      // Recovered to a peak: close the run.
      if (runStart >= 0) {
        const trades = i - runStart;
        const days = daysBetween(series[runStart].date, series[i].date);
        if (trades > longestTrades) longestTrades = trades;
        if (days > longestDays) longestDays = days;
      }
      runStart = -1; troughIdx = -1;
    }
  }

  // Ongoing underwater stretch at the end.
  let currentTrades = 0, currentDays = 0;
  if (series[series.length - 1].drawdown < 0 && runStart >= 0) {
    currentTrades = series.length - 1 - runStart;
    currentDays = daysBetween(series[runStart].date, series[series.length - 1].date);
    if (currentTrades > longestTrades) longestTrades = currentTrades;
    if (currentDays > longestDays) longestDays = currentDays;
  }

  // Recovery from the deepest trough to the next new peak (drawdown back to 0).
  let recovered = false, recoveryTrades = 0, recoveryDays = 0;
  if (globalTroughIdx >= 0) {
    for (let j = globalTroughIdx + 1; j < series.length; j++) {
      if (series[j].drawdown >= 0) {
        recovered = true;
        recoveryTrades = j - globalTroughIdx;
        recoveryDays = daysBetween(series[globalTroughIdx].date, series[j].date);
        break;
      }
    }
  }

  return { longestTrades, longestDays, currentTrades, currentDays, recovered, recoveryTrades, recoveryDays };
}

export interface RiskStats {
  totalPnl: number;
  maxDrawdown: number;       // <= 0
  maxDrawdownPct: number;    // <= 0 (0 if no account size)
  currentDrawdown: number;   // <= 0, distance below all-time peak right now
  returnPct: number;         // total P&L as % of account size (0 if none)
  hasAccount: boolean;
  hasRisk: boolean;
  rMultiples: number[];      // per-trade P&L / risk (empty if no risk set)
  avgR: number;
  totalR: number;
  bestR: number;
  worstR: number;
  winRate: number;           // fraction of trades with R > 0
}

export function riskStats(trades: TradeRecord[], accountSize = 0, riskPerTrade = 0): RiskStats {
  const dd = drawdownSeries(trades, accountSize);
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  for (const p of dd) {
    if (p.drawdown < maxDrawdown) maxDrawdown = p.drawdown;
    if (p.drawdownPct < maxDrawdownPct) maxDrawdownPct = p.drawdownPct;
  }
  const currentDrawdown = dd.length ? dd[dd.length - 1].drawdown : 0;
  const totalPnl = trades.reduce((s, t) => s + t.profitLoss, 0);

  const hasRisk = riskPerTrade > 0;
  const rMultiples = hasRisk ? trades.map((t) => t.profitLoss / riskPerTrade) : [];
  const totalR = rMultiples.reduce((s, r) => s + r, 0);
  const avgR = rMultiples.length ? totalR / rMultiples.length : 0;
  const wins = rMultiples.filter((r) => r > 0).length;

  return {
    totalPnl,
    maxDrawdown,
    maxDrawdownPct,
    currentDrawdown,
    returnPct: accountSize > 0 ? (totalPnl / accountSize) * 100 : 0,
    hasAccount: accountSize > 0,
    hasRisk,
    rMultiples,
    avgR,
    totalR,
    bestR: rMultiples.length ? Math.max(...rMultiples) : 0,
    worstR: rMultiples.length ? Math.min(...rMultiples) : 0,
    winRate: rMultiples.length ? wins / rMultiples.length : 0,
  };
}

export interface RBucket {
  /** Bucket label, e.g. "≤ -2R", "-1–0R", "≥ +3R". */
  label: string;
  count: number;
  /** True for non-negative (winning) buckets, for coloring. */
  win: boolean;
}

/**
 * Bucket R-multiples into a fixed distribution from ≤ -2R up to ≥ +3R in 1R
 * steps. Shows whether the trader's edge comes from many small wins, a few big
 * ones, or fat-tailed losses. Returns empty when there are no R-multiples.
 */
export function rMultipleHistogram(rMultiples: number[]): RBucket[] {
  if (rMultiples.length === 0) return [];
  const buckets: RBucket[] = [
    { label: '≤ -2R', count: 0, win: false },
    { label: '-2–-1R', count: 0, win: false },
    { label: '-1–0R', count: 0, win: false },
    { label: '0–1R', count: 0, win: true },
    { label: '1–2R', count: 0, win: true },
    { label: '2–3R', count: 0, win: true },
    { label: '≥ +3R', count: 0, win: true },
  ];
  for (const r of rMultiples) {
    let i: number;
    if (r <= -2) i = 0;
    else if (r < -1) i = 1;
    else if (r < 0) i = 2;
    else if (r < 1) i = 3;
    else if (r < 2) i = 4;
    else if (r < 3) i = 5;
    else i = 6;
    buckets[i].count += 1;
  }
  return buckets;
}
