import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Target, Printer, CheckCircle2, Circle, Flame } from 'lucide-react';
import type { TradeRecord } from '../types';
import {
  computeSummary, groupByDay, edgeByField, hourEdgeBySymbol, formatMoneySigned,
} from '../lib/metrics';
import { tagEdge } from '../lib/tags';
import { emotionEdge } from '../lib/emotions';
import { useUserTags } from '../lib/useUserTags';
import { avgDiscipline } from '../lib/discipline';
import { evaluateRules, loadRules } from '../lib/rules';
import { groupByWeek, groupByMonth, weekLabel, monthLabel } from '../lib/review';
import { findLeaks } from '../lib/leaks';
import { isReviewed, setReviewed, reviewStreak, REVIEW_LOG_EVENT } from '../lib/reviewLog';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';

export default function WeeklyReview({ trades }: { trades: TradeRecord[] }) {
  useLang();
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const weeks = useMemo(() => (period === 'week' ? groupByWeek(trades) : groupByMonth(trades)), [trades, period]);
  const labelOf = period === 'week' ? weekLabel : monthLabel;
  const userTags = useUserTags();
  const [idx, setIdx] = useState(0);
  const [, bumpLog] = useState(0);

  useEffect(() => {
    const refresh = () => bumpLog((n) => n + 1);
    window.addEventListener(REVIEW_LOG_EVENT, refresh);
    return () => window.removeEventListener(REVIEW_LOG_EVENT, refresh);
  }, []);

  if (weeks.length === 0) {
    return <div className="review"><div className="review-empty">No trades to review yet.</div></div>;
  }

  const clamped = Math.min(idx, weeks.length - 1);
  const week = weeks[clamped];
  const wt = week.trades;
  const streak = reviewStreak(weeks.map((w) => w.key));
  const reviewed = isReviewed(week.key);

  const s = computeSummary(wt);
  const days = [...groupByDay(wt).values()];
  const disc = avgDiscipline(days);
  const mistakes = tagEdge(wt, userTags);
  const emotions = emotionEdge(wt, userTags);
  const setups = edgeByField(wt, (t) => t.setup).filter((x) => x.key !== '(未填写)').sort((a, b) => a.pnl - b.pnl);
  const hours = hourEdgeBySymbol(wt, 'All').slice().sort((a, b) => a.pnl - b.pnl);
  const rules = evaluateRules(wt, loadRules()).filter((r) => r.count > 0).sort((a, b) => a.impact - b.impact);

  const worstMistake = mistakes[0] && mistakes[0].pnl < 0 ? mistakes[0] : null;
  const bestEmotion = emotions.length ? emotions[emotions.length - 1] : null;
  const worstSetup = setups[0] && setups[0].pnl < 0 ? setups[0] : null;
  const worstHour = hours[0] && hours[0].pnl < 0 ? hours[0] : null;
  const worstRule = rules[0] && rules[0].impact < 0 ? rules[0] : null;

  // Pick the single biggest leak for the "change one thing" recommendation.
  const candidates: { text: string; impact: number }[] = [];
  if (worstMistake) candidates.push({ text: `cut "${worstMistake.label}" trades — they cost ${formatMoneySigned(worstMistake.pnl)} this week`, impact: worstMistake.pnl });
  if (worstSetup) candidates.push({ text: `avoid the "${worstSetup.key}" setup — ${formatMoneySigned(worstSetup.pnl)} this week`, impact: worstSetup.pnl });
  if (worstHour) candidates.push({ text: `skip the ${worstHour.key} hour — ${formatMoneySigned(worstHour.pnl)} this week`, impact: worstHour.pnl });
  if (worstRule) candidates.push({ text: `respect your rule: ${worstRule.label.toLowerCase()} (${formatMoneySigned(worstRule.impact)})`, impact: worstRule.impact });
  candidates.sort((a, b) => a.impact - b.impact);
  const recommendation = candidates[0]?.text;

  const winners = setups.slice().reverse().filter((x) => x.pnl > 0).slice(0, 3);
  const weekLeaks = findLeaks(wt, userTags, { minCount: 2, limit: 3 });

  function exportPdf() {
    document.body.classList.add('printing-review');
    const cleanup = () => {
      document.body.classList.remove('printing-review');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    // Fallback in case afterprint doesn't fire.
    setTimeout(cleanup, 1000);
  }

  return (
    <div className="review-layout">
      <aside className="review-rail">
        <div className="review-rail-head">
          <span>History</span>
          {streak > 0 && <span className="review-streak" title="Consecutive reviewed periods"><Flame size={12} /> {streak}</span>}
        </div>
        <div className="review-period-toggle">
          <button className={period === 'week' ? 'on' : ''} onClick={() => { setPeriod('week'); setIdx(0); }}>{t('review.week')}</button>
          <button className={period === 'month' ? 'on' : ''} onClick={() => { setPeriod('month'); setIdx(0); }}>{t('review.month')}</button>
        </div>
        <div className="review-rail-list">
          {weeks.map((w, i) => {
            const net = w.trades.reduce((sum, t) => sum + t.profitLoss, 0);
            return (
              <button
                key={w.key}
                className={`review-rail-item ${i === clamped ? 'active' : ''}`}
                onClick={() => setIdx(i)}
              >
                <span className="rri-check">{isReviewed(w.key) ? <CheckCircle2 size={13} /> : <Circle size={13} />}</span>
                <span className="rri-label">{period === 'week' ? labelOf(w.key).replace(/, \d{4}$/, '') : labelOf(w.key)}</span>
                <span className={`rri-net ${net >= 0 ? 'pos' : 'neg'}`}>{formatMoneySigned(net)}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="review">
        <div className="review-print-header">
          <span className="rph-brand">PnL Calendar — {period === 'week' ? t('review.reportTitle') : t('review.reportTitleM')}</span>
          <span className="rph-meta">{labelOf(week.key)} · {t('review.generated')} {new Date().toLocaleDateString()}</span>
        </div>
        <div className="review-nav">
          <button className="edge-nav sm" onClick={() => setIdx(Math.min(weeks.length - 1, clamped + 1))} disabled={clamped >= weeks.length - 1} aria-label="Older period"><ChevronLeft size={16} /></button>
          <div className="review-week">
            <span className="review-eyebrow">{period === 'week' ? t('review.eyebrow') : t('review.eyebrowM')}</span>
            <h2>{labelOf(week.key)}</h2>
          </div>
          <button className="edge-nav sm" onClick={() => setIdx(Math.max(0, clamped - 1))} disabled={clamped <= 0} aria-label="Newer period"><ChevronRight size={16} /></button>
          <button className={`review-reviewed ${reviewed ? 'on' : ''}`} onClick={() => setReviewed(week.key, !reviewed)} title="Mark this period reviewed">
            {reviewed ? <CheckCircle2 size={14} /> : <Circle size={14} />} {reviewed ? 'Reviewed' : 'Mark reviewed'}
          </button>
          <button className="review-export" onClick={exportPdf} title="Export this week as PDF"><Printer size={14} /> Export PDF</button>
        </div>

        <div className="review-kpis">
          <Kpi label="Net P&L" value={formatMoneySigned(s.totalPnl)} cls={s.totalPnl >= 0 ? 'pos' : 'neg'} />
          <Kpi label="Trades" value={String(s.tradeCount)} />
          <Kpi label="Win rate" value={`${(s.winRateTrades * 100).toFixed(0)}%`} />
          <Kpi label="Discipline" value={`${disc}/100`} cls={disc >= 80 ? 'pos' : disc < 60 ? 'neg' : ''} />
        </div>

        <div className="review-cols">
          <div className="review-card good">
            <h3>What worked</h3>
            <ul>
              {s.bestDay && <li><b className="pos">{formatMoneySigned(s.bestDay.pnl)}</b> best day</li>}
              {winners.length > 0
                ? winners.map((w) => <li key={w.key}><b className="pos">{formatMoneySigned(w.pnl)}</b> from {w.key}</li>)
                : <li className="muted">No standout winning setups.</li>}
              {bestEmotion && bestEmotion.pnl > 0 && <li>Best while <b>{bestEmotion.label.toLowerCase()}</b> ({formatMoneySigned(bestEmotion.pnl)})</li>}
            </ul>
          </div>
          <div className="review-card bad">
            <h3>What hurt</h3>
            <ul>
              {s.worstDay && <li><b className="neg">{formatMoneySigned(s.worstDay.pnl)}</b> worst day</li>}
              {worstMistake && <li><b className="neg">{formatMoneySigned(worstMistake.pnl)}</b> from {worstMistake.label}</li>}
              {worstSetup && <li><b className="neg">{formatMoneySigned(worstSetup.pnl)}</b> from {worstSetup.key}</li>}
              {worstHour && <li><b className="neg">{formatMoneySigned(worstHour.pnl)}</b> at {worstHour.key}</li>}
              {worstRule && <li>{worstRule.count}× {worstRule.label.toLowerCase()} ({formatMoneySigned(worstRule.impact)})</li>}
              {!worstMistake && !worstSetup && !worstHour && !worstRule && !s.worstDay && <li className="muted">Clean week — nothing flagged.</li>}
            </ul>
          </div>
        </div>

        {recommendation && (
          <div className="review-action">
            <span className="ra-icon"><Target size={18} /></span>
            <div>
              <span className="ra-label">Change one thing next week</span>
              <span className="ra-text">{recommendation.charAt(0).toUpperCase() + recommendation.slice(1)}.</span>
            </div>
          </div>
        )}
        {weekLeaks.length > 0 && (
          <div className="review-leaks">
            <h3>{period === 'week' ? t('review.topLeaks') : t('review.topLeaksM')}</h3>
            <ul>
              {weekLeaks.map((l) => (
                <li key={`${l.dimension}-${l.value}`}>
                  <span className="rl-dim">{l.dimensionLabel}</span>
                  <span className="rl-val">{l.value}</span>
                  <span className="rl-meta">{l.count}× · {Math.round(l.winRate * 100)}%</span>
                  <span className="rl-net neg">{formatMoneySigned(l.net)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="review-disclaimer">{t('review.disclaimer')}</div>
      </div>
    </div>
  );
}

function Kpi({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="review-kpi">
      <span className="review-kpi-label">{label}</span>
      <span className={`review-kpi-value ${cls ?? ''}`}>{value}</span>
    </div>
  );
}
