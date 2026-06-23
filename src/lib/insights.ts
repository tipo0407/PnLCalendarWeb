import type { TradeRecord } from '../types';
import type { TradeTags } from './userTags';
import { formatMoneySigned, dayOfWeekEdge, hourEdgeBySymbol } from './metrics';
import { setupStats } from './playbook';
import { tagEdge } from './tags';
import { emotionEdge } from './emotions';

export interface Insight {
  tone: 'good' | 'bad' | 'neutral';
  text: string;
  impact: number; // absolute P&L magnitude, for ranking
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Derive a ranked list of plain-language findings from the trades. Each finding
 * needs a minimum sample so single outliers don't dominate.
 */
export function generateInsights(trades: TradeRecord[], userTags?: Record<string, TradeTags>): Insight[] {
  const out: Insight[] = [];
  if (trades.length < 5) return out;

  // Setups (by expectancy / net).
  const setups = setupStats(trades).filter((s) => s.count >= 3 && s.setup !== '(no setup)');
  if (setups.length) {
    const best = setups[0];
    if (best.net > 0) {
      out.push({ tone: 'good', text: `“${best.setup}” is your edge — ${formatMoneySigned(best.net)} over ${best.count} trades (${pct(best.winRate)} win).`, impact: Math.abs(best.net) });
    }
    const worst = setups[setups.length - 1];
    if (worst.net < 0 && worst.setup !== best.setup) {
      out.push({ tone: 'bad', text: `“${worst.setup}” is costing you ${formatMoneySigned(worst.net)} over ${worst.count} trades — tighten or cut it.`, impact: Math.abs(worst.net) });
    }
  }

  // Day of week.
  const dow = dayOfWeekEdge(trades).filter((d) => d.count >= 3);
  if (dow.length) {
    const worstDow = [...dow].sort((a, b) => a.pnl - b.pnl)[0];
    if (worstDow.pnl < 0) out.push({ tone: 'bad', text: `${worstDow.key} is your weakest day: ${formatMoneySigned(worstDow.pnl)} across ${worstDow.count} trades.`, impact: Math.abs(worstDow.pnl) });
    const bestDow = [...dow].sort((a, b) => b.pnl - a.pnl)[0];
    if (bestDow.pnl > 0 && bestDow.key !== worstDow.key) out.push({ tone: 'good', text: `${bestDow.key} is your strongest day: ${formatMoneySigned(bestDow.pnl)}.`, impact: Math.abs(bestDow.pnl) });
  }

  // Hour of day.
  const hours = hourEdgeBySymbol(trades, 'All').filter((h) => h.count >= 3);
  if (hours.length) {
    const worstHour = [...hours].sort((a, b) => a.pnl - b.pnl)[0];
    if (worstHour.pnl < 0) out.push({ tone: 'bad', text: `The ${worstHour.key} hour drags you down: ${formatMoneySigned(worstHour.pnl)} over ${worstHour.count} trades.`, impact: Math.abs(worstHour.pnl) });
  }

  // Mistakes (auto + manual).
  const mistakes = tagEdge(trades, userTags).filter((m) => m.count >= 2);
  if (mistakes.length && mistakes[0].pnl < 0) {
    const m = mistakes[0];
    out.push({ tone: 'bad', text: `“${m.label}” trades cost ${formatMoneySigned(m.pnl)} (${m.count}× , ${pct(m.winRate)} win) — your biggest behavioral leak.`, impact: Math.abs(m.pnl) });
  }

  // Emotions.
  const emotions = emotionEdge(trades, userTags).filter((e) => e.count >= 2);
  if (emotions.length) {
    const bestEmo = emotions[emotions.length - 1];
    if (bestEmo.pnl > 0) out.push({ tone: 'good', text: `You trade best while ${bestEmo.label.toLowerCase()} (${formatMoneySigned(bestEmo.pnl)}).`, impact: Math.abs(bestEmo.pnl) });
  }

  return out.sort((a, b) => b.impact - a.impact).slice(0, 6);
}
