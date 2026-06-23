import { describe, it, expect } from 'vitest';
import { detectTemplate, applyTemplate, BROKER_TEMPLATES } from './brokerTemplates';

describe('brokerTemplates', () => {
  it('detects NinjaTrader export from signature headers', () => {
    const headers = ['Instrument', 'Market pos.', 'Qty', 'Entry price', 'Exit price', 'Entry time', 'Exit time', 'Profit', 'Cum. net profit'];
    const tpl = detectTemplate(headers);
    expect(tpl?.id).toBe('ninjatrader');
    const map = applyTemplate(headers, tpl!);
    expect(map.symbol).toBe(headers.indexOf('Instrument'));
    expect(map.profitLoss).toBe(headers.indexOf('Profit'));
    expect(map.entryPrice).toBe(headers.indexOf('Entry price'));
  });

  it('detects Tradovate export', () => {
    const headers = ['symbol', 'qty', 'buyPrice', 'sellPrice', 'pnl', 'boughtTimestamp', 'soldTimestamp'];
    const tpl = detectTemplate(headers);
    expect(tpl?.id).toBe('tradovate');
    const map = applyTemplate(headers, tpl!);
    expect(map.profitLoss).toBe(headers.indexOf('pnl'));
    expect(map.symbol).toBe(headers.indexOf('symbol'));
  });

  it('detects Webull, Rithmic and generic-long exports', () => {
    const wb = ['Symbol', 'Side', 'Filled', 'Avg Price', 'Filled Time', 'Realized P&L'];
    expect(detectTemplate(wb)?.id).toBe('webull');

    const ri = ['Account', 'Symbol', 'Buy/Sell', 'Fill Size', 'Fill Price', 'Update Time'];
    expect(detectTemplate(ri)?.id).toBe('rithmic');

    const gl = ['Trade Date', 'Symbol', 'Direction', 'Quantity', 'Entry Price', 'Exit Price', 'Profit/Loss'];
    const tpl = detectTemplate(gl);
    expect(tpl?.id).toBe('generic-long');
    const map = applyTemplate(gl, tpl!);
    expect(map.entryPrice).toBe(gl.indexOf('Entry Price'));
    expect(map.profitLoss).toBe(gl.indexOf('Profit/Loss'));
  });

  it('returns null when no broker signature matches', () => {
    expect(detectTemplate(['Date', 'Symbol', 'P&L'])).toBeNull();
  });

  it('every template maps a date and P&L candidate', () => {
    for (const t of BROKER_TEMPLATES) {
      expect(t.columns.date && t.columns.date.length).toBeGreaterThan(0);
      expect(t.columns.profitLoss && t.columns.profitLoss.length).toBeGreaterThan(0);
    }
  });
});
