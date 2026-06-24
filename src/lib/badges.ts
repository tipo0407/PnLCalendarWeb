import type { DailyPnl } from '../types';
import { dayDiscipline } from './discipline';

export interface Badge {
  id: string;
  /** Short title, e.g. "Disciplined". */
  title: string;
  /** One-line description of what was achieved. */
  detail: string;
  /** Lucide icon name the UI maps to a component. */
  icon: 'flame' | 'shield' | 'target' | 'trophy' | 'sun' | 'trending';
  tone: 'good' | 'neutral';
}

export interface BadgeInput {
  /** Current consecutive winning-day streak. */
  winStreak: number;
  /** Number of consecutive most-recent weeks marked reviewed. */
  reviewStreak: number;
  /** All trading days (for discipline + green-day ratio). */
  days: DailyPnl[];
  /** Net P&L of the most recent calendar month. */
  monthPnl: number;
  /** Whether a monthly goal is set and was met this month. */
  goalMet: boolean;
}

/**
 * Derive a small set of earned "achievement" badges from the trader's record.
 * Pure and deterministic. Encourages process (discipline, review cadence,
 * consistency) rather than only P&L — and is unit testable.
 */
export function earnedBadges(input: BadgeInput): Badge[] {
  const out: Badge[] = [];
  const { days } = input;
  const tradingDays = days.length;

  if (input.winStreak >= 3) {
    out.push({ id: 'streak', title: 'On a roll', detail: `${input.winStreak} green days in a row`, icon: 'flame', tone: 'good' });
  }

  if (tradingDays >= 5) {
    const avgDisc = Math.round(days.reduce((s, d) => s + dayDiscipline(d), 0) / tradingDays);
    if (avgDisc >= 85) {
      out.push({ id: 'disciplined', title: 'Disciplined', detail: `${avgDisc}/100 average discipline`, icon: 'shield', tone: 'good' });
    }
  }

  if (input.reviewStreak >= 2) {
    out.push({ id: 'reviewer', title: 'Reviewer', detail: `${input.reviewStreak} weeks reviewed in a row`, icon: 'target', tone: 'good' });
  }

  if (input.goalMet) {
    out.push({ id: 'goal', title: 'Goal met', detail: 'Hit your monthly goal', icon: 'trophy', tone: 'good' });
  }

  if (tradingDays >= 10) {
    const green = days.filter((d) => d.pnl > 0).length;
    const ratio = green / tradingDays;
    if (ratio >= 0.6) {
      out.push({ id: 'consistent', title: 'Consistent', detail: `${Math.round(ratio * 100)}% green days`, icon: 'trending', tone: 'good' });
    }
  }

  return out;
}
