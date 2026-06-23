/*
 * Generates samples/Trading.sample.xlsx — a fake dataset showing the exact
 * format the app expects. Trade data lives on the 3rd worksheet (index 2).
 * Run: node samples/generate-sample.cjs
 */
const XLSX = require('xlsx');
const path = require('path');

// Excel serial (days since 1899-12-30) for an ISO date at UTC midnight.
const serial = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000 + 25569;
};
// Fraction of a day for HH:MM(:SS).
const frac = (h, m, s = 0) => (h * 3600 + m * 60 + s) / 86400;

const HEADERS = [
  'Date', 'EntryTime', 'ExitTime', 'NoOfDay', 'Duration', 'Direction', 'Symbol',
  'EntryPrice', 'ExitPrice', 'Size', 'PL', 'Setup', 'Reason&Emotion', 'APL', 'Note',
];

// [date, eh,em, xh,xm, noOfDay, dir, sym, entry, exit, size, pl, setup, reason]
const RAW = [
  ['2026-06-15', 6, 32, 6, 41, 1, 'LONG', 'MES', 5421.25, 5428.5, 1, 36.26, 'Reversal', 'Bounced off VWAP with a higher low; took partial into the prior high.'],
  ['2026-06-15', 7, 10, 7, 18, 2, 'SHORT', 'MES', 5431.0, 5424.75, 1, 31.26, 'Trend Continuation', 'Lower-high after failed breakout, rode the 20EMA down.'],
  ['2026-06-16', 6, 35, 6, 35, 1, 'LONG', 'MES', 5440.5, 5436.0, 1, -22.51, 'Breakout', 'Chased the open drive, no follow-through — scratched fast (same bar).'],
  ['2026-06-16', 9, 5, 9, 47, 2, 'SHORT', 'MES', 5447.75, 5455.25, 2, -75.02, 'Reversal', 'Fought the trend on a strong day; should have waited for confirmation.'],
  ['2026-06-17', 6, 40, 7, 2, 1, 'LONG', 'MES', 5460.0, 5471.5, 1, 57.5, 'Second Leg', 'Pullback to 20EMA then continuation, trailed to structure.'],
  ['2026-06-17', 7, 30, 7, 33, 2, 'LONG', 'MES', 5469.25, 5466.0, 1, -16.25, 'Second Leg Breakout', 'Entered late on the breakout, stop just under the trigger.'],
  ['2026-06-18', 6, 31, 7, 5, 1, 'SHORT', 'MGC', 2418.4, 2415.1, 1, 33.0, 'Range Fade', 'Faded the top of the overnight range back to the mean.'],
  ['2026-06-18', 11, 12, 11, 40, 2, 'LONG', 'MES', 5452.0, 5447.25, 2, -47.5, 'Reversal', 'Midday chop, low conviction — cut the size next time.'],
  ['2026-06-19', 6, 45, 7, 20, 1, 'LONG', 'MES', 5480.5, 5495.75, 2, 152.5, 'Trend Continuation', 'Best trade of the week: clean trend day, added on the first pullback.'],
  ['2026-06-19', 8, 2, 8, 9, 2, 'SHORT', 'MNQ', 19250.0, 19262.5, 1, -25.0, 'Reversal', 'Counter-trend scalp that did not work; respect the higher timeframe.'],
];

let running = 0;
const rows = RAW.map((r) => {
  const [date, eh, em, xh, xm, no, dir, sym, entry, exit, size, pl, setup, reason] = r;
  running += pl;
  const dur = frac(xh, xm) - frac(eh, em);
  return [
    serial(date), frac(eh, em), frac(xh, xm), no, dur, dir, sym,
    entry, exit, size, pl, setup, reason, running, '',
  ];
});

const wb = XLSX.utils.book_new();
// Sheets 1 & 2 are placeholders; the app reads trade data from the 3rd sheet.
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['PnL Calendar sample workbook'], ['Trade data is on the 3rd sheet ("Trades").']]), 'ReadMe');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['(unused)']]), 'Scratch');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADERS, ...rows]), 'Trades');

const out = path.join(__dirname, 'Trading.sample.xlsx');
XLSX.writeFile(wb, out);
console.log('Wrote', out, 'with', rows.length, 'sample trades.');
