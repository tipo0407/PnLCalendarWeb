import { describe, it, expect } from 'vitest';
import { ema, vwap, type Candle } from './marketData';

function candle(p: Partial<Candle>): Candle {
  return { time: 0, open: 10, high: 12, low: 8, close: 10, volume: 100, ...p };
}

describe('vwap', () => {
  it('weights by volume across bars', () => {
    const bars = [
      candle({ time: 1, high: 10, low: 10, close: 10, volume: 100 }), // typical 10
      candle({ time: 2, high: 20, low: 20, close: 20, volume: 300 }), // typical 20
    ];
    const out = vwap(bars);
    expect(out[0].value).toBeCloseTo(10, 6);
    // (10*100 + 20*300) / 400 = 17.5
    expect(out[1].value).toBeCloseTo(17.5, 6);
  });

  it('skips zero-volume bars instead of substituting volume 1', () => {
    const bars = [
      candle({ time: 1, high: 10, low: 10, close: 10, volume: 100 }),
      candle({ time: 2, high: 50, low: 50, close: 50, volume: 0 }), // ignored
    ];
    const out = vwap(bars);
    expect(out[0].value).toBeCloseTo(10, 6);
    // The zero-volume bar must not drag VWAP toward 50.
    expect(out[1].value).toBeCloseTo(10, 6);
  });

  it('falls back to typical price before any volume is seen', () => {
    const out = vwap([candle({ time: 1, high: 12, low: 6, close: 9, volume: 0 })]);
    expect(out[0].value).toBeCloseTo((12 + 6 + 9) / 3, 6);
  });
});

describe('ema', () => {
  it('returns an empty series for no candles', () => {
    expect(ema([], 20)).toEqual([]);
  });
  it('seeds from the first close and stays aligned to candle times', () => {
    const bars = [candle({ time: 1, close: 10 }), candle({ time: 2, close: 20 })];
    const out = ema(bars, 9);
    expect(out).toHaveLength(2);
    expect(out[0].value).toBe(10);
    expect(out[0].time).toBe(1);
    expect(out[1].value).toBeGreaterThan(10);
    expect(out[1].value).toBeLessThan(20);
  });
});
