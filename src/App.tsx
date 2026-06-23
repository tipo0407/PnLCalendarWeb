import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CandlestickChart, Sun, Moon, UploadCloud, Sparkles, ShieldCheck, CalendarRange, Brain, Target, Lock, SlidersHorizontal, Check } from 'lucide-react';
import type { TradeRecord } from './types';
import { groupByDay, computeSummary, distinctAccounts } from './lib/metrics';
import { parseWorkbook } from './lib/parseWorkbook';
import type { SheetData } from './lib/parseWorkbook';
import { sampleTrades } from './data/sampleTrades';
import { savePersistedTrades, loadPersistedTrades } from './lib/persist';
import { loadHolidays, type HolidayMap } from './lib/holidays';
import DataSourceBar from './components/DataSourceBar';
import ImportWizard from './components/ImportWizard';
import CalendarView from './components/CalendarView';
import Heatmap from './components/Heatmap';
import Sidebar from './components/Sidebar';
import DayDetailModal from './components/DayDetailModal';
import TradeAtlas from './components/TradeAtlas';
import WeeklyReview from './components/WeeklyReview';
import SettingsModal from './components/SettingsModal';
import PricingModal from './components/PricingModal';
import OnboardingChecklist from './components/OnboardingChecklist';
import ProfileSwitcher from './components/ProfileSwitcher';
import CommandPalette from './components/CommandPalette';
import { SETTINGS_EVENT } from './lib/settings';
import { useIsPro } from './lib/usePlan';
import { OPEN_PRICING_EVENT } from './lib/pricingBus';
import { t, getLang } from './lib/i18n';
import { useLang } from './lib/useLang';
import './App.css';

const STORAGE_KEY = 'pnlcalendar.gsheet';
const THEME_KEY = 'pnlcalendar.theme';
const SYNC_KEY = 'pnlcalendar.lastSync';

type View = 'calendar' | 'atlas' | 'review';
type Theme = 'light' | 'dark';

