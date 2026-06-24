import { useMemo } from 'react';
import {
  CalendarRange, BarChart3, ClipboardList, SlidersHorizontal, Sparkles, ArrowRight, Flame, Target, Lightbulb,
} from 'lucide-react';
import type { TradeRecord } from '../types';
import type { Summary } from '../lib/metrics';
import { groupByDay, formatMoneySigned, formatMoney, shortDate } from '../lib/metrics';
import { dayStreaks, monthProgress } from '../lib/goals';
import { generateInsights } from '../lib/insights';
import { useUserTags } from '../lib/useUserTags';
import { getSettings } from '../lib/settings';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';

type ViewId = 'home' | 'calendar' | 'atlas' | 'review';

interface Props {
  trades: TradeRecord[];
  summary: Summary;
  onSetView: (v: ViewId) => void;
  onSelectDay: (date: string) => void;
  onOpenSettings: () => void;
  onOpenPricing: () => void;
}

export default function Dashboard({ trades, summary, onSetView, onSelectDay, onOpenSettings, onOpenPricing }: Props) {
  useLang(); // re-render on language change
  const days = useMemo(() => [...groupByDay(trades).values()], [trades]);
  const streak = useMemo(() => dayStreaks(days), [days]);
  const userTags = useUserTags();
  const insights = useMemo(() => generateInsights(trades, userTags), [trades, userTags]);

  const lastDate = trades.length ? trades[trades.length - 1].date : null;
  const { monthlyGoal } = getSettings();
  const month = useMemo(() => {
    if (!lastDate) return null;
    const [y, m] = lastDate.split('-').map(Number);
    return monthProgress(days, y, m - 1, monthlyGoal);
  }, [days, lastDate, monthlyGoal]);

  const recent = useMemo(
    () => [...trades].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.tradeNumber - a.tradeNumber)).slice(0, 8),
    [trades],
  );

  const monthName = lastDate
    ? new Date(`${lastDate}T00:00:00`).toLocaleString('en-US', { month: 'long' })
    : '';

  return (
    <div className="dash">
      <div className="dash-kpis">
        <KpiBig label={t('dash.netPnl')} value={formatMoneySigned(summary.totalPnl)} cls={summary.totalPnl >= 0 ? 'pos' : 'neg'} sub={`${summary.tradeCount} trades`} />
        <KpiBig label={t('dash.winRate')} value={`${(summary.winRateTrades * 100).toFixed(0)}%`} sub={`${summary.winTrades}W · ${summary.lossTrades}L`} />
        <KpiBig label={t('dash.profitFactor')} value={summary.profitFactor === Infinity ? '∞' : summary.profitFactor.toFixed(2)} sub={`expectancy ${formatMoneySigned(summary.expectancy)}`} />
        <KpiBig
          label={t('dash.dayStreak')}
          value={streak.current > 0 ? `${streak.current}` : '—'}
          icon={<Flame size={16} className={streak.currentType === 'win' ? 'pos' : streak.currentType === 'loss' ? 'neg' : ''} />}
          sub={streak.current > 0 ? `${streak.currentType === 'win' ? 'winning' : 'losing'} days` : 'no active streak'}
        />
      </div>

      {month && (
        <div className="dash-month">
          {monthlyGoal > 0 ? (
            <div className="dash-month-ring-wrap">
              <GoalRing pct={month.pct} positive={month.pnl >= 0} />
              <div className="dash-month-info">
                <div className="dash-month-head">
                  <Target size={15} />
                  <span>{monthName} so far</span>
                </div>
                <span className={`dash-month-net ${month.pnl >= 0 ? 'pos' : 'neg'}`}>
                  {formatMoneySigned(month.pnl)} <span className="dash-month-goal">/ {formatMoney(monthlyGoal)}</span>
                </span>
                <div className="dash-month-sub"><b className="pos">{month.greenDays}</b> green · <b className="neg">{month.redDays}</b> red days</div>
              </div>
            </div>
          ) : (
            <>
              <div className="dash-month-head">
                <Target size={15} />
                <span>{monthName} so far</span>
                <span className={`dash-month-net ${month.pnl >= 0 ? 'pos' : 'neg'}`}>{formatMoneySigned(month.pnl)}</span>
                <button className="dash-link-sm" onClick={onOpenSettings}>{t('dash.setGoal')}</button>
              </div>
              <div className="dash-month-sub"><b className="pos">{month.greenDays}</b> green · <b className="neg">{month.redDays}</b> red days</div>
            </>
          )}
        </div>
      )}

      {insights.length > 0 && (
        <div className="dash-insights">
          <h3 className="dash-h"><Lightbulb size={14} /> Insights</h3>
          <ul className="dash-insight-list">
            {insights.map((ins, i) => (
              <li key={i} className={`dash-insight ${ins.tone}`}>
                <span className="di-dot" />
                <span>{ins.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="dash-cols">
        <div className="dash-quick">
          <h3 className="dash-h">{t('dash.jumpTo')}</h3>
          <QuickLink icon={<CalendarRange size={17} />} title={t('dash.qCalendar')} desc="Monthly P&L grid & heatmap" onClick={() => onSetView('calendar')} />
          <QuickLink icon={<BarChart3 size={17} />} title={t('dash.qAtlas')} desc="Equity, edges, risk & playbook" onClick={() => onSetView('atlas')} />
          <QuickLink icon={<ClipboardList size={17} />} title={t('dash.qReview')} desc="What worked, what hurt" onClick={() => onSetView('review')} />
          <QuickLink icon={<SlidersHorizontal size={17} />} title={t('dash.qSettings')} desc="Currency, goals, account, data" onClick={onOpenSettings} />
          <QuickLink icon={<Sparkles size={17} />} title={t('dash.qPlans')} desc="Unlock Pro analytics" onClick={onOpenPricing} />
        </div>

        <div className="dash-recent">
          <h3 className="dash-h">{t('dash.recent')}</h3>
          <div className="dash-recent-list">
            {recent.length === 0 && <div className="dash-recent-empty">No trades yet.</div>}
            {recent.map((tr, i) => (
              <button key={`${tr.date}-${tr.rowNumber}-${i}`} className="dash-recent-row" onClick={() => onSelectDay(tr.date)}>
                <span className="dr-date">{shortDate(tr.date)}</span>
                <span className="dr-sym">{tr.symbol || '—'}</span>
                <span className="dr-setup">{tr.setup || ''}</span>
                <span className={`dr-pnl ${tr.profitLoss >= 0 ? 'pos' : 'neg'}`}>{formatMoneySigned(tr.profitLoss)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GoalRing({ pct, positive }: { pct: number; positive: boolean }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const R = 26;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - clamped / 100);
  const stroke = positive ? 'var(--pos)' : 'var(--neg)';
  return (
    <svg className="goal-ring" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${Math.round(pct)}% of goal`}>
      <circle cx="32" cy="32" r={R} fill="none" stroke="var(--border)" strokeWidth="6" />
      <circle
        cx="32" cy="32" r={R} fill="none" stroke={stroke} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={offset} transform="rotate(-90 32 32)"
      />
      <text x="32" y="36" textAnchor="middle" className="goal-ring-text">{Math.round(clamped)}%</text>
    </svg>
  );
}

function KpiBig({ label, value, sub, cls, icon }: { label: string; value: string; sub?: string; cls?: string; icon?: React.ReactNode }) {
  return (
    <div className="dash-kpi">
      <span className="dash-kpi-label">{label}</span>
      <span className={`dash-kpi-value ${cls ?? ''}`}>{icon}{value}</span>
      {sub && <span className="dash-kpi-sub">{sub}</span>}
    </div>
  );
}

function QuickLink({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button className="dash-quick-link" onClick={onClick}>
      <span className="dql-icon">{icon}</span>
      <span className="dql-text">
        <span className="dql-title">{title}</span>
        <span className="dql-desc">{desc}</span>
      </span>
      <ArrowRight size={15} className="dql-arrow" />
    </button>
  );
}
