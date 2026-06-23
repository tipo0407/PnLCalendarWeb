import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, SlidersHorizontal } from 'lucide-react';
import { getSettings, saveSettings, type Settings } from '../lib/settings';

interface Props {
  onClose: () => void;
}

const CURRENCIES = ['$', '€', '£', '¥', '₹', 'A$', 'C$'];

export default function SettingsModal({ onClose }: Props) {
  const [s, setS] = useState<Settings>(() => ({ ...getSettings() }));

  function update(patch: Partial<Settings>) {
    const next = { ...s, ...patch };
    setS(next);
    saveSettings(patch);
  }

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
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      >
        <div className="iw-head">
          <div className="iw-title">
            <SlidersHorizontal size={18} />
            <h2>Settings</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="settings-body">
          <label className="set-row">
            <span className="set-label">Currency<small>Symbol shown on all amounts</small></span>
            <select value={s.currency} onChange={(e) => update({ currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label className="set-row">
            <span className="set-label">Week starts on<small>Used for the weekly review</small></span>
            <select value={s.weekStart} onChange={(e) => update({ weekStart: Number(e.target.value) as 0 | 1 })}>
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </select>
          </label>

          <label className="set-row">
            <span className="set-label">Account size<small>Starting balance for drawdown %</small></span>
            <div className="set-money">
              <span>{s.currency}</span>
              <input
                type="number" min={0} step={100} value={s.accountSize || ''}
                placeholder="0"
                onChange={(e) => update({ accountSize: Number(e.target.value) || 0 })}
              />
            </div>
          </label>

          <label className="set-row">
            <span className="set-label">Risk per trade<small>Used to express results in R-multiples</small></span>
            <div className="set-money">
              <span>{s.currency}</span>
              <input
                type="number" min={0} step={10} value={s.riskPerTrade || ''}
                placeholder="0"
                onChange={(e) => update({ riskPerTrade: Number(e.target.value) || 0 })}
              />
            </div>
          </label>
        </div>

        <div className="settings-foot">
          <span className="set-note">Saved locally on this device.</span>
          <button className="btn btn-upload" onClick={onClose}>Done</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
