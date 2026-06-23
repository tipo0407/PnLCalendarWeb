import type { TradeRecord } from '../types';
import { tradeTagKey, type TradeTags } from './userTags';

export interface EmotionDef {
  key: string;
  label: string;
  keywords: string[];
}

/** Emotional states detected from journal text (bilingual EN / 中文). */
export const EMOTIONS: EmotionDef[] = [
  { key: 'confident', label: 'Confident', keywords: ['confident', 'conviction', '信心', '有把握', '笃定'] },
  { key: 'calm', label: 'Calm / disciplined', keywords: ['calm', 'disciplined', 'patient', 'by the plan', '冷静', '耐心', '纪律', '按计划'] },
  { key: 'fear', label: 'Fearful', keywords: ['fear', 'afraid', 'scared', 'nervous', 'anxious', '怕', '害怕', '担心', '紧张'] },
  { key: 'greed', label: 'Greedy', keywords: ['greed', 'greedy', '贪', '贪婪', '不舍得'] },
  { key: 'impatient', label: 'Impatient', keywords: ['impatient', 'itch', 'itchy', '手痒', '着急', '按捺不住'] },
  { key: 'frustrated', label: 'Frustrated / tilt', keywords: ['frustrat', 'tilt', 'angry', 'annoyed', '烦', '生气', '上头', '焦躁'] },
  { key: 'hope', label: 'Hoping', keywords: ['hope', 'hoping', '期待', '希望', '盼', '赌'] },
  { key: 'bored', label: 'Bored', keywords: ['bored', 'boring', '无聊'] },
  { key: 'hesitant', label: 'Hesitant', keywords: ['hesitat', 'doubt', 'unsure', '犹豫', '迟疑', '纠结', '没敢'] },
  { key: 'regret', label: 'Regret', keywords: ['regret', 'should have', '后悔', '应该'] },
];

function tradeText(t: TradeRecord): string {
  return `${t.reasonEmotion} ${t.note}`.toLowerCase();
}

export function detectEmotions(t: TradeRecord, userTags?: Record<string, TradeTags>): string[] {
  const text = tradeText(t);
  const out: string[] = [];
  if (text.trim()) {
    for (const e of EMOTIONS) {
      if (e.keywords.some((k) => text.includes(k))) out.push(e.key);
    }
  }
  if (userTags) {
    const manual = userTags[tradeTagKey(t.date, t.tradeNumber, t.rowNumber)]?.emotions;
    if (manual) for (const k of manual) if (!out.includes(k)) out.push(k);
  }
  return out;
}

export interface EmotionEdge {
  key: string;
  label: string;
  count: number;
  pnl: number;
  wins: number;
  winRate: number;
}

export function emotionEdge(trades: TradeRecord[], userTags?: Record<string, TradeTags>): EmotionEdge[] {
  const byKey = new Map<string, EmotionEdge>();
  for (const e of EMOTIONS) {
    byKey.set(e.key, { key: e.key, label: e.label, count: 0, pnl: 0, wins: 0, winRate: 0 });
  }
  for (const t of trades) {
    for (const key of detectEmotions(t, userTags)) {
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
    .sort((a, b) => a.pnl - b.pnl);
}
