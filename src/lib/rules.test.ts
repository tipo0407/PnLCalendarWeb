import { describe, it, expect } from 'vitest';
import type { TradeRecord } from '../types';
import { evaluateRules, DEFAULT_RULES } from './rules';

function trade(p: Partial<TradeRecord>): TradeRecord {
  return {
    rowNumber: 0, date: '2025-01-02', entryTime: null, exitTime: null,
    tradeNumber: 1, duration: null, direction: 'LONG', symbol: 'MES',
    entryPrice: 0, exitPrice: 0, size: 1, profitLoss: 0, setup: '',
    reasonEmotion: '', runningPnl: 0, note: '', ...p,
  };
}

describe('evaluateRules', () => {
  const trades: TradeRecord[] = [
    trade({ entryTime: 6 * 3600, profitLoss: 50 }),
    trade({ entryTime: 7 * 3600, profitLoss: -400 }), // cum -350 -> daily stop breached
    trade({ entryTime: 8 * 3600, profitLoss: -20 }),  // revenge
    trade({ entryTime: 9 * 3600, profitLoss: 30 }),   // revenge
    trade({ entryTime: 14 * 3600, profitLoss: 10 }),  // off-hours + revenge + 5th trade
  ];
  const v = evaluateRules(trades, DEFAULT_RULES);
  const by = Object.fromEntries(v.map((x) => [x.key, x]));

  it('flags the daily loss day', () => {
    expect(by.maxLoss.count).toBe(1);
    expect(by.maxLoss.impact).toBe(-330);
  });
  it('flags overtrading (beyond 4)', () => {
    expect(by.over.count).toBe(1);
    expect(by.over.impact).toBe(10);
  });
  it('flags revenge trades after the daily stop', () => {
    expect(by.revenge.count).toBe(3);
  });
  it('flags off-hours trades', () => {
    expect(by.off.count).toBe(1);
    expect(by.off.impact).toBe(10);
  });
});
