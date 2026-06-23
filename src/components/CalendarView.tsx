import { useMemo, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import type { DailyPnl } from '../types';
import type { HolidayMap } from '../lib/holidays';
import type { Summary } from '../lib/metrics';
import { formatMoneySigned, shortDate } from '../lib/metrics';
import { monthBenchmark } from '../lib/goals';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';
import { dayDiscipline, disciplineColor } from '../lib/discipline';
import MoneyCountUp from './CountUp';

interface Props {
  dailyMap: Map<string, DailyPnl>;
  holidays: HolidayMap;
  year: number;
  month: number; // 0-based
  summary: Summary;
  heatmap: ReactNode;
  onNavigate: (m: { year: number; month: number }) => void;
  onSelectDay: (date: string) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function CalendarView({
  dailyMap,
  holidays,
  year,
  month,
  heatmap,
  onNavigate,
  onSelectDay,
}: Props) {
  useLang(); // re-render on language change
  const { weeks, monthDays, stats } = useMemo(() => {
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    // Collect month day records.
    let total = 0;
    let trades = 0;
    let winDays = 0;
    let lossDays = 0;
    let activeDays = 0;
    let best: DailyPnl | null = null;
    let worst: DailyPnl | null = null;
    let streak = 0;
    const monthDays: DailyPnl[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const day = dailyMap.get(iso(year, month, d));
      if (!day) continue;
      monthDays.push(day);
      total += day.pnl;
      trades += day.tradeCount;
      activeDays++;
      if (day.pnl > 0) winDays++;
      else if (day.pnl < 0) lossDays++;
      if (!best || day.pnl > best.pnl) best = day;
      if (!worst || day.pnl < worst.pnl) worst = day;
    }
    for (let i = monthDays.length - 1; i >= 0; i--) {
      if (monthDays[i].pnl > 0) streak++;
      else break;
    }

    // Build Mon–Fri week rows: iterate each week whose Monday falls on/before
    // the month end, starting from the Monday on/before the 1st.
    const first = new Date(Date.UTC(year, month, 1));
    const startOffset = (first.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
    const monthEnd = Date.UTC(year, month, daysInMonth);
    const monday = new Date(first);
    monday.setUTCDate(1 - startOffset);

    const weeks: { days: (number | null)[]; total: number; active: boolean }[] = [];
    while (monday.getTime() <= monthEnd) {
      const days: (number | null)[] = [];
      let weekTotal = 0;
      let weekActive = false;
      for (let wd = 0; wd < 5; wd++) {
        const cur = new Date(monday);
        cur.setUTCDate(monday.getUTCDate() + wd);
        if (cur.getUTCFullYear() === year && cur.getUTCMonth() === month) {
          const dn = cur.getUTCDate();
          days.push(dn);
          const rec = dailyMap.get(iso(year, month, dn));
          if (rec) {
            weekTotal += rec.pnl;
            weekActive = true;
          }
        } else {
          days.push(null);
        }
      }
      if (days.some((d) => d !== null)) {
        weeks.push({ days, total: weekTotal, active: weekActive });
      }
      monday.setUTCDate(monday.getUTCDate() + 7);
    }

    return {
      weeks,
      monthDays,
      stats: {
        total,
        trades,
        days: activeDays,
        winDays,
        lossDays,
        avgDay: activeDays ? total / activeDays : 0,
        winRate: activeDays ? winDays / activeDays : 0,
        streak,
        best,
        worst,
      },
    };
  }, [dailyMap, year, month]);

  const benchmark = useMemo(() => {
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    let businessDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const wd = new Date(Date.UTC(year, month, d)).getUTCDay();
      if (wd !== 0 && wd !== 6) businessDays++;
    }
    return monthBenchmark(monthDays, businessDays);
  }, [monthDays, year, month]);

  const monthMax = useMemo(() => {
    let max = 0;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const day = dailyMap.get(iso(year, month, d));
      if (day) max = Math.max(max, Math.abs(day.pnl));
    }
    return max;
  }, [dailyMap, year, month]);

  function go(delta: number) {
    const m = month + delta;
    const y = year + Math.floor(m / 12);
    const nm = ((m % 12) + 12) % 12;
    onNavigate({ year: y, month: nm });
  }

  const today = new Date();
  const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <>
      {/* Hero */}
      <div className="hero">
        <div className="hero-lead">
          <div className="hero-month-nav">
            <button className="hero-nav-btn" onClick={() => go(-1)} title="Previous month" aria-label="Previous month"><ChevronLeft size={16} /></button>
            <span className="hero-month-title">{MONTH_NAMES[month]} {year}</span>
            <button className="hero-nav-btn" onClick={() => go(1)} title="Next month" aria-label="Next month"><ChevronRight size={16} /></button>
          </div>
          <span className={`hero-big ${stats.total >= 0 ? 'pos-strong' : 'neg-strong'}`}>
            <MoneyCountUp value={stats.total} />
          </span>
          <span className="hero-lead-sub">{stats.trades} trades · {stats.days} traded days</span>
        </div>

        <div className="hero-stats">
          <div className="hstat">
            <span className="hstat-label">{t('cal.avgDay')}</span>
            <span className="hstat-val">{formatMoneySigned(stats.avgDay)}</span>
            <span className="hstat-sub">over {stats.days} days</span>
          </div>
          <div className="hstat">
            <span className="hstat-label">{t('cal.winRate')}</span>
            <span className="hstat-val">{(stats.winRate * 100).toFixed(0)}%</span>
            <span className="hstat-sub">{stats.winDays}W · {stats.lossDays}L</span>
          </div>
          <div className="hstat">
            <span className="hstat-label">{t('cal.winStreak')}</span>
            <span className="hstat-val">{stats.streak}</span>
            <span className="hstat-sub">{stats.streak === 1 ? 'day' : 'days'}</span>
          </div>
          <div className="hstat">
            <span className="hstat-label">{t('cal.bestDay')}</span>
            <span className="hstat-val pos">{stats.best ? formatMoneySigned(stats.best.pnl) : '—'}</span>
            <span className="hstat-sub">{stats.best ? shortDate(stats.best.date) : '—'}</span>
          </div>
          <div className="hstat">
            <span className="hstat-label">{t('cal.worstDay')}</span>
            <span className="hstat-val neg">{stats.worst ? formatMoneySigned(stats.worst.pnl) : '—'}</span>
            <span className="hstat-sub">{stats.worst ? shortDate(stats.worst.date) : '—'}</span>
          </div>
          <div className="hstat">
            <span className="hstat-label">{t('cal.projected')}</span>
            <span className={`hstat-val ${benchmark.projected >= 0 ? 'pos' : 'neg'}`}>{stats.days ? formatMoneySigned(benchmark.projected) : '—'}</span>
            <span className="hstat-sub">at current pace</span>
          </div>
          <div className="hstat">
            <span className="hstat-label">{t('cal.consistency')}</span>
            <span className="hstat-val">{stats.days ? `${benchmark.consistency}` : '—'}<span className="hstat-unit">/100</span></span>
            <span className="hstat-sub">{benchmark.topDayShare > 0 ? `top day ${(benchmark.topDayShare * 100).toFixed(0)}%` : 'spread of gains'}</span>
          </div>
        </div>
      </div>

      {/* Calendar grid (activity heatmap sits above the grid) */}
      <div className="calendar-card">
        <div className="cal-heatmap">{heatmap}</div>

        <div className="cal-grid">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-weekday">{w}</div>
          ))}
          <div className="cal-weekday week-total-head">Week</div>

          {weeks.map((week, wi) => (
            <div key={wi} className="cal-week-row">
              {week.days.map((d, di) => {
                if (d === null) return <div key={`e-${wi}-${di}`} className="cal-cell empty" />;
                const date = iso(year, month, d);
                const day = dailyMap.get(date);
                const holiday = holidays[date];
                const tone = day ? (day.pnl >= 0 ? 'win' : 'loss') : '';
                const intensity = day && monthMax ? Math.min(1, Math.abs(day.pnl) / monthMax) : 0;
                const toneA = 0.06 + Math.pow(intensity, 1.35) * 0.58;
                return (
                  <div
                    key={date}
                    className={`cal-cell ${tone}${day ? ' clickable' : ''}${date === todayIso ? ' today' : ''}`}
                    style={day ? ({ ['--tone-a' as string]: toneA }) : undefined}
                    onClick={() => day && onSelectDay(date)}
                    {...(day
                      ? {
                          role: 'button',
                          tabIndex: 0,
                          'aria-label': `${MONTH_NAMES[month]} ${d}, ${formatMoneySigned(day.pnl)}, ${day.tradeCount} trades`,
                          onKeyDown: (e: ReactKeyboardEvent) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelectDay(date);
                            }
                          },
                        }
                      : {})}
                  >
                    <div className="cell-top">
                      <span className="cell-day-wrap">
                        <span className="cell-day">{d}</span>
                        {day && (
                          <span
                            className="cell-disc"
                            style={{ background: disciplineColor(dayDiscipline(day)) }}
                            title={`Discipline ${dayDiscipline(day)}/100`}
                          />
                        )}
                      </span>
                      {day && <span className="cell-trades">{day.tradeCount} trades</span>}
                    </div>
                    {day ? (
                      <div className="cell-body">
                        <span className={`cell-pnl ${day.pnl >= 0 ? 'pos' : 'neg'}`}>
                          {formatMoneySigned(day.pnl)}
                        </span>
                        {day.trades.some((t) => t.note) && <span className="cell-note">note</span>}
                      </div>
                    ) : holiday ? (
                      <div className="cell-body">
                        <span className="cell-holiday"><CalendarDays size={11} /> {holiday}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <div className={`cal-cell week-total${week.active ? '' : ' empty'}`}>
                <span className="wt-label">Week</span>
                {week.active && (
                  <span className={`wt-val ${week.total >= 0 ? 'pos' : 'neg'}`}>
                    {formatMoneySigned(week.total)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
