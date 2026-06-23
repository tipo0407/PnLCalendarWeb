import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Flame, Target } from 'lucide-react';
import type { TradeRecord } from '../types';
import type { Summary } from '../lib/metrics';
import {
  monthlyBreakdown,
  groupByDay,
  formatMoney,
  formatMoneySigned,
  shortDate,
} from '../lib/metrics';
import { avgDiscipline } from '../lib/discipline';
import { dayStreaks, disciplineStreak, monthProgress } from '../lib/goals';
import { getSettings } from '../lib/settings';
import MoneyCountUp from './CountUp';

interface Props {
  trades: TradeRecord[];
  summary: Summary;
  viewMonth: { year: number; month: number };
  onJumpMonth: (year: number, month: number) => void;
  onOpenSettings?: () => void;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
  return `W${week} · ${dt.getUTCFullYear()}`;
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

export default function Sidebar({ trades, summary, viewMonth, onJumpMonth, onOpenSettings }: Props) {
  const months = useMemo(() => monthlyBreakdown(trades), [trades]);
  const days = useMemo(() => [...groupByDay(trades).values()], [trades]);
  const streaks = useMemo(() => dayStreaks(days), [days]);
  const discStreak = useMemo(() => disciplineStreak(days), [days]);
  const { monthlyGoal } = getSettings();
  const progress = useMemo(
    () => monthProgress(days, viewMonth.year, viewMonth.month, monthlyGoal),
    [days, viewMonth.year, viewMonth.month, monthlyGoal],
  );

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
  const disc = useMemo(() => avgDiscipline([...groupByDay(trades).values()]), [trades]);

  return (
    <aside className="sidebar">
      <div className="lens-head">
        <span className="lens-title">PORTFOLIO SUMMARY</span>
        <div className="lens-year-nav">
          <button
            className="edge-nav sm"
            onClick={() => onJumpMonth(viewMonth.year - 1, viewMonth.month)}
            title="Previous year"
            aria-label="Previous year"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="lens-year">{viewMonth.year}</span>
          <button
            className="edge-nav sm"
            onClick={() => onJumpMonth(viewMonth.year + 1, viewMonth.month)}
            title="Next year"
            aria-label="Next year"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className={`total-card ${positive ? 'pos' : 'neg'}`}>
        <span className="tc-label">TOTAL P&amp;L</span>
        <span className="tc-value"><MoneyCountUp value={summary.totalPnl} /></span>
        <div className="tc-meta">
          <span>{summary.tradingDays} traded days</span>
          <span>{summary.tradeCount} trades total</span>
        </div>
        <span className="tc-since">{summary.daysSinceFirst} days since first trade</span>
      </div>

      <div className="lens-block">
        <div className="goals-card">
          <div className="goals-head">
            <Target size={13} />
            <span>{MONTH_SHORT[viewMonth.month]} {viewMonth.year} goal</span>
            {monthlyGoal > 0
              ? <span className={`goals-amt ${progress.pnl >= 0 ? 'pos' : 'neg'}`}>{formatMoneySigned(progress.pnl)} / {formatMoney(monthlyGoal)}</span>
              : <button className="goals-set" onClick={onOpenSettings}>Set goal</button>}
          </div>
          {monthlyGoal > 0 && (
            <>
              <div className="goals-bar">
                <div
                  className={`goals-fill ${progress.pnl >= 0 ? 'pos' : 'neg'}`}
                  style={{ width: `${Math.max(0, Math.min(100, progress.pct))}%` }}
                />
              </div>
              <div className="goals-sub">
                <span>{progress.pct >= 0 ? `${progress.pct.toFixed(0)}% of goal` : 'below zero'}</span>
                <span><b className="pos">{progress.greenDays}</b>G · <b className="neg">{progress.redDays}</b>R</span>
              </div>
            </>
          )}
          <div className="streak-row">
            <div className="streak-chip">
              <Flame size={13} className={streaks.currentType === 'win' ? 'pos' : streaks.currentType === 'loss' ? 'neg' : ''} />
              <span className="streak-val">
                {streaks.current > 0
                  ? `${streaks.current}-day ${streaks.currentType === 'win' ? 'win' : 'loss'} streak`
                  : 'No active streak'}
              </span>
            </div>
            <div className="streak-meta">
              <span title="Best winning-day streak"><b className="pos">{streaks.bestWin}</b> best</span>
              <span title="Consecutive disciplined days"><b className={discStreak >= 3 ? 'pos' : ''}>{discStreak}</b> disc.</span>
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
                title={`${MONTH_SHORT[m.month]} ${m.year} · ${m.tradeCount} trades`}
              >
                <span className="month-name">{MONTH_SHORT[m.month]}</span>
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
            <span className="sc-label">Win Days</span>
            <span className="sc-value">{summary.winDays}</span>
          </div>
          <div className="stat-card loss">
            <span className="sc-label">Loss Days</span>
            <span className="sc-value">{summary.lossDays}</span>
          </div>
        </div>
        <div className="winrate">
          <div className="winrate-top">
            <span>Win Rate</span>
            <span className="winrate-pct">{pct(winRate)}</span>
          </div>
          <div className="winrate-bar">
            <div className="winrate-fill" style={{ width: pct(winRate) }} />
          </div>
        </div>
        <div className="stat-pair">
          <div className="bw-card win">
            <span className="sc-label">Best Day</span>
            <span className="sc-value pos">{summary.bestDay ? formatMoneySigned(summary.bestDay.pnl) : '—'}</span>
            <span className="sc-sub">{summary.bestDay ? shortDate(summary.bestDay.date) : ''}</span>
          </div>
          <div className="bw-card loss">
            <span className="sc-label">Worst Day</span>
            <span className="sc-value neg">{summary.worstDay ? formatMoneySigned(summary.worstDay.pnl) : '—'}</span>
            <span className="sc-sub">{summary.worstDay ? shortDate(summary.worstDay.date) : ''}</span>
          </div>
        </div>
      </div>

      <div className="lens-block">
        <div className="insight-grid">
          <Insight label="Avg Win" value={formatMoneySigned(summary.avgWin)} cls="pos" />
          <Insight label="Avg Loss" value={formatMoneySigned(-summary.avgLoss)} cls="neg" />
          <Insight
            label="Best Week"
            value={bestWeek ? formatMoneySigned(bestWeek.pnl) : '—'}
            sub={bestWeek ? isoWeekLabel(bestWeek.sample) : ''}
            cls="pos"
          />
          <Insight
            label="Profit Factor"
            value={summary.profitFactor === Infinity ? '∞' : summary.profitFactor.toFixed(2)}
            cls={summary.profitFactor >= 1 ? 'pos' : 'neg'}
          />
          <Insight label="Expectancy" value={formatMoneySigned(summary.expectancy)} cls={summary.expectancy >= 0 ? 'pos' : 'neg'} />
          <Insight label="Max Drawdown" value={formatMoney(summary.maxDrawdown)} cls="neg" />
          <Insight
            label="Discipline"
            value={`${disc}`}
            sub="/100 avg"
            cls={disc >= 80 ? 'pos' : disc < 60 ? 'neg' : ''}
          />
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
