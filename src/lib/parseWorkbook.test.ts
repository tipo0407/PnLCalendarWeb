import { describe, it, expect } from 'vitest';
import {
  parseDateCell, parseTimeCell, autoMap, parseSheet, guessSheetIndex, dedupeTrades,
  sniffDelimiter, readSheets,
  type SheetData,
} from './parseWorkbook';

describe('parseDateCell', () => {
  it('reads Excel serials', () => {
    expect(parseDateCell(46036)).toBe('2026-01-14');
  });
  it('reads ISO and slashed dates', () => {
    expect(parseDateCell('2026-06-23')).toBe('2026-06-23');
    expect(parseDateCell('2026/6/3')).toBe('2026-06-03');
  });
  it('reads US M/D/YYYY and swaps obvious D/M', () => {
    expect(parseDateCell('6/23/2026')).toBe('2026-06-23');
    expect(parseDateCell('23/6/2026')).toBe('2026-06-23');
  });
  it('reads D-Mon-YYYY', () => {
    expect(parseDateCell('23-Jun-2026')).toBe('2026-06-23');
  });
  it('returns null for junk/empty', () => {
    expect(parseDateCell('')).toBeNull();
    expect(parseDateCell('not a date')).toBeNull();
    expect(parseDateCell(null)).toBeNull();
  });
});

describe('parseTimeCell', () => {
  it('reads day fractions', () => {
    expect(parseTimeCell(0.5)).toBe(43200);
    expect(parseTimeCell(0)).toBe(0);
  });
  it('reads HH:MM and AM/PM', () => {
    expect(parseTimeCell('09:35')).toBe(9 * 3600 + 35 * 60);
    expect(parseTimeCell('9:35 AM')).toBe(9 * 3600 + 35 * 60);
    expect(parseTimeCell('1:05 PM')).toBe(13 * 3600 + 5 * 60);
    expect(parseTimeCell('12:00 AM')).toBe(0);
  });
  it('returns null for empty', () => {
    expect(parseTimeCell('')).toBeNull();
  });
});

describe('autoMap', () => {
  it('matches aliases case/punctuation-insensitively', () => {
    const m = autoMap(['Date', 'Side', 'Symbol', 'P/L', 'Reason&Emotion']);
    expect(m.date).toBe(0);
    expect(m.direction).toBe(1);
    expect(m.symbol).toBe(2);
    expect(m.profitLoss).toBe(3);
    expect(m.reasonEmotion).toBe(4);
  });
});

describe('parseSheet', () => {
  const sheet: SheetData = {
    name: 'Trades',
    rows: [
      ['Date', 'EntryTime', 'Direction', 'Symbol', 'PL'],
      [46036, 0.5, 'LONG', 'mes', 100],
      ['6/23/2026', '09:35', 'SHORT', 'MNQ', -40],
      ['', '', '', '', ''], // blank -> ignored
      ['garbage', '', 'LONG', 'MES', 10], // bad date -> skipped
    ],
  };
  it('parses, normalizes, sorts, and reports skips', () => {
    const m = autoMap(sheet.rows[0]);
    const res = parseSheet(sheet, m);
    expect(res.trades.length).toBe(2);
    expect(res.skipped.length).toBe(1);
    expect(res.total).toBe(3); // blank row not counted
    expect(res.trades[0].symbol).toBe('MES'); // uppercased
    expect(res.trades[0].profitLoss).toBe(100);
    // sorted ascending by date
    expect(res.trades[0].date <= res.trades[1].date).toBe(true);
  });
});

describe('guessSheetIndex', () => {
  it('picks the sheet whose header best matches', () => {
    const sheets: SheetData[] = [
      { name: 'Notes', rows: [['hello', 'world']] },
      { name: 'Trades', rows: [['Date', 'PL', 'Symbol']] },
    ];
    expect(guessSheetIndex(sheets)).toBe(1);
  });
});

describe('parseSheet dedupe', () => {
  it('drops exact-duplicate rows on import', () => {
    const sheet: SheetData = {
      name: 'Trades',
      rows: [
        ['Date', 'Symbol', 'Direction', 'P&L'],
        ['2025-03-03', 'MES', 'Long', 120],
        ['2025-03-03', 'MES', 'Short', -40],
        ['2025-03-04', 'MNQ', 'Long', 75],
        ['2025-03-03', 'MES', 'Long', 120], // duplicate of row 1
      ],
    };
    const mapping = autoMap(sheet.rows[0]);
    const result = parseSheet(sheet, mapping);
    expect(result.total).toBe(4);       // 4 data rows seen
    expect(result.trades).toHaveLength(3); // 1 duplicate removed
  });
});

describe('dedupeTrades', () => {
  it('keeps the first of identical trades', () => {
    const mk = (pnl: number) => ({
      rowNumber: 0, date: '2025-03-03', entryTime: null, exitTime: null, tradeNumber: 0,
      duration: null, direction: 'LONG', symbol: 'MES', entryPrice: 0, exitPrice: 0, size: 1,
      profitLoss: pnl, setup: '', reasonEmotion: '', runningPnl: 0, note: '',
    });
    expect(dedupeTrades([mk(10), mk(10), mk(20)])).toHaveLength(2);
  });
});

describe('sniffDelimiter', () => {
  it('detects comma, semicolon, tab and pipe', () => {
    expect(sniffDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(sniffDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(sniffDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
    expect(sniffDelimiter('a|b|c\n1|2|3')).toBe('|');
  });
  it('falls back to comma on ambiguous input', () => {
    expect(sniffDelimiter('singlecolumn')).toBe(',');
  });
});

describe('readSheets with delimiter auto-detect', () => {
  function buf(s: string): ArrayBuffer {
    return new TextEncoder().encode(s).buffer;
  }
  it('parses a semicolon-delimited CSV into columns', () => {
    const sheets = readSheets(buf('Date;Symbol;P/L\n2025-01-02;MES;125'));
    const rows = sheets[0].rows;
    expect(rows[0]).toEqual(['Date', 'Symbol', 'P/L']);
    expect(rows[1].map(String)).toEqual(['2025-01-02', 'MES', '125']);
  });
  it('parses a tab-delimited file into columns', () => {
    const sheets = readSheets(buf('Date\tSymbol\tP/L\n2025-01-02\tMES\t-40'));
    expect(sheets[0].rows[0]).toEqual(['Date', 'Symbol', 'P/L']);
  });
});
