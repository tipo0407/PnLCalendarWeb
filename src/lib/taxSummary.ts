import type { TradeRecord } from '../types';

export interface TaxYearRow {
  year: string;
  trades: number;
  wins: number;
  losses: number;
  grossProfit: number;
  grossLoss: number;
  netPnl: number;
}

// grossLoss is a positive magnitude (sum of the absolute value of losing trades).

export interface TaxSymbolRow {
  year: string;
  symbol: string;
  trades: number;
  netPnl: number;
}

/** Aggregate realized P&L per calendar year. Pure; for an informational tax/PnL summary. */
export function taxByYear(trades: TradeRecord[]): TaxYearRow[] {
  const map = new Map<string, TaxYearRow>();
  for (const t of trades) {
    const year = t.date.slice(0, 4);
    let row = map.get(year);
    if (!row) { row = { year, trades: 0, wins: 0, losses: 0, grossProfit: 0, grossLoss: 0, netPnl: 0 }; map.set(year, row); }
    row.trades += 1;
    row.netPnl += t.profitLoss;
    if (t.profitLoss > 0) { row.wins += 1; row.grossProfit += t.profitLoss; }
    else if (t.profitLoss < 0) { row.losses += 1; row.grossLoss += -t.profitLoss; }
  }
  return [...map.values()].sort((a, b) => (a.year < b.year ? -1 : 1));
}

/** Aggregate realized P&L per (year, symbol). Pure. */
export function taxBySymbol(trades: TradeRecord[]): TaxSymbolRow[] {
  const map = new Map<string, TaxSymbolRow>();
  for (const t of trades) {
    const year = t.date.slice(0, 4);
    const symbol = (t.symbol ?? '').trim() || '(none)';
    const key = `${year}::${symbol}`;
    let row = map.get(key);
    if (!row) { row = { year, symbol, trades: 0, netPnl: 0 }; map.set(key, row); }
    row.trades += 1;
    row.netPnl += t.profitLoss;
  }
  return [...map.values()].sort((a, b) => (a.year !== b.year ? (a.year < b.year ? -1 : 1) : a.netPnl - b.netPnl));
}

function num(n: number): string {
  return n.toFixed(2);
}

/**
 * Build a CSV realized-P&L / tax summary: a per-year section followed by a
 * per-year-per-symbol section. Informational only — not tax advice. Pure.
 */
export function taxSummaryCsv(trades: TradeRecord[]): string {
  const years = taxByYear(trades);
  const symbols = taxBySymbol(trades);
  const lines: string[] = [];
  lines.push('Year,Trades,Wins,Losses,Gross Profit,Gross Loss,Net P&L');
  for (const y of years) {
    lines.push([y.year, y.trades, y.wins, y.losses, num(y.grossProfit), num(y.grossLoss), num(y.netPnl)].join(','));
  }
  lines.push('');
  lines.push('Year,Symbol,Trades,Net P&L');
  for (const s of symbols) {
    const sym = /[",\n]/.test(s.symbol) ? `"${s.symbol.replace(/"/g, '""')}"` : s.symbol;
    lines.push([s.year, sym, s.trades, num(s.netPnl)].join(','));
  }
  return lines.join('\r\n');
}
