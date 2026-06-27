import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, SlidersHorizontal } from 'lucide-react';
import { setLang, t, type Lang } from '../lib/i18n';
import { useLang } from '../lib/useLang';
import { ACCENTS, getAccentId, setAccent, getHighContrast, setHighContrast } from '../lib/theme';
import { useFocusTrap } from '../lib/useFocusTrap';

interface Props {
  onClose: () => void;
}

/** Minimal appearance settings: language + theme accent + high contrast. */
export default function SettingsModal({ onClose }: Props) {
  const [accent, setAccentId] = useState(() => getAccentId());
  const [contrast, setContrast] = useState(() => getHighContrast());
  const lang = useLang();
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  return (
    <motion.div
      className="modal-overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
    >
      <motion.div
        className="settings-card"
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('settings.title')}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      >
        <div className="iw-head">
          <div className="iw-title">
            <SlidersHorizontal size={18} />
            <h2>{t('settings.title')}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}><X size={18} /></button>
        </div>

        <div className="settings-body">
          <label className="set-row">
            <span className="set-label">{t('settings.language')}<small>{t('settings.uiLanguage')}</small></span>
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={t('settings.language')}>
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </label>

          <div className="set-row">
            <span className="set-label">{t('settings.accent')}<small>{t('settings.accentSub')}</small></span>
            <div className="accent-swatches">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  className={`accent-swatch ${accent === a.id ? 'on' : ''}`}
                  style={{ background: a.id === 'default' ? 'linear-gradient(120deg,#3f6fd8,#5b8def)' : `linear-gradient(120deg,${a.accent},${a.accent2})` }}
                  title={a.name}
                  aria-label={a.name}
                  onClick={() => { setAccent(a.id); setAccentId(a.id); }}
                />
              ))}
            </div>
          </div>

          <label className="set-row">
            <span className="set-label">{t('settings.highContrast')}<small>{t('settings.highContrastSub')}</small></span>
            <input
              type="checkbox"
              className="set-checkbox"
              checked={contrast}
              onChange={(e) => { setHighContrast(e.target.checked); setContrast(e.target.checked); }}
            />
          </label>
        </div>

        <div className="settings-foot">
          <span className="set-note">{t('settings.savedLocal')}</span>
          <button className="btn btn-upload" onClick={onClose}>{t('settings.done')}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
