import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import type { TradeRecord } from '../types';
import type { Summary } from '../lib/metrics';
import {
  monthlyBreakdown,
  groupByDay,
  formatMoney,
  formatMoneySigned,
  shortDate,
} from '../lib/metrics';
import { dayStreaks } from '../lib/goals';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';
import MoneyCountUp from './CountUp';

interface Props {
  trades: TradeRecord[];
  summary: Summary;
  viewMonth: { year: number; month: number };
  onJumpMonth: (year: number, month: number) => void;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function isoWeekLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((dt.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
    );
  return `${t('common.week')} ${week} · ${dt.getUTCFullYear()}`;
}

function weekKey(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return iso(dt);
}
function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export default function Sidebar({ trades, summary, viewMonth, onJumpMonth }: Props) {
  useLang(); // re-render on language change
  const months = useMemo(() => monthlyBreakdown(trades), [trades]);
  const days = useMemo(() => [...groupByDay(trades).values()], [trades]);
  const streaks = useMemo(() => dayStreaks(days), [days]);

  const bestWeek = useMemo(() => {
    const map = new Map<string, { sample: string; pnl: number }>();
    for (const d of groupByDay(trades).values()) {
      const k = weekKey(d.date);
      const cur = map.get(k) ?? { sample: d.date, pnl: 0 };
      cur.pnl += d.pnl;
      map.set(k, cur);
    }
    let best: { sample: string; pnl: number } | null = null;
    for (const v of map.values()) if (!best || v.pnl > best.pnl) best = v;
    return best;
  }, [trades]);

  const maxMonthAbs = Math.max(1, ...months.map((m) => Math.abs(m.pnl)));
  const winRate = summary.winRateDays;
  const positive = summary.totalPnl >= 0;

  return (
    <aside className="sidebar">
      <div className="lens-head">
        <span className="lens-title">{t('side.portfolioSummary')}</span>
        <div className="lens-year-nav">
          <button
            className="edge-nav sm"
            onClick={() => onJumpMonth(viewMonth.year - 1, viewMonth.month)}
            title={t('side.prevYear')}
            aria-label={t('side.prevYear')}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="lens-year">{viewMonth.year}</span>
          <button
            className="edge-nav sm"
            onClick={() => onJumpMonth(viewMonth.year + 1, viewMonth.month)}
            title={t('side.nextYear')}
            aria-label={t('side.nextYear')}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className={`total-card ${positive ? 'pos' : 'neg'}`}>
        <span className="tc-label">{t('side.totalPnl')}</span>
        <span className="tc-value"><MoneyCountUp value={summary.totalPnl} /></span>
        <div className="tc-meta">
          <span>{t('side.tradedDays', { n: summary.tradingDays })}</span>
          <span>{t('side.tradesTotal', { n: summary.tradeCount })}</span>
        </div>
        <span className="tc-since">{t('side.daysSinceFirst', { n: summary.daysSinceFirst })}</span>
      </div>

      <div className="lens-block">
        <div className="goals-card">
          <div className="streak-row">
            <div className="streak-chip">
              <Flame size={13} className={streaks.currentType === 'win' ? 'pos' : streaks.currentType === 'loss' ? 'neg' : ''} />
              <span className="streak-val">
                {streaks.current > 0
                  ? t(streaks.currentType === 'win' ? 'side.winStreakN' : 'side.lossStreakN', { n: streaks.current })
                  : t('side.noStreak')}
              </span>
            </div>
            <div className="streak-meta">
              <span title={t('side.bestWinningStreak')}><b className="pos">{streaks.bestWin}</b> {t('side.best')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="lens-block">
        <div className="month-bars">
          {months.map((m) => {
            const ratio = Math.abs(m.pnl) / maxMonthAbs;
            const pos = m.pnl >= 0;
            return (
              <button
                key={`${m.year}-${m.month}`}
                className="month-row"
                onClick={() => onJumpMonth(m.year, m.month)}
                title={`${t(`month.short.${m.month}`)} ${m.year} · ${t('cal.tradesCount', { n: m.tradeCount })}`}
              >
                <span className="month-name">{t(`month.short.${m.month}`)}</span>
                <span className="month-track">
                  <span className="month-center" />
                  <span
                    className={`month-fill ${pos ? 'pos' : 'neg'}`}
                    style={pos ? { left: '50%', width: `${ratio * 50}%` } : { right: '50%', width: `${ratio * 50}%` }}
                  />
                </span>
                <span className={`month-val ${pos ? 'pos' : 'neg'}`}>{formatMoneySigned(m.pnl)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="lens-block">
        <div className="stat-pair">
          <div className="stat-card win">
            <span className="sc-label">{t('side.winDays')}</span>
            <span className="sc-value">{summary.winDays}</span>
          </div>
          <div className="stat-card loss">
            <span className="sc-label">{t('side.lossDays')}</span>
            <span className="sc-value">{summary.lossDays}</span>
          </div>
        </div>
        <div className="winrate">
          <div className="winrate-top">
            <span>{t('side.winRate')}</span>
            <span className="winrate-pct">{pct(winRate)}</span>
          </div>
          <div className="winrate-bar">
            <div className="winrate-fill" style={{ width: pct(winRate) }} />
          </div>
        </div>
        <div className="stat-pair">
          <div className="bw-card win">
            <span className="sc-label">{t('side.bestDay')}</span>
            <span className="sc-value pos">{summary.bestDay ? formatMoneySigned(summary.bestDay.pnl) : '—'}</span>
            <span className="sc-sub">{summary.bestDay ? shortDate(summary.bestDay.date) : ''}</span>
          </div>
          <div className="bw-card loss">
            <span className="sc-label">{t('side.worstDay')}</span>
            <span className="sc-value neg">{summary.worstDay ? formatMoneySigned(summary.worstDay.pnl) : '—'}</span>
            <span className="sc-sub">{summary.worstDay ? shortDate(summary.worstDay.date) : ''}</span>
          </div>
        </div>
      </div>

      <div className="lens-block">
        <div className="insight-grid">
          <Insight label={t('side.avgWin')} value={formatMoneySigned(summary.avgWin)} cls="pos" />
          <Insight label={t('side.avgLoss')} value={formatMoneySigned(-summary.avgLoss)} cls="neg" />
          <Insight
            label={t('side.bestWeek')}
            value={bestWeek ? formatMoneySigned(bestWeek.pnl) : '—'}
            sub={bestWeek ? isoWeekLabel(bestWeek.sample) : ''}
            cls="pos"
          />
          <Insight
            label={t('atlas.profitFactor')}
            value={summary.profitFactor === Infinity ? '∞' : summary.profitFactor.toFixed(2)}
            cls={summary.profitFactor >= 1 ? 'pos' : 'neg'}
          />
          <Insight label={t('side.expectancy')} value={formatMoneySigned(summary.expectancy)} cls={summary.expectancy >= 0 ? 'pos' : 'neg'} />
          <Insight label={t('atlas.maxDD')} value={formatMoney(summary.maxDrawdown)} cls="neg" />
        </div>
      </div>
    </aside>
  );
}

function Insight({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="insight">
      <span className="insight-label">{label}</span>
      <span className={`insight-value ${cls ?? ''}`}>{value}</span>
      {sub && <span className="insight-sub">{sub}</span>}
    </div>
  );
}
