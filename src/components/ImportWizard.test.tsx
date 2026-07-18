// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { SheetData } from '../lib/parseWorkbook';
import ImportWizard from './ImportWizard';

afterEach(cleanup);

const sheets: SheetData[] = [
  {
    name: 'Trades',
    rows: [
      ['Date', 'Symbol', 'Direction', 'P&L'],
      ['2025-06-02', 'MES', 'LONG', 100],
    ],
  },
];

describe('ImportWizard', () => {
  it('gives the dialog an accessible name via aria-labelledby', () => {
    render(<ImportWizard sheets={sheets} onImport={vi.fn()} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    const labelledby = dialog.getAttribute('aria-labelledby');
    expect(labelledby).toBeTruthy();
    const heading = document.getElementById(labelledby!);
    expect(heading).toBeInTheDocument();
    expect(heading!.textContent?.trim().length).toBeGreaterThan(0);
    // The dialog therefore has a non-empty accessible name.
    expect(dialog).toHaveAccessibleName();
  });
});
