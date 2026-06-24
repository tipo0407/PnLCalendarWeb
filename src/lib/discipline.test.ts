import { describe, it, expect } from 'vitest';
import type { DailyPnl, TradeRecord } from '../types';
import { dayDiscipline } from './discipline';

function trade(p: Partial<TradeRecord>): TradeRecord {
  return {
    rowNumber: 0, date: '2025-01-06', entryTime: 8 * 3600, exitTime: null,
    tradeNumber: 1, duration: null, direction: 'LONG', symbol: 'MES',
    entryPrice: 0, exitPrice: 0, size: 1, profitLoss: 0, setup: 'Breakout',
    reasonEmotion: '', runningPnl: 0, note: '', ...p,
  };
}

function day(date: string, trades: TradeRecord[]): DailyPnl {
  return { date, pnl: 0, tradeCount: trades.length, wins: 0, losses: 0, trades };
}

describe('dayDiscipline', () => {
  it('a clean low-volume day scores 100', () => {
    expect(dayDiscipline(day('2025-01-06', [trade({})]))).toBe(100);
  });

  it('deducts for behavioral mistakes in the note', () => {
    expect(dayDiscipline(day('2025-01-06', [trade({ reasonEmotion: 'revenge trade, no stop' })]))).toBeLessThan(100);
  });
});
