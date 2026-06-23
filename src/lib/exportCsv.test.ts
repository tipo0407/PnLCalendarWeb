import { describe, it, expect } from 'vitest';
import type { TradeRecord } from '../types';
import { tradesToCsv } from './exportCsv';

function trade(p: Partial<TradeRecord>): TradeRecord {
  return {
    rowNumber: 1, date: '2025-06-02', entryTime: 34200, exitTime: null,
    tradeNumber: 1, duration: null, direction: 'LONG', symbol: 'MES',
    entryPrice: 5000, exitPrice: 5010, size: 2, profitLoss: 100, setup: 'Breakout',
    reasonEmotion: 'calm, by the plan', runningPnl: 0, note: '', ...p,
  };
}

describe('tradesToCsv', () => {
  it('writes a header and one row per trade', () => {
    const csv = tradesToCsv([trade({})]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('Date');
    expect(lines[0]).toContain('P&L');
    expect(lines[0]).toContain('Cumulative');
    expect(lines[0]).toContain('R');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('2025-06-02');
    expect(lines[1]).toContain('09:30:00'); // 34200s -> 09:30:00
    expect(lines[1]).toContain('100');
  });
  it('computes a running cumulative column', () => {
    const csv = tradesToCsv([trade({ profitLoss: 100 }), trade({ profitLoss: -40 })]);
    const lines = csv.split('\r\n');
    expect(lines[1].endsWith('100.00,')).toBe(true); // cum after row 1, R blank (no risk)
    expect(lines[2].endsWith('60.00,')).toBe(true);  // cum after row 2
  });
  it('quotes cells containing commas', () => {
    const csv = tradesToCsv([trade({ reasonEmotion: 'fomo, chased' })]);
    expect(csv).toContain('"fomo, chased"');
  });
});
