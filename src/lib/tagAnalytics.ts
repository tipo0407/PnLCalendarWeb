import type { TradeRecord } from '../types';
import type { TradeTags } from './userTags';
import { detectTags, allMistakeTags } from './tags';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function labelMap(): Map<string, string> {
  return new Map(allMistakeTags().map((m) => [m.key, m.label]));
}

export interface TagTrend {
  months: string[]; // e.g. "Mar '25"
  series: { key: string; label: string; counts: number[] }[];
}

/** Monthly occurrence counts for the most-frequent mistake tags (top `topN`). */
export function tagTrend(trades: TradeRecord[], userTags?: Record<string, TradeTags>, topN = 4): TagTrend {
  const labels = labelMap();
  const monthSet = new Set<string>();
  const totals = new Map<string, number>();
  const perMonth = new Map<string, Map<string, number>>(); // monthKey -> tag -> count

  for (const t of trades) {
    const tags = detectTags(t, userTags);
    if (tags.length === 0) continue;
    const monthKey = t.date.slice(0, 7); // YYYY-MM
    monthSet.add(monthKey);
    let m = perMonth.get(monthKey);
    if (!m) { m = new Map(); perMonth.set(monthKey, m); }
    for (const tag of tags) {
      totals.set(tag, (totals.get(tag) ?? 0) + 1);
      m.set(tag, (m.get(tag) ?? 0) + 1);
    }
  }

  const months = [...monthSet].sort();
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([k]) => k);

  return {
    months: months.map((mk) => {
      const [y, mm] = mk.split('-').map(Number);
      return `${MONTH_ABBR[mm - 1]} '${String(y).slice(2)}`;
    }),
    series: top.map((key) => ({
      key,
      label: labels.get(key) ?? key,
      counts: months.map((mk) => perMonth.get(mk)?.get(key) ?? 0),
    })),
  };
}

export interface TagPair {
  a: string; b: string; labelA: string; labelB: string; count: number; pnl: number;
}

/** Mistake-tag pairs that co-occur on the same trade, most frequent first. */
export function tagCooccurrence(trades: TradeRecord[], userTags?: Record<string, TradeTags>, limit = 8): TagPair[] {
  const labels = labelMap();
  const pairs = new Map<string, TagPair>();
  for (const t of trades) {
    const tags = detectTags(t, userTags);
    if (tags.length < 2) continue;
    const sorted = [...new Set(tags)].sort();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]; const b = sorted[j];
        const key = `${a}|${b}`;
        let p = pairs.get(key);
        if (!p) { p = { a, b, labelA: labels.get(a) ?? a, labelB: labels.get(b) ?? b, count: 0, pnl: 0 }; pairs.set(key, p); }
        p.count += 1;
        p.pnl += t.profitLoss;
      }
    }
  }
  return [...pairs.values()].sort((x, y) => y.count - x.count).slice(0, limit);
}
