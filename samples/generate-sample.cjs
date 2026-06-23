/*
 * Generates samples/Trading.sample.xlsx — a realistic fake dataset (~300 trades
 * spread across a full year) showing the exact format the app expects.
 * Trade data lives on the 3rd worksheet (index 2). Deterministic (seeded).
 * Run: node samples/generate-sample.cjs
 */
const XLSX = require('xlsx');
const path = require('path');

const YEAR = 2025;
const PER_MONTH = 25; // ~300 trades total

// Seeded PRNG for reproducible output.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260623);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const round2 = (n) => Math.round(n * 100) / 100;

const serial = (y, m, d) => Date.UTC(y, m, d) / 86400000 + 25569;
const frac = (h, m) => (h * 3600 + m * 60) / 86400;

const HEADERS = [
  'Date', 'EntryTime', 'ExitTime', 'NoOfDay', 'Duration', 'Direction', 'Symbol',
  'EntryPrice', 'ExitPrice', 'Size', 'PL', 'Setup', 'Reason&Emotion', 'APL', 'Note',
];

const SETUPS = ['Reversal', 'Trend Continuation', 'Second Leg', 'Breakout', 'Range Fade', 'VWAP Reclaim', 'Failed Breakout', 'Opening Drive'];
const REASONS = [
  'Bounced off VWAP with a higher low; trailed to structure.',
  'Lower-high after a failed breakout, rode the 20EMA.',
  'Chased the open drive with no follow-through — scratched fast.',
  'Fought the trend on a strong day; waited for confirmation next time.',
  'Pullback to the 20EMA then continuation, added on strength.',
  'Faded the top of the overnight range back to the mean.',
  'Midday chop, low conviction — should have cut size.',
  'Clean trend day; let the runner work to the measured move.',
  'Counter-trend scalp that did not work; respect the higher timeframe.',
  'Good location at prior day low, quick in-and-out.',
  'Overtraded the lunch session, gave back morning gains.',
  'Patient entry at the 50% pullback, target at the high of day.',
];
const SYMBOLS = [
  { s: 'MES', w: 0.68, base: 5000, drift: 55, tick: 0.25 },
  { s: 'MNQ', w: 0.14, base: 17600, drift: 240, tick: 0.25 },
  { s: 'MGC', w: 0.12, base: 2360, drift: 9, tick: 0.1 },
  { s: 'M2K', w: 0.06, base: 2180, drift: 14, tick: 0.1 },
];
function pickSymbol() {
  let r = rnd();
  for (const sym of SYMBOLS) { if ((r -= sym.w) <= 0) return sym; }
  return SYMBOLS[0];
}

function weekdaysInMonth(year, month) {
  const out = [];
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  for (let d = 1; d <= days; d++) {
    const wd = new Date(Date.UTC(year, month, d)).getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d);
  }
  return out;
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const trades = [];
for (let month = 0; month < 12; month++) {
  const days = shuffle(weekdaysInMonth(YEAR, month));
  let count = 0;
  let di = 0;
  while (count < PER_MONTH && di < days.length) {
    const day = days[di++];
    const want = 1 + Math.floor(rnd() * 4); // 1..4 trades on this day
    const n = Math.min(want, PER_MONTH - count);
    for (let k = 0; k < n; k++) {
      const sym = pickSymbol();
      const eh = 6 + Math.floor(rnd() * 6); // 6..11
      const em = Math.floor(rnd() * 60);
      const durMin = 2 + Math.floor(rnd() * 55);
      let xt = eh * 60 + em + durMin;
      if (xt > 13 * 60) xt = 13 * 60; // cap at 13:00
      const xh = Math.floor(xt / 60);
      const xm = xt % 60;
      const isLong = rnd() < 0.52;
      const win = rnd() < 0.54;
      const size = 1 + Math.floor(rnd() * 3); // 1..3
      const mag = round2((8 + rnd() * 120) * (rnd() < 0.08 ? 1.8 : 1) * size);
      const pl = round2(win ? mag : -mag * (0.8 + rnd() * 0.5));
      const monthDrift = (month - 5.5) * (sym.drift / 6);
      const entry = round2(sym.base + monthDrift + (rnd() * 40 - 20));
      const ticks = 1 + Math.floor(rnd() * 40);
      const exit = round2(entry + (isLong ? 1 : -1) * (win ? 1 : -1) * ticks * sym.tick);
      trades.push({
        y: YEAR, mo: month, d: day,
        eh, em, xh, xm, no: k + 1,
        dir: isLong ? 'LONG' : 'SHORT', sym: sym.s,
        entry, exit, size, pl,
        setup: pick(SETUPS), reason: pick(REASONS),
      });
      count++;
    }
  }
}

// Sort by date, entry time, sequence; then compute running cumulative APL.
trades.sort((a, b) =>
  (a.y - b.y) || (a.mo - b.mo) || (a.d - b.d) ||
  (a.eh * 60 + a.em) - (b.eh * 60 + b.em) || (a.no - b.no)
);
let running = 0;
const rows = trades.map((t) => {
  running = round2(running + t.pl);
  return [
    serial(t.y, t.mo, t.d), frac(t.eh, t.em), frac(t.xh, t.xm), t.no,
    frac(t.xh, t.xm) - frac(t.eh, t.em), t.dir, t.sym, t.entry, t.exit,
    t.size, t.pl, t.setup, t.reason, running, '',
  ];
});

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['PnL Calendar sample workbook'], ['Trade data is on the 3rd sheet ("Trades").']]), 'ReadMe');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['(unused)']]), 'Scratch');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADERS, ...rows]), 'Trades');

const out = path.join(__dirname, 'Trading.sample.xlsx');
XLSX.writeFile(wb, out);
console.log('Wrote', out, 'with', rows.length, 'sample trades across', YEAR);
