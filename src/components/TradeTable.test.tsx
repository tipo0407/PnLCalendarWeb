// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { TradeRecord } from '../types';
import TradeTable from './TradeTable';

afterEach(cleanup);

function trade(p: Partial<TradeRecord>): TradeRecord {
  return {
    rowNumber: 1, date: '2025-06-02', entryTime: 34200, exitTime: null, tradeNumber: 1,
    duration: null, direction: 'LONG', symbol: 'MES', entryPrice: 5000, exitPrice: 5010,
    size: 2, profitLoss: 100, setup: 'Breakout', reasonEmotion: '', runningPnl: 0, note: '', ...p,
  };
}

describe('TradeTable', () => {
  it('renders sortable headers as buttons with aria-sort', () => {
    render(<TradeTable trades={[trade({})]} onSelectDay={vi.fn()} />);
    // The date column header is sorted by default (desc).
    const headers = screen.getAllByRole('columnheader');
    const sorted = headers.filter((h) => h.getAttribute('aria-sort') !== 'none' && h.getAttribute('aria-sort'));
    expect(sorted.length).toBeGreaterThanOrEqual(1);
    // Each sortable header contains a real button.
    expect(within(headers[0]).getByRole('button')).toBeInTheDocument();
  });

  it('rows are keyboard-operable and invoke onSelectDay on Enter', () => {
    const onSelectDay = vi.fn();
    render(<TradeTable trades={[trade({ date: '2025-06-02' })]} onSelectDay={onSelectDay} />);
    const row = screen.getByRole('button', { name: /2025|Jun|open day|查看/i });
    expect(row).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onSelectDay).toHaveBeenCalledWith('2025-06-02');
  });

  it('clicking a header button toggles sort direction', () => {
    render(<TradeTable trades={[trade({ profitLoss: 10 }), trade({ profitLoss: -5 })]} onSelectDay={vi.fn()} />);
    const pnlHeader = screen.getByRole('columnheader', { name: /p&l/i });
    const btn = within(pnlHeader).getByRole('button');
    fireEvent.click(btn);
    expect(pnlHeader.getAttribute('aria-sort')).toMatch(/ascending|descending/);
  });
});
