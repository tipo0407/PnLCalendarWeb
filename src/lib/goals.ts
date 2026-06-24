import type { DailyPnl } from '../types';
import { dayDiscipline } from './discipline';

export interface Streaks {
  current: number;
  currentType: 'win' | 'loss' | 'none';
  bestWin: number;
  bestLoss: number;
}

function sortAsc(days: DailyPnl[]): DailyPnl[] {
  return [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Win/loss day streaks: best historical and the current trailing run. */
export function dayStreaks(days: DailyPnl[]): Streaks {
  const sorted = sortAsc(days);
  let bestWin = 0, bestLoss = 0, runWin = 0, runLoss = 0;
  for (const d of sorted) {
    if (d.pnl > 0) { runWin++; runLoss = 0; if (runWin > bestWin) bestWin = runWin; }
    else if (d.pnl < 0) { runLoss++; runWin = 0; if (runLoss > bestLoss) bestLoss = runLoss; }
    else { runWin = 0; runLoss = 0; }
  }
  let current = 0;
  let currentType: Streaks['currentType'] = 'none';
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i].pnl;
    if (current === 0) {
      if (p > 0) { currentType = 'win'; current = 1; }
      else if (p < 0) { currentType = 'loss'; current = 1; }
      else break;
    } else if ((currentType === 'win' && p > 0) || (currentType === 'loss' && p < 0)) {
      current++;
    } else break;
  }
  return { current, currentType, bestWin, bestLoss };
}

/** Trailing run of days meeting the discipline threshold. */
export function disciplineStreak(days: DailyPnl[], threshold = 80): number {
  const sorted = sortAsc(days);
  let run = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (dayDiscipline(sorted[i]) >= threshold) run++;
    else break;
  }
  return run;
}

export interface MonthProgress {
  pnl: number;
  goal: number;
  pct: number;       // 0..(>100), 0 if no goal
  greenDays: number;
  redDays: number;
  tradeDays: number;
}

/** Net P&L and goal progress for a given calendar month. */
export function monthProgress(days: DailyPnl[], year: number, month: number, goal: number): MonthProgress {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  let pnl = 0, greenDays = 0, redDays = 0, tradeDays = 0;
  for (const d of days) {
    if (!d.date.startsWith(prefix)) continue;
    tradeDays++;
    pnl += d.pnl;
    if (d.pnl > 0) greenDays++;
    else if (d.pnl < 0) redDays++;
  }
  return {
    pnl,
    goal,
    pct: goal > 0 ? (pnl / goal) * 100 : 0,
    greenDays,
    redDays,
    tradeDays,
  };
}

/** Net P&L and goal progress for a given calendar year. */
export function yearProgress(days: DailyPnl[], year: number, goal: number): MonthProgress {
  const prefix = `${year}-`;
  let pnl = 0, greenDays = 0, redDays = 0, tradeDays = 0;
  for (const d of days) {
    if (!d.date.startsWith(prefix)) continue;
    tradeDays++;
    pnl += d.pnl;
    if (d.pnl > 0) greenDays++;
    else if (d.pnl < 0) redDays++;
  }
  return {
    pnl,
    goal,
    pct: goal > 0 ? (pnl / goal) * 100 : 0,
    greenDays,
    redDays,
    tradeDays,
  };
}

export interface MonthBenchmark {
  /** Pace projection: avg day P&L × business days in the month. */
  projected: number;
  /** 0–100: how evenly profit is spread (100 = not reliant on the best day). */
  consistency: number;
  /** Share of green-day profit that comes from the single best day. */
  topDayShare: number;
}

/** Pace projection and consistency score for a month's day records. */
export function monthBenchmark(days: DailyPnl[], businessDays: number): MonthBenchmark {
  const active = days.length;
  const total = days.reduce((s, d) => s + d.pnl, 0);
  const avgDay = active ? total / active : 0;
  const greens = days.filter((d) => d.pnl > 0);
  const sumGreen = greens.reduce((s, d) => s + d.pnl, 0);
  const best = greens.reduce((m, d) => Math.max(m, d.pnl), 0);
  const topDayShare = sumGreen > 0 ? best / sumGreen : 0;
  let consistency = 0;
  if (greens.length >= 2) consistency = Math.round((1 - topDayShare) * 100);
  else if (greens.length === 1) consistency = 50;
  return { projected: avgDay * businessDays, consistency, topDayShare };
}
