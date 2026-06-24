import type { DailyPnl } from '../types';

export interface HeatCell {
  /** ISO date for this cell, or null for padding cells before/after the year. */
  date: string | null;
  /** Net P&L for the day (0 when no trades or padding). */
  pnl: number;
  /** True when the day had trades. */
  traded: boolean;
}

export interface YearHeatmap {
  year: number;
  /** 53 columns (weeks) × 7 rows (Mon..Sun), column-major. */
  weeks: HeatCell[][];
  /** Largest absolute daily P&L in the year (for color scaling). */
  maxAbs: number;
  totalPnl: number;
  greenDays: number;
  redDays: number;
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Build a GitHub-style contribution grid of daily P&L for a calendar year.
 * Columns are ISO weeks (Monday-first); each column has 7 day cells. Days
 * outside the year are padded with null. Pure and deterministic.
 */
export function buildYearHeatmap(dailyMap: Map<string, DailyPnl>, year: number): YearHeatmap {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  // Back up to the Monday on/before Jan 1.
  const startDow = (start.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  const cursor = new Date(start);
  cursor.setUTCDate(cursor.getUTCDate() - startDow);

  const weeks: HeatCell[][] = [];
  let maxAbs = 0, totalPnl = 0, greenDays = 0, redDays = 0;

  while (cursor <= end || (cursor.getUTCDay() + 6) % 7 !== 0) {
    const col: HeatCell[] = [];
    for (let r = 0; r < 7; r++) {
      const y = cursor.getUTCFullYear();
      const inYear = y === year;
      if (inYear) {
        const key = iso(y, cursor.getUTCMonth(), cursor.getUTCDate());
        const day = dailyMap.get(key);
        const pnl = day ? day.pnl : 0;
        if (day) {
          maxAbs = Math.max(maxAbs, Math.abs(pnl));
          totalPnl += pnl;
          if (pnl > 0) greenDays++;
          else if (pnl < 0) redDays++;
        }
        col.push({ date: key, pnl, traded: !!day });
      } else {
        col.push({ date: null, pnl: 0, traded: false });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(col);
    if (weeks.length > 54) break; // safety
  }

  return { year, weeks, maxAbs, totalPnl, greenDays, redDays };
}
