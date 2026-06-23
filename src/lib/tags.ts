import type { TradeRecord } from '../types';

export interface MistakeTag {
  key: string;
  label: string;
  /** Lower-cased keywords (English) and raw substrings (Chinese) to match. */
  keywords: string[];
}

/**
 * Behavioral mistake tags, auto-detected from a trade's free text
 * (Reason&Emotion + Note + Setup). Bilingual (English / 中文) because the
 * journal notes are often Chinese.
 */
export const MISTAKE_TAGS: MistakeTag[] = [
  { key: 'fomo', label: 'FOMO', keywords: ['fomo', '手痒', '怕错过', '忍不住', '冲动', '追高'] },
  { key: 'revenge', label: 'Revenge', keywords: ['revenge', '报复', '扳回', '回本', '赌气'] },
  { key: 'chase', label: 'Chased', keywords: ['chase', 'chased', 'chasing', '追单', '追涨', '追空', '追进'] },
  { key: 'oversize', label: 'Oversize', keywords: ['oversize', 'oversized', 'too big', 'size up', 'sized up', '重仓', '仓位过大', '加重仓'] },
  { key: 'nostop', label: 'No stop', keywords: ['no stop', 'without a stop', 'no-stop', '没止损', '无止损', '没设止损', '没有止损'] },
  { key: 'movedstop', label: 'Moved stop', keywords: ['moved stop', 'moved my stop', 'widened stop', '移止损', '挪止损', '放宽止损'] },
  { key: 'earlyexit', label: 'Early exit', keywords: ['early exit', 'exited early', 'cut early', 'sold too early', 'paper hands', '出早', '过早', '提前止盈', '拿不住', '卖飞'] },
  { key: 'lateentry', label: 'Late entry', keywords: ['late entry', 'entered late', 'too late', '进晚', '入场晚', '晚了'] },
  { key: 'overtrade', label: 'Overtrade', keywords: ['overtrade', 'overtrading', 'overtraded', 'too many trades', '过度交易', '频繁', '交易太多', '手多'] },
  { key: 'hesitation', label: 'Hesitation', keywords: ['hesitat', 'froze', '犹豫', '迟疑', '没敢'] },
  { key: 'noplan', label: 'No plan', keywords: ['no plan', 'off plan', 'unplanned', 'impulse', '没计划', '计划外', '非计划', '随意', '乱做'] },
  { key: 'counter', label: 'Counter-trend', keywords: ['counter-trend', 'countertrend', 'against the trend', 'fought the trend', '逆势', '反趋势', '赌反转'] },
  { key: 'gamble', label: 'Gambling', keywords: ['gamble', 'gambling', 'yolo', '赌', '梭哈'] },
];

function tradeText(t: TradeRecord): string {
  return `${t.reasonEmotion} ${t.note} ${t.setup}`.toLowerCase();
}

/** Mistake tag keys detected on a single trade. */
export function detectTags(t: TradeRecord): string[] {
  const text = tradeText(t);
  if (!text.trim()) return [];
  const out: string[] = [];
  for (const tag of MISTAKE_TAGS) {
    if (tag.keywords.some((k) => text.includes(k))) out.push(tag.key);
  }
  return out;
}

export interface TagEdge {
  key: string;
  label: string;
  count: number;
  pnl: number;
  wins: number;
  winRate: number;
}

/** Aggregate P&L / win-rate per mistake tag across all trades. */
export function tagEdge(trades: TradeRecord[]): TagEdge[] {
  const byKey = new Map<string, TagEdge>();
  for (const tag of MISTAKE_TAGS) {
    byKey.set(tag.key, { key: tag.key, label: tag.label, count: 0, pnl: 0, wins: 0, winRate: 0 });
  }
  for (const t of trades) {
    for (const key of detectTags(t)) {
      const e = byKey.get(key);
      if (!e) continue;
      e.count += 1;
      e.pnl += t.profitLoss;
      if (t.profitLoss > 0) e.wins += 1;
    }
  }
  return [...byKey.values()]
    .filter((e) => e.count > 0)
    .map((e) => ({ ...e, winRate: e.count ? e.wins / e.count : 0 }))
    .sort((a, b) => a.pnl - b.pnl); // biggest leak first
}

/** How many trades carry at least one mistake tag. */
export function taggedTradeCount(trades: TradeRecord[]): number {
  return trades.reduce((n, t) => (detectTags(t).length > 0 ? n + 1 : n), 0);
}
