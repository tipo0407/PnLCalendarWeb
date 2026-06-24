import { describe, it, expect } from 'vitest';
import type { TradeRecord } from '../types';
import { taxByYear, taxBySymbol, taxSummaryCsv } from './taxSummary';

function trade(date: string, pnl: number, symbol = 'MES'): TradeRecord {
  return {
    rowNumber: 0, date, entryTime: null, exitTime: null, tradeNumber: 1, duration: null,
    direction: 'LONG', symbol, entryPrice: 0, exitPrice: 0, size: 1,
    profitLoss: pnl, setup: '', reasonEmotion: '', runningPnl: 0, note: '',
  };
}

describe('taxByYear', () => {
  it('aggregates gross/net per year', () => {
    const rows = taxByYear([
      trade('2024-05-01', 100), trade('2024-06-01', -40),
      trade('2025-01-01', 200),
    ]);
    expect(rows.map((r) => r.year)).toEqual(['2024', '2025']);
    expect(rows[0]).toMatchObject({ trades: 2, wins: 1, losses: 1, grossProfit: 100, grossLoss: -40, netPnl: 60 });
    expect(rows[1].netPnl).toBe(200);
  });
});

describe('taxBySymbol', () => {
  it('aggregates per year and symbol', () => {
    const rows = taxBySymbol([
      trade('2025-01-01', 50, 'MES'), trade('2025-02-01', -20, 'MES'), trade('2025-03-01', 80, 'NQ'),
    ]);
    const mes = rows.find((r) => r.symbol === 'MES')!;
    expect(mes.trades).toBe(2);
    expect(mes.netPnl).toBe(30);
  });
});

describe('taxSummaryCsv', () => {
  it('contains both sections with headers', () => {
    const csv = taxSummaryCsv([trade('2025-01-01', 100, 'MES')]);
    expect(csv).toContain('Year,Trades,Wins,Losses,Gross Profit,Gross Loss,Net P&L');
    expect(csv).toContain('Year,Symbol,Trades,Net P&L');
    expect(csv).toContain('2025,1,1,0,100.00,0.00,100.00');
    expect(csv).toContain('2025,MES,1,100.00');
  });
});
