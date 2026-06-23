import { describe, it, expect } from 'vitest';
import type { TradeRecord } from '../types';
import { generateInsights } from './insights';

function trade(p: Partial<TradeRecord>): TradeRecord {
  return {
    rowNumber: 0, date: '2025-01-06', entryTime: 8 * 3600, exitTime: null,
    tradeNumber: 1, duration: null, direction: 'LONG', symbol: 'MES',
    entryPrice: 0, exitPrice: 0, size: 1, profitLoss: 0, setup: 'Breakout',
    reasonEmotion: '', runningPnl: 0, note: '', ...p,
  };
}

describe('generateInsights', () => {
  it('returns nothing for too few trades', () => {
    expect(generateInsights([trade({ profitLoss: 10 })])).toEqual([]);
  });

  it('surfaces a winning setup and a losing setup', () => {
    const trades = [
      trade({ setup: 'Breakout', profitLoss: 100 }),
      trade({ setup: 'Breakout', profitLoss: 80 }),
      trade({ setup: 'Breakout', profitLoss: 60 }),
      trade({ setup: 'Reversal', profitLoss: -50 }),
      trade({ setup: 'Reversal', profitLoss: -40 }),
      trade({ setup: 'Reversal', profitLoss: -30 }),
    ];
    const ins = generateInsights(trades);
    expect(ins.length).toBeGreaterThan(0);
    expect(ins.some((i) => i.tone === 'good' && i.text.includes('Breakout'))).toBe(true);
    expect(ins.some((i) => i.tone === 'bad' && i.text.includes('Reversal'))).toBe(true);
  });

  it('ranks by impact (largest absolute P&L first)', () => {
    const trades = [
      trade({ setup: 'Big', profitLoss: 500 }),
      trade({ setup: 'Big', profitLoss: 400 }),
      trade({ setup: 'Big', profitLoss: 300 }),
      trade({ setup: 'Small', profitLoss: -10 }),
      trade({ setup: 'Small', profitLoss: -10 }),
      trade({ setup: 'Small', profitLoss: -10 }),
    ];
    const ins = generateInsights(trades);
    expect(ins[0].impact).toBeGreaterThanOrEqual(ins[ins.length - 1].impact);
  });
});
