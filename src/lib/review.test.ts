import { describe, it, expect } from 'vitest';
import type { TradeRecord } from '../types';
import { groupByMonth, monthLabel, groupByYear, yearLabel } from './review';

function trade(date: string, pnl: number): TradeRecord {
  return {
    rowNumber: 0, date, entryTime: null, exitTime: null, tradeNumber: 1, duration: null,
    direction: 'LONG', symbol: 'MES', entryPrice: 0, exitPrice: 0, size: 1,
    profitLoss: pnl, setup: '', reasonEmotion: '', runningPnl: 0, note: '',
  };
}

describe('groupByMonth', () => {
  it('buckets trades by calendar month, newest first', () => {
    const groups = groupByMonth([
      trade('2025-01-03', 10),
      trade('2025-01-28', 20),
      trade('2025-03-15', -5),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['2025-03-01', '2025-01-01']);
    expect(groups[1].trades).toHaveLength(2);
  });
});

describe('monthLabel', () => {
  it('formats a month-start key as a readable month', () => {
    expect(monthLabel('2025-03-01')).toBe('March 2025');
    expect(monthLabel('2025-12-01')).toBe('December 2025');
  });
});

describe('groupByYear', () => {
  it('buckets trades by calendar year, newest first', () => {
    const g = groupByYear([
      trade('2024-05-01', 10),
      trade('2025-01-02', 20),
      trade('2025-11-30', -5),
    ]);
    expect(g.map((x) => x.key)).toEqual(['2025-01-01', '2024-01-01']);
    expect(g[0].trades).toHaveLength(2);
  });
});

describe('yearLabel', () => {
  it('formats a year-start key as the year', () => {
    expect(yearLabel('2025-01-01')).toBe('2025');
  });
});
