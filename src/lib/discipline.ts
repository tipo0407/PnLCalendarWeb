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
