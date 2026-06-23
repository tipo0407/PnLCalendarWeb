import { describe, it, expect } from 'vitest';
import {
  parseDateCell, parseTimeCell, autoMap, parseSheet, guessSheetIndex,
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
