import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Calendar, BarChart3, ClipboardList, SlidersHorizontal, Sparkles, SunMoon, CornerDownLeft, LayoutDashboard, Keyboard } from 'lucide-react';
import type { TradeRecord } from '../types';
import { formatMoneySigned, shortDate } from '../lib/metrics';

type ViewId = 'home' | 'calendar' | 'atlas' | 'review';

interface Props {
  trades: TradeRecord[];
  onClose: () => void;
  onSelectDay: (date: string) => void;
  onSetView: (v: ViewId) => void;
  onOpenSettings: () => void;
  onOpenPricing: () => void;
  onToggleTheme: () => void;
  onShowShortcuts: () => void;
}

interface Item {
  id: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
}

export default function CommandPalette({
  trades, onClose, onSelectDay, onSetView, onOpenSettings, onOpenPricing, onToggleTheme, onShowShortcuts,
}: Props) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const actions: Item[] = useMemo(() => [
    { id: 'go-home', icon: <LayoutDashboard size={15} />, label: 'Go to Home', group: 'Navigate', run: () => onSetView('home') },
    { id: 'go-cal', icon: <Calendar size={15} />, label: 'Go to Calendar', group: 'Navigate', run: () => onSetView('calendar') },
    { id: 'go-atlas', icon: <BarChart3 size={15} />, label: 'Go to Trade Atlas', group: 'Navigate', run: () => onSetView('atlas') },
    { id: 'go-review', icon: <ClipboardList size={15} />, label: 'Go to Weekly Review', group: 'Navigate', run: () => onSetView('review') },
    { id: 'settings', icon: <SlidersHorizontal size={15} />, label: 'Open Settings', group: 'Actions', run: onOpenSettings },
    { id: 'pricing', icon: <Sparkles size={15} />, label: 'Plans & pricing', group: 'Actions', run: onOpenPricing },
    { id: 'theme', icon: <SunMoon size={15} />, label: 'Toggle light / dark theme', group: 'Actions', run: onToggleTheme },
    { id: 'shortcuts', icon: <Keyboard size={15} />, label: 'Keyboard shortcuts', hint: '?', group: 'Actions', run: onShowShortcuts },
  ], [onSetView, onOpenSettings, onOpenPricing, onToggleTheme, onShowShortcuts]);

  const items: Item[] = useMemo(() => {
    const query = q.trim().toLowerCase();
    const acts = query
      ? actions.filter((a) => a.label.toLowerCase().includes(query))
      : actions;

    let tradeItems: Item[] = [];
    if (query.length >= 2) {
      tradeItems = trades
        .filter((t) =>
          `${t.symbol} ${t.setup} ${t.reasonEmotion} ${t.note} ${t.date} ${t.direction}`
            .toLowerCase()
            .includes(query),
        )
        .slice(0, 8)
        .map((t) => {
          const snippet = (t.reasonEmotion || t.note || t.setup || '').slice(0, 60);
          return {
            id: `trade-${t.rowNumber}-${t.date}`,
            icon: <span className={t.profitLoss >= 0 ? 'cp-pnl pos' : 'cp-pnl neg'}>{formatMoneySigned(t.profitLoss)}</span>,
            label: `${shortDate(t.date)} · ${t.symbol || '—'}${t.setup ? ` · ${t.setup}` : ''}`,
            hint: snippet,
            group: 'Trades',
            run: () => onSelectDay(t.date),
          } as Item;
        });
    }
    return [...acts, ...tradeItems];
  }, [q, actions, trades, onSelectDay]);

  function choose(item: Item | undefined) {
    if (!item) return;
    item.run();
    onClose();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(items[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  }

  let lastGroup = '';

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-panel" role="dialog" aria-modal="true" aria-label="Command palette" onClick={(e) => e.stopPropagation()}>
        <div className="cp-search">
          <Search size={16} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={onKey}
            placeholder="Search trades, notes, setups, or jump to…"
            aria-label="Command palette search"
          />
          <kbd className="cp-esc">esc</kbd>
        </div>
        <div className="cp-list">
          {items.length === 0 && <div className="cp-empty">No matches.</div>}
          {items.map((item, i) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <div key={item.id}>
                {showGroup && <div className="cp-group">{item.group}</div>}
                <button
                  className={`cp-item ${i === active ? 'active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(item)}
                >
                  <span className="cp-icon">{item.icon}</span>
                  <span className="cp-label">{item.label}</span>
                  {item.hint && <span className="cp-hint">{item.hint}</span>}
                  {i === active && <CornerDownLeft size={13} className="cp-enter" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
