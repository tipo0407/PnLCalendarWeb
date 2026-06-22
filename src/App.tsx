import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CandlestickChart, Sun, Moon, UploadCloud } from 'lucide-react';
import type { TradeRecord } from './types';
import { groupByDay, computeSummary } from './lib/metrics';
import { parseWorkbook } from './lib/parseWorkbook';
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

  // Auto-load the live trades workbook served at /data/trades.xlsx (no manual upload needed).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/data/trades.xlsx', { cache: 'no-store' });
        if (!resp.ok) return;
        const buf = await resp.arrayBuffer();
        const loaded = parseWorkbook(buf);
        if (cancelled || loaded.length === 0) return;
        setTrades(loaded);
        const last = loaded[loaded.length - 1].date;
        const [yy, mm] = last.split('-').map(Number);
        setViewMonth({ year: yy, month: mm - 1 });
      } catch {
        // Fall back to the empty state; manual upload/Sync still available.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Cursor-follow spotlight on interactive cards (premium hover glow).
  useEffect(() => {
    const sel = '.kpi-card, .atlas-panel, .insight, .stat-card, .bw-card, .cal-cell.clickable, .total-card, .hstat, .day-chart';
    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(sel);
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => document.removeEventListener('pointermove', onMove);
  }, []);

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
            <span className="brand-mark"><CandlestickChart size={20} strokeWidth={2.25} /></span>
            <div className="brand-text">
              <h1>PnL Calendar</h1>
              <span className="brand-sub">Trading performance journal</span>
            </div>
          </div>

          {trades.length > 0 && (
            <nav className="view-tabs">
              {(['calendar', 'atlas'] as const).map((v) => (
                <button
                  key={v}
                  className={`tab-btn ${view === v ? 'active' : ''}`}
                  onClick={() => setView(v)}
                >
                  {view === v && (
                    <motion.span
                      layoutId="tabPill"
                      className="tab-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="tab-label">{v === 'calendar' ? 'Calendar' : 'Trade Atlas'}</span>
                </button>
              ))}
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
              <span className="tt-thumb">
                {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
              </span>
            </span>
          </button>
        </div>
      </header>

      {trades.length === 0 ? (
        <div className="empty-state">
          <motion.div
            className="empty-card"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="empty-mark"><UploadCloud size={30} strokeWidth={1.75} /></span>
            <h2>No data yet</h2>
            <p>
              Upload your <code>Trading.xlsx</code>, or paste a Google Sheet link to load
              your trades.
            </p>
            <p className="muted">
              Data is read from the <strong>3rd worksheet</strong>, with the same column
              names as the desktop app.
            </p>
          </motion.div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {view === 'calendar' ? (
            <motion.main
              key="calendar"
              className="layout"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <Sidebar
                trades={trades}
                summary={summary}
                viewMonth={viewMonth}
                onJumpMonth={(year, month) => setViewMonth({ year, month })}
              />
              <section className="main-col">
                <CalendarView
                  dailyMap={dailyMap}
                  holidays={holidays}
                  year={viewMonth.year}
                  month={viewMonth.month}
                  summary={summary}
                  onNavigate={setViewMonth}
                  onSelectDay={setSelectedDay}
                  heatmap={
                    <Heatmap
                      dailyMap={dailyMap}
                      year={viewMonth.year}
                      onSelectMonth={(year, month) => setViewMonth({ year, month })}
                    />
                  }
                />
              </section>
            </motion.main>
          ) : (
            <motion.div
              key="atlas"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <TradeAtlas trades={trades} summary={summary} />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <AnimatePresence>
        {selectedDaily && (
          <DayDetailModal
            daily={selectedDaily}
            holidayName={holidays[selectedDaily.date]}
            onClose={() => setSelectedDay(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
