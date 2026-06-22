import { useMemo, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, CalendarDays, Sparkles } from 'lucide-react';
import type { DailyPnl } from '../types';
import type { HolidayMap } from '../lib/holidays';
import type { Summary } from '../lib/metrics';
import { formatMoneySigned, shortDate } from '../lib/metrics';
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
  onOpenAtlas: () => void;
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
  onOpenAtlas,
}: Props) {
  const { weeks, stats } = useMemo(() => {
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    // Collect month day records.
    let total = 0;
    let trades = 0;
    let winDays = 0;
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
      stats: {
        total,
        trades,
        avgDay: activeDays ? total / activeDays : 0,
        winRate: activeDays ? winDays / activeDays : 0,
        streak,
        best,
        worst,
      },
    };
  }, [dailyMap, year, month]);

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
        <div className="hero-left">
          <span className="hero-eyebrow">TRADING JOURNAL</span>
          <h2 className="hero-month">
            {MONTH_NAMES[month]} <span className="hero-year">{year}</span>
          </h2>
          <div className="hero-pills">
            <div className="hero-pill">
              <span className="hp-label">Avg Day</span>
              <span className="hp-value">{formatMoneySigned(stats.avgDay)}</span>
            </div>
            <div className="hero-pill">
              <span className="hp-label">Win Rate</span>
              <span className="hp-value">{(stats.winRate * 100).toFixed(0)}%</span>
            </div>
            <div className="hero-pill">
              <span className="hp-label">Streak</span>
              <span className="hp-value">
                {stats.streak} winning day{stats.streak === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <div className="hero-actions">
            <button className="hero-btn" onClick={() => onNavigate({ year: today.getFullYear(), month: today.getMonth() })}>
              <CalendarDays size={15} /> Today
            </button>
            <button className="hero-btn ghost" onClick={onOpenAtlas}>
              <Sparkles size={15} /> Trade Atlas <ArrowRight size={15} />
            </button>
          </div>
        </div>

        <div className="hero-total">
          <span className="ht-label">MONTH TOTAL</span>
          <span className={`ht-value ${stats.total >= 0 ? 'pos-strong' : 'neg-strong'}`}>
            <MoneyCountUp value={stats.total} />
          </span>
          <span className="ht-sub">{stats.trades} trades</span>
          <div className="ht-bw">
            <div className="ht-bw-item">
              <span className="ht-bw-label">Best Day</span>
              {stats.best ? (
                <span className="ht-bw-val">
                  {shortDate(stats.best.date)} · <span className="pos">{formatMoneySigned(stats.best.pnl)}</span>
                </span>
              ) : (
                <span className="ht-bw-val muted">—</span>
              )}
            </div>
            <div className="ht-bw-item">
              <span className="ht-bw-label">Worst Day</span>
              {stats.worst ? (
                <span className="ht-bw-val">
                  {shortDate(stats.worst.date)} · <span className="neg">{formatMoneySigned(stats.worst.pnl)}</span>
                </span>
              ) : (
                <span className="ht-bw-val muted">—</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Activity heatmap */}
      {heatmap}

      {/* Calendar grid */}
      <div className="calendar-card">
        <div className="cal-nav">
          <button className="edge-nav" onClick={() => go(-1)} title="Previous month" aria-label="Previous month"><ChevronLeft size={18} /></button>
          <span className="cal-nav-title">{MONTH_NAMES[month]} {year}</span>
          <button className="edge-nav" onClick={() => go(1)} title="Next month" aria-label="Next month"><ChevronRight size={18} /></button>
        </div>

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
                return (
                  <div
                    key={date}
                    className={`cal-cell ${tone}${day ? ' clickable' : ''}${date === todayIso ? ' today' : ''}`}
                    style={day ? ({ ['--tone-a' as string]: 0.18 + intensity * 0.32 }) : undefined}
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
                      <span className="cell-day">{d}</span>
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
