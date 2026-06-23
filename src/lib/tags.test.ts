import { describe, it, expect } from 'vitest';
import type { TradeRecord } from '../types';
import { detectTags, tagEdge } from './tags';

function trade(p: Partial<TradeRecord>): TradeRecord {
  return {
    rowNumber: 0, date: '2025-01-02', entryTime: null, exitTime: null,
    tradeNumber: 1, duration: null, direction: 'LONG', symbol: 'MES',
    entryPrice: 0, exitPrice: 0, size: 1, profitLoss: 0, setup: '',
    reasonEmotion: '', runningPnl: 0, note: '', ...p,
  };
}

describe('detectTags', () => {
  it('detects English mistakes', () => {
    expect(detectTags(trade({ reasonEmotion: 'Chased the open drive, FOMO' })).sort())
      .toEqual(['chase', 'fomo']);
  });
  it('detects Chinese mistakes', () => {
    expect(detectTags(trade({ reasonEmotion: '手痒，重仓赌反转' })).sort())
      .toEqual(['counter', 'fomo', 'gamble', 'oversize']);
  });
  it('returns nothing for clean notes', () => {
    expect(detectTags(trade({ reasonEmotion: 'Clean trend follow, trailed to structure' }))).toEqual([]);
  });
  it('merges manual tags with auto-detected ones (union, de-duped)', () => {
    const t = trade({ date: '2025-01-02', tradeNumber: 1, reasonEmotion: 'FOMO' });
    const userTags = { '2025-01-02#1': { mistakes: ['oversize', 'fomo'], emotions: [] } };
    expect(detectTags(t, userTags).sort()).toEqual(['fomo', 'oversize']);
  });
  it('applies manual tags even when journal text is empty', () => {
    const t = trade({ date: '2025-01-02', tradeNumber: 2, reasonEmotion: '' });
    const userTags = { '2025-01-02#2': { mistakes: ['revenge'], emotions: [] } };
    expect(detectTags(t, userTags)).toEqual(['revenge']);
  });
});

describe('tagEdge', () => {
  it('aggregates P&L per tag and sorts biggest leak first', () => {
    const edges = tagEdge([
      trade({ reasonEmotion: 'fomo', profitLoss: -50 }),
      trade({ reasonEmotion: 'fomo', profitLoss: -30 }),
      trade({ reasonEmotion: 'overtrade', profitLoss: 10 }),
    ]);
    expect(edges[0].key).toBe('fomo');
    expect(edges[0].pnl).toBe(-80);
    expect(edges[0].count).toBe(2);
  });
});
