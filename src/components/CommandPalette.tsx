import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Calendar, BarChart3, SlidersHorizontal, SunMoon, CornerDownLeft, Keyboard } from 'lucide-react';
import type { TradeRecord } from '../types';
import { formatMoneySigned, shortDate } from '../lib/metrics';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';

type ViewId = 'calendar' | 'atlas';

interface Props {
  trades: TradeRecord[];
  onClose: () => void;
  onSelectDay: (date: string) => void;
  onSetView: (v: ViewId) => void;
  onOpenSettings: () => void;
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
  trades, onClose, onSelectDay, onSetView, onOpenSettings, onToggleTheme, onShowShortcuts,
}: Props) {
  const lang = useLang();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const actions: Item[] = useMemo(() => [
    void lang,
    { id: 'go-cal', icon: <Calendar size={15} />, label: t('cmd.goCalendar'), group: t('cmd.navigate'), run: () => onSetView('calendar') },
    { id: 'go-atlas', icon: <BarChart3 size={15} />, label: t('cmd.goAtlas'), group: t('cmd.navigate'), run: () => onSetView('atlas') },
    { id: 'settings', icon: <SlidersHorizontal size={15} />, label: t('cmd.openSettings'), group: t('cmd.actions'), run: onOpenSettings },
    { id: 'theme', icon: <SunMoon size={15} />, label: t('cmd.toggleTheme'), group: t('cmd.actions'), run: onToggleTheme },
    { id: 'shortcuts', icon: <Keyboard size={15} />, label: t('cmd.shortcuts'), hint: '?', group: t('cmd.actions'), run: onShowShortcuts },
  ].filter(Boolean) as Item[], [lang, onSetView, onOpenSettings, onToggleTheme, onShowShortcuts]);

  const items: Item[] = useMemo(() => {
    void lang;
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
        .map((trade) => {
          const snippet = (trade.reasonEmotion || trade.note || trade.setup || '').slice(0, 60);
          return {
            id: `trade-${trade.rowNumber}-${trade.date}`,
            icon: <span className={trade.profitLoss >= 0 ? 'cp-pnl pos' : 'cp-pnl neg'}>{formatMoneySigned(trade.profitLoss)}</span>,
            label: `${shortDate(trade.date)} · ${trade.symbol || '—'}${trade.setup ? ` · ${trade.setup}` : ''}`,
            hint: snippet,
            group: t('cmd.trades'),
            run: () => onSelectDay(trade.date),
          } as Item;
        });
    }
    return [...acts, ...tradeItems];
  }, [q, actions, trades, onSelectDay, lang]);

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
      <div className="cp-panel" role="dialog" aria-modal="true" aria-label={t('cmd.title')} onClick={(e) => e.stopPropagation()}>
        <div className="cp-search">
          <Search size={16} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={onKey}
            placeholder={t('cmd.searchPlaceholder')}
            aria-label={t('cmd.searchAria')}
          />
          <kbd className="cp-esc">esc</kbd>
        </div>
        <div className="cp-list">
          {items.length === 0 && <div className="cp-empty">{t('cmd.noMatches')}</div>}
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
