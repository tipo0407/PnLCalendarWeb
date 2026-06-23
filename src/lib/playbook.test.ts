import { describe, it, expect } from 'vitest';
import type { TradeRecord } from '../types';
import { setupStats } from './playbook';

function trade(setup: string, pnl: number): TradeRecord {
  return {
    rowNumber: 0, date: '2025-01-02', entryTime: null, exitTime: null,
    tradeNumber: 1, duration: null, direction: 'LONG', symbol: 'MES',
    entryPrice: 0, exitPrice: 0, size: 1, profitLoss: pnl, setup,
    reasonEmotion: '', runningPnl: 0, note: '',
  };
}

describe('setupStats', () => {
  it('computes per-setup metrics and sorts by expectancy', () => {
    const stats = setupStats([
      trade('Breakout', 100), trade('Breakout', -50), trade('Breakout', 80),
      trade('Reversal', -30), trade('Reversal', -20),
    ]);
    expect(stats[0].setup).toBe('Breakout');
    const bo = stats.find((s) => s.setup === 'Breakout')!;
    expect(bo.count).toBe(3);
    expect(bo.net).toBe(130);
    expect(bo.wins).toBe(2);
    expect(bo.losses).toBe(1);
    expect(bo.expectancy).toBeCloseTo(130 / 3, 5);
    expect(bo.profitFactor).toBeCloseTo(180 / 50, 5);
    const rev = stats.find((s) => s.setup === 'Reversal')!;
    expect(rev.profitFactor).toBe(0); // no wins
    expect(rev.expectancy).toBe(-25);
  });

  it('labels empty setups', () => {
    const stats = setupStats([trade('', 10)]);
    expect(stats[0].setup).toBe('(no setup)');
  });
});
