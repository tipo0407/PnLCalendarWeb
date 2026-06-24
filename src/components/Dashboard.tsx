import { useMemo } from 'react';
import {
  CalendarRange, BarChart3, ClipboardList, SlidersHorizontal, Sparkles, ArrowRight, Flame, Target, Lightbulb,
  Shield, Trophy, Sun, TrendingUp, TrendingDown,
} from 'lucide-react';
import type { TradeRecord } from '../types';
import type { Summary } from '../lib/metrics';
import { groupByDay, formatMoneySigned, formatMoney, shortDate } from '../lib/metrics';
import { dayStreaks, monthProgress, yearProgress } from '../lib/goals';
import { earnedBadges } from '../lib/badges';
import { groupByWeek } from '../lib/review';
import { reviewStreak as reviewStreakOf } from '../lib/reviewLog';
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

  // Year-to-date for the most recent year; derive an annual goal from the monthly one.
  const annualGoal = monthlyGoal > 0 ? monthlyGoal * 12 : 0;
  const year = useMemo(() => {
    if (!lastDate) return null;
    return { y: Number(lastDate.slice(0, 4)), prog: yearProgress(days, Number(lastDate.slice(0, 4)), annualGoal) };
  }, [days, lastDate, annualGoal]);

  const recent = useMemo(
    () => [...trades].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.tradeNumber - a.tradeNumber)).slice(0, 8),
    [trades],
  );

  // Single biggest win and loss to celebrate / learn from.
  const extremes = useMemo(() => {
    if (trades.length === 0) return null;
    let best = trades[0], worst = trades[0];
    for (const tr of trades) {
      if (tr.profitLoss > best.profitLoss) best = tr;
      if (tr.profitLoss < worst.profitLoss) worst = tr;
    }
    return { best, worst };
  }, [trades]);

  const monthName = lastDate
    ? new Date(`${lastDate}T00:00:00`).toLocaleString('en-US', { month: 'long' })
    : '';

  const badges = useMemo(() => earnedBadges({
    winStreak: streak.currentType === 'win' ? streak.current : 0,
    reviewStreak: reviewStreakOf(groupByWeek(trades).map((w) => w.key)),
    days,
    monthPnl: month?.pnl ?? 0,
    goalMet: !!month && monthlyGoal > 0 && month.pnl >= monthlyGoal,
  }), [streak, trades, days, month, monthlyGoal]);

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

      {year && year.prog.tradeDays > 0 && (
        <div className="dash-year">
          <span className="dash-year-label">{year.y} {t('dash.ytd')}</span>
          <span className={`dash-year-net ${year.prog.pnl >= 0 ? 'pos' : 'neg'}`}>{formatMoneySigned(year.prog.pnl)}</span>
          {annualGoal > 0 && (
            <span className="dash-year-goal">/ {formatMoney(annualGoal)} · {Math.round(year.prog.pct)}%</span>
          )}
          <span className="dash-year-days">{year.prog.tradeDays} {t('dash.tradingDays')}</span>
        </div>
      )}

      {badges.length > 0 && (
        <div className="dash-badges">
          {badges.map((b) => (
            <div key={b.id} className={`dash-badge ${b.tone}`} title={b.detail}>
              <span className="db-icon"><BadgeIcon icon={b.icon} /></span>
              <span className="db-text">
                <span className="db-title">{b.title}</span>
                <span className="db-detail">{b.detail}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {extremes && extremes.best.profitLoss > 0 && extremes.best !== extremes.worst && (
        <div className="dash-extremes">
          <button className="dash-extreme good" onClick={() => onSelectDay(extremes.best.date)} title={t('dash.openDay')}>
            <span className="de-label"><Trophy size={13} /> {t('dash.bestTrade')}</span>
            <span className="de-pnl pos">{formatMoneySigned(extremes.best.profitLoss)}</span>
            <span className="de-meta">{extremes.best.symbol || '—'}{extremes.best.setup ? ` · ${extremes.best.setup}` : ''} · {shortDate(extremes.best.date)}</span>
          </button>
          <button className="dash-extreme bad" onClick={() => onSelectDay(extremes.worst.date)} title={t('dash.openDay')}>
            <span className="de-label"><TrendingDown size={13} /> {t('dash.worstTrade')}</span>
            <span className="de-pnl neg">{formatMoneySigned(extremes.worst.profitLoss)}</span>
            <span className="de-meta">{extremes.worst.symbol || '—'}{extremes.worst.setup ? ` · ${extremes.worst.setup}` : ''} · {shortDate(extremes.worst.date)}</span>
          </button>
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

function BadgeIcon({ icon }: { icon: string }) {
  const size = 16;
  switch (icon) {
    case 'flame': return <Flame size={size} />;
    case 'shield': return <Shield size={size} />;
    case 'target': return <Target size={size} />;
    case 'trophy': return <Trophy size={size} />;
    case 'sun': return <Sun size={size} />;
    case 'trending': return <TrendingUp size={size} />;
    default: return <Sparkles size={size} />;
  }
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
