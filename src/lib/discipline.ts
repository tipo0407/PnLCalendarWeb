import type { DailyPnl } from '../types';
import { detectTags } from './tags';

/**
 * A transparent 0–100 discipline score for a trading day. Starts at 100 and
 * deducts for behavioral mistakes and overtrading — independent of whether the
 * day was green or red (you can lose money with great discipline, and vice versa).
 */
export function dayDiscipline(day: DailyPnl): number {
  let score = 100;
  let mistakeHits = 0;
  for (const t of day.trades) mistakeHits += detectTags(t).length;
  score -= Math.min(40, mistakeHits * 8);
  if (day.tradeCount > 4) score -= Math.min(20, (day.tradeCount - 4) * 5);
  return Math.max(0, Math.round(score));
}

/** Average discipline across the given days. */
export function avgDiscipline(days: DailyPnl[]): number {
  if (days.length === 0) return 0;
  return Math.round(days.reduce((s, d) => s + dayDiscipline(d), 0) / days.length);
}

/** Color token for a discipline score. */
export function disciplineColor(score: number): string {
  if (score >= 80) return 'var(--pos)';
  if (score >= 60) return 'var(--gold-fg)';
  return 'var(--neg)';
}

export interface DisciplinePoint {
  /** Week-start ISO key. */
  week: string;
  /** Average discipline (0–100) for the week. */
  score: number;
  /** Number of trading days in the week. */
  days: number;
}

/**
 * Average discipline per week over time, oldest week first. Lets a trader see
 * whether their process is improving even when P&L is noisy — the behavioral
 * analogue of an equity curve.
 */
export function disciplineTrend(days: DailyPnl[], weekKeyOf: (date: string) => string): DisciplinePoint[] {
  const buckets = new Map<string, { sum: number; n: number }>();
  for (const d of days) {
    const k = weekKeyOf(d.date);
    const b = buckets.get(k) ?? { sum: 0, n: 0 };
    b.sum += dayDiscipline(d);
    b.n += 1;
    buckets.set(k, b);
  }
  return [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([week, b]) => ({ week, score: Math.round(b.sum / b.n), days: b.n }));
}