export default function App() {
  const [trades, setTrades] = useState<TradeRecord[]>(() => loadPersistedTrades() ?? []);
  const [holidays, setHolidays] = useState<HolidayMap>({});
  const [view, setView] = useState<View>('calendar');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) as Theme) || 'light'
  );
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => {
    const p = loadPersistedTrades();
    if (p && p.length > 0) {
      const [y, m] = p[p.length - 1].date.split('-').map(Number);
      return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [syncing, setSyncing] = useState(false);
  const [sampleMode, setSampleMode] = useState(false);
  const pro = useIsPro();
  useLang(); // re-render on language change
  const [importSheets, setImportSheets] = useState<SheetData[] | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  // Bumped on any settings change so money/labels re-render with new prefs.
  const [, setSettingsTick] = useState(0);

  useEffect(() => {
    const bump = () => setSettingsTick((n) => n + 1);
    window.addEventListener(SETTINGS_EVENT, bump);
    return () => window.removeEventListener(SETTINGS_EVENT, bump);
  }, []);

  useEffect(() => {
    const open = () => setShowPricing(true);
    window.addEventListener(OPEN_PRICING_EVENT, open);
    return () => window.removeEventListener(OPEN_PRICING_EVENT, open);
  }, []);

  useEffect(() => {
    loadHolidays().then(setHolidays);
  }, []);

  // Reflect the persisted language on <html lang> at startup.
  useEffect(() => {
    document.documentElement.lang = getLang();
  }, []);

  // Global keyboard shortcuts: 1/2/3 switch views, t toggles theme, , opens settings.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K opens the command palette (works even while typing).
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShowPalette((v) => !v);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const hasData = trades.length > 0;
      switch (e.key) {
        case '1': if (hasData) setView('calendar'); break;
        case '2': if (hasData) setView('atlas'); break;
        case '3': if (hasData) setView('review'); break;
        case 't': case 'T': setTheme((t) => (t === 'dark' ? 'light' : 'dark')); break;
        case ',': setShowSettings(true); break;
        default: return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trades.length]);

  // Auto-load the live trades workbook served at /data/trades.xlsx (no manual upload needed).
  // On the first page load each day, first trigger a Google Sheet sync so the data is current.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
      const lastSync = localStorage.getItem(SYNC_KEY);
      if (lastSync !== today) {
        localStorage.setItem(SYNC_KEY, today); // optimistic: avoid duplicate syncs on quick reloads
        setSyncing(true);
        try {
          const r = await fetch('/api/sync', { method: 'POST' });
          if (!r.ok) throw new Error('sync failed');
        } catch {
          localStorage.removeItem(SYNC_KEY); // let it retry on the next load
        } finally {
          if (!cancelled) setSyncing(false);
        }
      }
      try {
        const resp = await fetch('/data/trades.xlsx', { cache: 'no-store' });
        if (!resp.ok) return;
        const buf = await resp.arrayBuffer();
        const loaded = parseWorkbook(buf);
        if (cancelled || loaded.length === 0) return;
        setSampleMode(false);
        setTrades(loaded);
        savePersistedTrades(loaded);
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

  const accounts = useMemo(() => distinctAccounts(trades), [trades]);
  const setupNames = useMemo(() => {
    const set = new Set<string>();
    for (const t of trades) { const s = (t.setup ?? '').trim(); if (s) set.add(s); }
    return [...set];
  }, [trades]);
  const [account, setAccount] = useState<string>('All');
  const filteredTrades = useMemo(
    () => (account === 'All' ? trades : trades.filter((t) => (t.account ?? '') === account)),
    [trades, account],
  );
  const dailyMap = useMemo(() => groupByDay(filteredTrades), [filteredTrades]);
  const summary = useMemo(() => computeSummary(filteredTrades), [filteredTrades]);

  function applyTrades(loaded: TradeRecord[]) {
    setSampleMode(false);
    setTrades(loaded);
    if (loaded.length > 0) {
      const last = loaded[loaded.length - 1].date;
      const [y, m] = last.split('-').map(Number);
      setViewMonth({ year: y, month: m - 1 });
    }
    savePersistedTrades(loaded);
  }

  function handleLoaded(loaded: TradeRecord[]) {
    applyTrades(loaded);
  }

  function reloadProfile() {
    setSampleMode(false);
    setAccount('All');
    const p = loadPersistedTrades();
    if (p && p.length > 0) {
      setTrades(p);
      const [y, m] = p[p.length - 1].date.split('-').map(Number);
      setViewMonth({ year: y, month: m - 1 });
    } else {
      setTrades([]);
    }
  }

  function loadSample() {
    setTrades(sampleTrades);
    const last = sampleTrades[sampleTrades.length - 1].date;
    const [y, m] = last.split('-').map(Number);
    setViewMonth({ year: y, month: m - 1 });
    setSampleMode(true);
  }

  const selectedDaily = selectedDay ? dailyMap.get(selectedDay) ?? null : null;

  return (
    <div className="app">
      {syncing && (
        <div className="sync-toast" role="status" aria-live="polite">
          <span className="sync-spinner" />
          Syncing latest from Google Sheet…
        </div>
      )}
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark"><CandlestickChart size={20} strokeWidth={2.25} /></span>
            <div className="brand-text">
              <h1>PnL Calendar</h1>
              <span className="brand-sub">{t('brand.sub')}</span>
            </div>
          </div>

          <ProfileSwitcher onChange={reloadProfile} />

          {sampleMode && (
            <span className="sample-badge">
              <Sparkles size={13} /> Sample data
              <button
                className="sample-clear"
                onClick={() => { setTrades([]); setSampleMode(false); }}
              >
                Clear
              </button>
            </span>
          )}

          {trades.length > 0 && (
            <nav className="view-tabs" aria-label="Views">
              {(['calendar', 'atlas', 'review'] as const).map((v, i) => (
                <button
                  key={v}
                  className={`tab-btn ${view === v ? 'active' : ''}`}
                  onClick={() => setView(v)}
                  title={`${t(`tab.${v}`)} (${i + 1})`}
                  aria-keyshortcuts={String(i + 1)}
                  aria-current={view === v ? 'page' : undefined}
                >
                  {view === v && (
                    <motion.span
                      layoutId="tabPill"
                      className="tab-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="tab-label">{t(`tab.${v}`)}</span>
                </button>
              ))}
            </nav>
          )}

          {trades.length > 0 && accounts.length > 1 && (
            <label className="acct-filter" title="Filter by account">
              <select value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Account filter">
                <option value="All">All accounts</option>
                {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          )}

          <DataSourceBar onSheets={setImportSheets} storageKey={STORAGE_KEY} onSample={loadSample} />

          <button className={`pro-pill ${pro ? 'is-pro' : ''}`} onClick={() => setShowPricing(true)} title={pro ? 'Pro is active' : 'Plans & pricing'}>
            {pro ? <Check size={13} /> : <Sparkles size={13} />} {pro ? 'Pro' : 'Pro'}
          </button>

          <button
            className="icon-btn"
            onClick={() => setShowSettings(true)}
            title="Settings"
            aria-label="Settings"
          >
            <SlidersHorizontal size={16} />
          </button>

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

      <AnimatePresence>
        {showSettings && <SettingsModal key="settings" onClose={() => setShowSettings(false)} trades={trades} onReplaceTrades={applyTrades} />}
        {showPricing && <PricingModal key="pricing" onClose={() => setShowPricing(false)} />}
      </AnimatePresence>

      {showPalette && (
        <CommandPalette
          trades={filteredTrades}
          onClose={() => setShowPalette(false)}
          onSelectDay={(d) => { setView('calendar'); setSelectedDay(d); }}
          onSetView={setView}
          onOpenSettings={() => setShowSettings(true)}
          onOpenPricing={() => setShowPricing(true)}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        />
      )}

      {trades.length === 0 ? (
        <div className="landing">
          <motion.section
            className="landing-hero"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="landing-eyebrow"><Lock size={12} /> Local-first · privacy-first</span>
            <h2 className="landing-title">
              Turn your trading spreadsheet into a<br />
              <span className="grad">visual discipline journal</span>.
            </h2>
            <p className="landing-tagline">
              {t('landing.tagline')}
            </p>
            <div className="landing-cta">
              <button className="btn btn-sample" onClick={loadSample}>
                <Sparkles size={16} /> {t('landing.cta')}
              </button>
              <span className="landing-cta-hint">
                <UploadCloud size={14} /> or upload your <code>.xlsx</code> / CSV, or paste a Google Sheet link above
              </span>
              <button className="landing-plans" onClick={() => setShowPricing(true)}>
                <Sparkles size={14} /> {t('landing.plans')}
              </button>
            </div>

            <div className="landing-features">
              <div className="lf">
                <span className="lf-icon"><CalendarRange size={18} /></span>
                <h3>See your edge at a glance</h3>
                <p>P&amp;L calendar, 12-month heatmap, equity curve, win rate, profit factor and expectancy.</p>
              </div>
              <div className="lf">
                <span className="lf-icon"><Brain size={18} /></span>
                <h3>Behavioral review, not just charts</h3>
                <p>Auto-detected mistakes, emotion edge, a daily discipline score and rule-break tracking.</p>
              </div>
              <div className="lf">
                <span className="lf-icon"><Target size={18} /></span>
                <h3>Change one thing each week</h3>
                <p>The weekly review finds your single biggest leak and exports a clean PDF report.</p>
              </div>
              <div className="lf">
                <span className="lf-icon"><ShieldCheck size={18} /></span>
                <h3>Your data stays with you</h3>
                <p>Read in your browser. No broker credentials, no required cloud, no account.</p>
              </div>
            </div>

            <div className="landing-fit">
              <div className="fit-col good">
                <h4>Built for</h4>
                <ul>
                  <li>Traders already journaling in Excel / Google Sheets</li>
                  <li>Futures &amp; day-trading scalpers</li>
                  <li>Prop-firm challenge takers who need discipline</li>
                </ul>
              </div>
              <div className="fit-col bad">
                <h4>Not for</h4>
                <ul>
                  <li>Fully automated broker sync</li>
                  <li>Institutional-grade backtesting</li>
                  <li>Complex multi-leg options analytics</li>
                </ul>
              </div>
            </div>

            <div className="landing-faq">
              <h3 className="landing-section-title">Frequently asked</h3>
              <div className="faq-grid">
                <FaqItem q="Do I have to connect my broker?">
                  No. You import an xlsx/CSV file or paste a Google Sheet link. There are no broker
                  credentials and nothing is required to leave your browser.
                </FaqItem>
                <FaqItem q="Where is my data stored?">
                  Locally, in your browser. Trades, tags, screenshots and settings live on your
                  device. You can export a JSON backup anytime and clear everything in one click.
                </FaqItem>
                <FaqItem q="Which formats can I import?">
                  Excel (.xlsx), CSV and Google Sheets. The import wizard auto-detects 10+ broker
                  layouts (IBKR, Tradovate, NinjaTrader, Webull, Rithmic, DAS and more) or lets you
                  map columns yourself.
                </FaqItem>
                <FaqItem q="Is this financial advice?">
                  No. It’s a journaling and review tool to help you understand your own behavior —
                  not a signal service or investment advice.
                </FaqItem>
              </div>
            </div>

            <p className="landing-foot">
              A trading journal &amp; review tool — not investment advice. Data is read from the
              <strong> 3rd worksheet</strong> by default (or pick a sheet &amp; map columns on import).
            </p>
          </motion.section>
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
                trades={filteredTrades}
                summary={summary}
                viewMonth={viewMonth}
                onJumpMonth={(year, month) => setViewMonth({ year, month })}
                onOpenSettings={() => setShowSettings(true)}
              />
              <section className="main-col">
                <OnboardingChecklist
                  hasTrades={trades.length > 0}
                  setups={setupNames}
                  onOpenSettings={() => setShowSettings(true)}
                />
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
          ) : view === 'atlas' ? (
            <motion.div
              key="atlas"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <TradeAtlas trades={filteredTrades} summary={summary} onOpenSettings={() => setShowSettings(true)} />
            </motion.div>
          ) : (
            <motion.div
              key="review"
              className="review-page"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <WeeklyReview trades={filteredTrades} />
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

      <AnimatePresence>
        {importSheets && (
          <ImportWizard
            sheets={importSheets}
            onClose={() => setImportSheets(null)}
            onImport={(t) => { handleLoaded(t); setImportSheets(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FaqItem({ q, children }: { q: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item ${open ? 'open' : ''}`}>
      <button className="faq-q" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{q}</span>
        <span className="faq-chevron">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="faq-a">{children}</div>}
    </div>
  );
}
