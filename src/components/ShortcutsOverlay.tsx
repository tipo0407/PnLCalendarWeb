import { useEffect, useRef } from 'react';
import { Keyboard, X } from 'lucide-react';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';

interface Props {
  onClose: () => void;
}

interface Row {
  keys: string[];
  label: string;
}

/**
 * Keyboard-shortcuts cheat sheet (opened with `?`). Implements a minimal focus
 * trap: focus moves into the dialog on open, Tab/Shift+Tab cycle within it, and
 * Escape closes — so keyboard users are never stranded behind the modal.
 */
export default function ShortcutsOverlay({ onClose }: Props) {
  useLang();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: t('sc.navigate'),
      rows: [
        { keys: ['2'], label: t('sc.calendar') },
        { keys: ['3'], label: t('sc.atlas') },
        { keys: ['←', '→', '↑', '↓'], label: t('sc.arrows') },
      ],
    },
    {
      title: t('sc.actions'),
      rows: [
        { keys: ['⌘', 'K'], label: t('sc.palette') },
        { keys: ['T'], label: t('sc.theme') },
        { keys: [','], label: t('sc.settings') },
        { keys: ['?'], label: t('sc.help') },
        { keys: ['Esc'], label: t('sc.close') },
      ],
    },
  ];

  return (
    <div className="sc-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="sc-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('sc.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sc-head">
          <span className="sc-head-title"><Keyboard size={16} /> {t('sc.title')}</span>
          <button ref={closeRef} className="sc-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>
        <div className="sc-grid">
          {groups.map((g) => (
            <div key={g.title} className="sc-group">
              <div className="sc-group-title">{g.title}</div>
              {g.rows.map((r) => (
                <div key={r.label} className="sc-row">
                  <span className="sc-keys">
                    {r.keys.map((k) => <kbd key={k} className="sc-kbd">{k}</kbd>)}
                  </span>
                  <span className="sc-label">{r.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
