/**
 * Leak Finder — surfaces where money actually drains out of the account.
 *
 * Rather than averaging everything, it scans several independent dimensions
 * (setup, behavioral mistake tag, hour of day, weekday, direction, symbol),
 * keeps only the buckets with a *negative* net P&L and a meaningful sample, and
 * ranks them by total dollars lost. The result is a short, blunt "stop doing
 * this" list — the core behavioral-journal value proposition.
 */

import type { TradeRecord } from '../types';
import type { TradeTags } from './userTags';
import { edgeByField, dayOfWeekEdge } from './metrics';
import { tagEdge } from './tags';

export type LeakDimension = 'setup' | 'mistake' | 'hour' | 'weekday' | 'direction' | 'symbol';

export interface Leak {
  dimension: LeakDimension;
  /** Localized-ish dimension noun for display, e.g. "Setup", "Mistake". */
  dimensionLabel: string;
  /** The offending value, e.g. "Breakout", "FOMO", "10:00", "Monday". */
  value: string;
  /** Net P&L for the bucket (negative). */
  net: number;
  count: number;
  winRate: number;
  /** Average P&L per trade in the bucket (negative). */
  avg: number;
  /** Share of the trader's *total* gross losses this bucket represents (0–1). */
  shareOfLosses: number;
}

const DIM_LABEL: Record<LeakDimension, string> = {
  setup: 'Setup',
  mistake: 'Mistake',
  hour: 'Hour',
  weekday: 'Weekday',
  direction: 'Direction',
  symbol: 'Symbol',
};

const EMPTY = new Set(['', '(no setup)', '(未填写)', '未知', '未填写']);

function hourLabel(t: TradeRecord): string {
  if (t.entryTime === null) return '';
  return `${String(Math.floor(t.entryTime / 3600)).padStart(2, '0')}:00`;
}

/**
 * Compute the ranked list of leaks. `minCount` guards against single-trade
 * outliers dominating the list. Returns at most `limit` items, biggest leak
 * first. Buckets that are empty/unknown values are skipped.
 */
export function findLeaks(
  trades: TradeRecord[],
  userTags?: Record<string, TradeTags>,
  opts: { minCount?: number; limit?: number } = {},
): Leak[] {
  const minCount = opts.minCount ?? 3;
  const limit = opts.limit ?? 6;
  if (trades.length < 5) return [];

  // Total gross loss (sum of losing trades' magnitudes) for share-of-losses.
  const grossLoss = trades.reduce((s, t) => s + (t.profitLoss < 0 ? -t.profitLoss : 0), 0) || 1;

  const leaks: Leak[] = [];
  const push = (dimension: LeakDimension, value: string, net: number, count: number, wins: number) => {
    if (count < minCount || net >= 0 || EMPTY.has(value)) return;
    leaks.push({
      dimension,
      dimensionLabel: DIM_LABEL[dimension],
      value,
      net,
      count,
      winRate: count ? wins / count : 0,
      avg: net / count,
      shareOfLosses: Math.min(1, -net / grossLoss),
    });
  };

  for (const g of edgeByField(trades, (t) => (t.setup ?? '').trim())) push('setup', g.key, g.pnl, g.count, g.wins);
  for (const m of tagEdge(trades, userTags)) push('mistake', m.label, m.pnl, m.count, m.wins);
  for (const g of edgeByField(trades, hourLabel)) push('hour', g.key, g.pnl, g.count, g.wins);
  for (const g of dayOfWeekEdge(trades)) push('weekday', g.key, g.pnl, g.count, g.wins);
  for (const g of edgeByField(trades, (t) => t.direction || '')) push('direction', g.key, g.pnl, g.count, g.wins);
  for (const g of edgeByField(trades, (t) => (t.symbol ?? '').trim())) push('symbol', g.key, g.pnl, g.count, g.wins);

  return leaks.sort((a, b) => a.net - b.net).slice(0, limit);
}
