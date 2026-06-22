import { useEffect, useMemo, useState } from 'react';
import type { TradeRecord } from './types';
import { groupByDay, computeSummary } from './lib/metrics';
import { loadHolidays, type HolidayMap } from './lib/holidays';
import DataSourceBar from './components/DataSourceBar';
import CalendarView from './components/CalendarView';
import Heatmap from './components/Heatmap';
import Sidebar from './components/Sidebar';
import DayDetailModal from './components/DayDetailModal';
import TradeAtlas from './components/TradeAtlas';
import './App.css';

const STORAGE_KEY = 'pnlcalendar.gsheet';
const THEME_KEY = 'pnlcalendar.theme';

type View = 'calendar' | 'atlas';
type Theme = 'light' | 'dark';

export default function App() {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [holidays, setHolidays] = useState<HolidayMap>({});
  const [view, setView] = useState<View>('calendar');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) as Theme) || 'light'
  );
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    loadHolidays().then(setHolidays);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const dailyMap = useMemo(() => groupByDay(trades), [trades]);
  const summary = useMemo(() => computeSummary(trades), [trades]);

  function handleLoaded(loaded: TradeRecord[]) {
    setTrades(loaded);
    if (loaded.length > 0) {
      const last = loaded[loaded.length - 1].date;
      const [y, m] = last.split('-').map(Number);
      setViewMonth({ year: y, month: m - 1 });
    }
  }

  const selectedDaily = selectedDay ? dailyMap.get(selectedDay) ?? null : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark">📈</span>
            <div className="brand-text">
              <h1>PnL Calendar</h1>
              <span className="brand-sub">Trading performance journal</span>
            </div>
          </div>

          {trades.length > 0 && (
            <nav className="view-tabs">
              <button
                className={view === 'calendar' ? 'active' : ''}
                onClick={() => setView('calendar')}
              >
                Calendar
              </button>
              <button
                className={view === 'atlas' ? 'active' : ''}
                onClick={() => setView('atlas')}
              >
                Trade Atlas
              </button>
            </nav>
          )}

          <DataSourceBar onLoaded={handleLoaded} storageKey={STORAGE_KEY} />

          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            <span className="tt-track">
              <span className="tt-thumb">{theme === 'dark' ? '🌙' : '☀️'}</span>
            </span>
          </button>
        </div>
      </header>

      {trades.length === 0 ? (
        <div className="empty-state">
          <div className="empty-card">
            <span className="empty-mark">📊</span>
            <h2>No data yet</h2>
            <p>
              Upload your <code>Trading.xlsx</code>, or paste a Google Sheet link to load
              your trades.
            </p>
            <p className="muted">
              Data is read from the <strong>3rd worksheet</strong>, with the same column
              names as the desktop app.
            </p>
          </div>
        </div>
      ) : view === 'calendar' ? (
        <main className="layout">
          <section className="main-col">
            <CalendarView
              dailyMap={dailyMap}
              holidays={holidays}
              year={viewMonth.year}
              month={viewMonth.month}
              summary={summary}
              onNavigate={setViewMonth}
              onSelectDay={setSelectedDay}
              onOpenAtlas={() => setView('atlas')}
              heatmap={
                <Heatmap
                  dailyMap={dailyMap}
                  year={viewMonth.year}
                  onSelectMonth={(year, month) => setViewMonth({ year, month })}
                />
              }
            />
          </section>
          <Sidebar
            trades={trades}
            summary={summary}
            onJumpMonth={(year, month) => setViewMonth({ year, month })}
          />
        </main>
      ) : (
        <TradeAtlas trades={trades} summary={summary} onClose={() => setView('calendar')} />
      )}

      {selectedDaily && (
        <DayDetailModal
          daily={selectedDaily}
          holidayName={holidays[selectedDaily.date]}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
