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
