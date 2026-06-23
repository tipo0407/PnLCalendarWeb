import type { TradeRecord } from '../types';
import { groupByDay } from './metrics';

export interface Rules {
  maxDailyLoss: number;   // stop for the day after losing this much ($)
  maxTradesPerDay: number;
  windowStart: number;    // trading window start hour (local)
  windowEnd: number;      // trading window end hour (local, exclusive)
}

export const DEFAULT_RULES: Rules = {
  maxDailyLoss: 300,
  maxTradesPerDay: 4,
  windowStart: 6,
  windowEnd: 13,
};

const KEY = 'pnlcalendar.rules.v1';

export function loadRules(): Rules {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return { ...DEFAULT_RULES, ...JSON.parse(s) };
  } catch {
    // ignore
  }
  return DEFAULT_RULES;
}

export function saveRules(r: Rules): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // ignore
  }
}

export interface RuleViolation {
  key: string;
  label: string;
  count: number;   // # of violating days or trades
  impact: number;  // P&L attributable to the violations
}

/** Evaluate rule adherence across all trades. */
export function evaluateRules(trades: TradeRecord[], rules: Rules): RuleViolation[] {
  const days = [...groupByDay(trades).values()];
  const maxLoss = { count: 0, impact: 0 };
  const over = { count: 0, impact: 0 };
  const off = { count: 0, impact: 0 };
  const revenge = { count: 0, impact: 0 };

  for (const day of days) {
    if (day.pnl <= -rules.maxDailyLoss) { maxLoss.count++; maxLoss.impact += day.pnl; }
    if (day.tradeCount > rules.maxTradesPerDay) {
      over.count++;
      // impact = P&L of trades beyond the limit (chronological).
      const sorted = [...day.trades].sort((a, b) => (a.entryTime ?? 0) - (b.entryTime ?? 0));
      over.impact += sorted.slice(rules.maxTradesPerDay).reduce((s, t) => s + t.profitLoss, 0);
    }

    const sorted = [...day.trades].sort((a, b) => (a.entryTime ?? 0) - (b.entryTime ?? 0));
    let cum = 0;
    let breached = false;
    for (const t of sorted) {
      if (t.entryTime != null) {
        const h = Math.floor(t.entryTime / 3600);
        if (h < rules.windowStart || h >= rules.windowEnd) { off.count++; off.impact += t.profitLoss; }
      }
      if (breached) { revenge.count++; revenge.impact += t.profitLoss; }
      cum += t.profitLoss;
      if (cum <= -rules.maxDailyLoss) breached = true;
    }
  }

  return [
    { key: 'maxLoss', label: `Days past −$${rules.maxDailyLoss} loss`, ...maxLoss },
    { key: 'over', label: `Days over ${rules.maxTradesPerDay} trades`, ...over },
    { key: 'revenge', label: 'Trades after hitting daily stop', ...revenge },
    { key: 'off', label: `Trades outside ${rules.windowStart}:00–${rules.windowEnd}:00`, ...off },
  ];
}
