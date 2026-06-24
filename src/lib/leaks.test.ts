import { describe, it, expect } from 'vitest';
import type { TradeRecord } from '../types';
import { findLeaks } from './leaks';

function trade(p: Partial<TradeRecord>): TradeRecord {
  return {
    rowNumber: 0, date: '2025-01-06', entryTime: 8 * 3600, exitTime: null,
    tradeNumber: 1, duration: null, direction: 'LONG', symbol: 'MES',
    entryPrice: 0, exitPrice: 0, size: 1, profitLoss: 0, setup: 'Breakout',
    reasonEmotion: '', runningPnl: 0, note: '', ...p,
  };
}

describe('findLeaks', () => {
  it('returns nothing for too few trades', () => {
    expect(findLeaks([trade({ profitLoss: -10 })])).toEqual([]);
  });

  it('surfaces a losing setup ranked by total dollars lost', () => {
    const trades = [
      trade({ setup: 'Breakout', profitLoss: 100 }),
      trade({ setup: 'Breakout', profitLoss: 80 }),
      trade({ setup: 'Breakout', profitLoss: 60 }),
      trade({ setup: 'Reversal', profitLoss: -50 }),
      trade({ setup: 'Reversal', profitLoss: -40 }),
      trade({ setup: 'Reversal', profitLoss: -30 }),
    ];
    const leaks = findLeaks(trades);
    const setupLeak = leaks.find((l) => l.dimension === 'setup' && l.value === 'Reversal');
    expect(setupLeak).toBeTruthy();
    expect(setupLeak!.net).toBe(-120);
    expect(setupLeak!.count).toBe(3);
    expect(setupLeak!.avg).toBe(-40);
  });

  it('ignores small-sample buckets and profitable buckets', () => {
    const trades = [
      trade({ setup: 'A', profitLoss: -100 }), // single trade, below minCount
      trade({ setup: 'B', profitLoss: 50 }),
      trade({ setup: 'B', profitLoss: 50 }),
      trade({ setup: 'B', profitLoss: 50 }),
      trade({ setup: 'B', profitLoss: 50 }),
    ];
    const leaks = findLeaks(trades);
    expect(leaks.some((l) => l.value === 'A')).toBe(false);
    expect(leaks.some((l) => l.value === 'B')).toBe(false);
  });

  it('biggest leak comes first', () => {
    const trades = [
      trade({ setup: '', direction: '', symbol: 'AAA', entryTime: null, profitLoss: -10 }),
      trade({ setup: '', direction: '', symbol: 'AAA', entryTime: null, profitLoss: -10 }),
      trade({ setup: '', direction: '', symbol: 'AAA', entryTime: null, profitLoss: -10 }),
      trade({ setup: '', direction: '', symbol: 'BBB', entryTime: null, profitLoss: -200 }),
      trade({ setup: '', direction: '', symbol: 'BBB', entryTime: null, profitLoss: -200 }),
      trade({ setup: '', direction: '', symbol: 'BBB', entryTime: null, profitLoss: -200 }),
    ];
    const leaks = findLeaks(trades, undefined, { limit: 20 });
    expect(leaks[0].net).toBeLessThanOrEqual(leaks[leaks.length - 1].net);
    const bbb = leaks.findIndex((l) => l.dimension === 'symbol' && l.value === 'BBB');
    const aaa = leaks.findIndex((l) => l.dimension === 'symbol' && l.value === 'AAA');
    expect(bbb).toBeGreaterThanOrEqual(0);
    expect(bbb).toBeLessThan(aaa); // bigger symbol leak ranks ahead of the smaller one
    expect(leaks[bbb].net).toBe(-600);
  });
});
