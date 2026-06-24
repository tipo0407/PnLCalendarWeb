import { describe, it, expect } from 'vitest';
import type { TradeRecord } from '../types';
import { computeSummary, dailyEquityCurve, movingWinRate, hourEdgeBySymbol, dayOfWeekEdge, holdTimeEdge } from './metrics';

function trade(p: Partial<TradeRecord>): TradeRecord {
  return {
    rowNumber: 0, date: '2025-01-02', entryTime: null, exitTime: null,
    tradeNumber: 1, duration: null, direction: 'LONG', symbol: 'MES',
    entryPrice: 0, exitPrice: 0, size: 1, profitLoss: 0, setup: '',
    reasonEmotion: '', runningPnl: 0, note: '', ...p,
  };
}

const SET: TradeRecord[] = [
  trade({ date: '2025-01-02', profitLoss: 100, entryTime: 6 * 3600 + 30 * 60, symbol: 'MES' }),
  trade({ date: '2025-01-02', profitLoss: -40, entryTime: 7 * 3600, symbol: 'MES' }),
  trade({ date: '2025-01-03', profitLoss: 60, entryTime: 6 * 3600 + 45 * 60, symbol: 'MNQ' }),
];

describe('dayOfWeekEdge', () => {
  it('buckets net P&L by weekday in Mon-first order', () => {
    // 2025-01-02 is a Thursday, 2025-01-03 a Friday
    const edge = dayOfWeekEdge(SET);
    const thu = edge.find((e) => e.key === 'Thu')!;
    const fri = edge.find((e) => e.key === 'Fri')!;
    expect(thu.pnl).toBe(60); // 100 - 40
    expect(thu.count).toBe(2);
    expect(fri.pnl).toBe(60);
    // Mon-first ordering: Thu appears before Fri
    expect(edge.map((e) => e.key)).toEqual(['Thu', 'Fri']);
  });
});

describe('holdTimeEdge', () => {
  it('buckets by duration and skips trades without one', () => {
    const data = [
      trade({ profitLoss: 50, duration: 30 }),     // <1m
      trade({ profitLoss: -20, duration: 200 }),    // 1-5m
      trade({ profitLoss: 80, duration: 200 }),     // 1-5m
      trade({ profitLoss: 999, duration: null }),   // skipped
    ];
    const edge = holdTimeEdge(data);
    expect(edge.find((e) => e.key === '<1m')!.pnl).toBe(50);
    const mid = edge.find((e) => e.key === '1–5m')!;
    expect(mid.pnl).toBe(60);
    expect(mid.count).toBe(2);
    expect(edge.reduce((n, e) => n + e.count, 0)).toBe(3); // null excluded
  });
  it('returns empty when no durations present', () => {
    expect(holdTimeEdge([trade({ duration: null })])).toEqual([]);
  });
});

describe('computeSummary', () => {
  const s = computeSummary(SET);
  it('aggregates totals and rates', () => {
    expect(s.totalPnl).toBe(120);
    expect(s.tradeCount).toBe(3);
    expect(s.tradingDays).toBe(2);
    expect(s.winTrades).toBe(2);
    expect(s.lossTrades).toBe(1);
    expect(s.profitFactor).toBe(4); // 160 / 40
    expect(s.avgWin).toBe(80);
    expect(s.avgLoss).toBe(40);
  });
  it('computes expectancy and drawdown', () => {
    expect(Math.round(s.expectancy)).toBe(40);
    expect(s.maxDrawdown).toBe(-40);
  });
  it('handles empty input', () => {
    const e = computeSummary([]);
    expect(e.totalPnl).toBe(0);
    expect(e.tradeCount).toBe(0);
    expect(e.profitFactor).toBe(0);
  });
});

describe('dailyEquityCurve', () => {
  it('accumulates per day', () => {
    const eq = dailyEquityCurve(SET);
    expect(eq.map((e) => e.cumulative)).toEqual([60, 120]);
  });
});

describe('movingWinRate', () => {
  it('starts at the first full window', () => {
    const wr = movingWinRate(SET, 2);
    // 3 trades, window 2 -> points from trade #2 onward
    expect(wr[0].i).toBe(2);
    expect(wr[wr.length - 1].i).toBe(3);
  });
});

describe('hourEdgeBySymbol', () => {
  it('filters by symbol and buckets by hour', () => {
    const all = hourEdgeBySymbol(SET, 'All');
    expect(all.length).toBeGreaterThan(0);
    const mes = hourEdgeBySymbol(SET, 'MES');
    const totalMes = mes.reduce((s, h) => s + h.pnl, 0);
    expect(totalMes).toBe(60); // 100 - 40
  });
});

