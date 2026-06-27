import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';

const STEP_DEFS = [
  { selector: '.view-tabs', titleKey: 'tour.views.title', bodyKey: 'tour.views.body' },
  { selector: '.icon-btn', titleKey: 'tour.settings.title', bodyKey: 'tour.settings.body' },
];

interface Props {
  onClose: () => void;
}

/** Lightweight spotlight tour: dims the page and highlights key UI in turn. */
export default function TourOverlay({ onClose }: Props) {
  const lang = useLang();
  const steps = useMemo(
    () => {
      void lang;
      return STEP_DEFS
        .filter((s) => document.querySelector(s.selector))
        .map((s) => ({ selector: s.selector, title: t(s.titleKey), body: t(s.bodyKey) }));
    },
    [lang],
  );
  const [i, setI] = useState(0);
  const [, force] = useState(0);

  useEffect(() => {
    const onResize = () => force((n) => n + 1);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onResize, true); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setI((x) => Math.min(steps.length - 1, x + 1));
      else if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steps.length, onClose]);

  if (steps.length === 0) return null;
  const step = steps[Math.min(i, steps.length - 1)];
  const el = document.querySelector(step.selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const pad = 6;
  const spot = { left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 };

  // Place the tooltip below the target if there's room, else above.
  const below = r.bottom + 150 < window.innerHeight;
  const tipTop = below ? r.bottom + 12 : Math.max(12, r.top - 12 - 132);
  const tipLeft = Math.min(Math.max(12, r.left), window.innerWidth - 312);

  const last = i >= steps.length - 1;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={t('tour.title')}>
      <div className="tour-spot" style={spot} />
      <div className="tour-tip" style={{ top: tipTop, left: tipLeft }}>
        <button className="tour-close" onClick={onClose} aria-label={t('tour.close')}><X size={15} /></button>
        <div className="tour-title">{step.title}</div>
        <div className="tour-body">{step.body}</div>
        <div className="tour-foot">
          <span className="tour-progress">{i + 1} / {steps.length}</span>
          <div className="tour-btns">
            {i > 0 && <button className="tour-btn" onClick={() => setI((x) => x - 1)}>{t('tour.back')}</button>}
            {last
              ? <button className="tour-btn primary" onClick={onClose}>{t('tour.done')}</button>
              : <button className="tour-btn primary" onClick={() => setI((x) => x + 1)}>{t('tour.next')}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
