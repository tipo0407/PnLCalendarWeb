import type { TradeRecord } from '../types';
import { dedupeTrades } from './parseWorkbook';

export interface DataHealth {
  count: number;
  /** Earliest / latest trade date (ISO), or null when empty. */
  start: string | null;
  end: string | null;
  /** Number of distinct non-empty symbols. */
  symbols: number;
  /** Count of exact-duplicate rows that would be de-duplicated on import. */
  duplicates: number;
  /** Fraction (0–1) of trades that have each optional field populated. */
  coverage: {
    symbol: number;
    direction: number;
    setup: number;
    entryTime: number;
    size: number;
  };
}

/**
 * Summarize the quality of a parsed trade set so the importer can tell the user
 * what came through: date range, symbol count, field coverage and how many exact
 * duplicates would be merged. Pure and side-effect free.
 */
export function dataHealth(trades: TradeRecord[]): DataHealth {
  const count = trades.length;
  if (count === 0) {
    return { count: 0, start: null, end: null, symbols: 0, duplicates: 0,
      coverage: { symbol: 0, direction: 0, setup: 0, entryTime: 0, size: 0 } };
  }
  let start = trades[0].date;
  let end = trades[0].date;
  const syms = new Set<string>();
  let hasSymbol = 0, hasDir = 0, hasSetup = 0, hasTime = 0, hasSize = 0;
  for (const t of trades) {
    if (t.date < start) start = t.date;
    if (t.date > end) end = t.date;
    const sym = (t.symbol ?? '').trim();
    if (sym) { hasSymbol++; syms.add(sym); }
    if ((t.direction ?? '').trim()) hasDir++;
    if ((t.setup ?? '').trim()) hasSetup++;
    if (t.entryTime !== null && t.entryTime !== undefined) hasTime++;
    if (t.size) hasSize++;
  }
  const duplicates = count - dedupeTrades(trades).length;
  return {
    count, start, end, symbols: syms.size, duplicates,
    coverage: {
      symbol: hasSymbol / count,
      direction: hasDir / count,
      setup: hasSetup / count,
      entryTime: hasTime / count,
      size: hasSize / count,
    },
  };
}
