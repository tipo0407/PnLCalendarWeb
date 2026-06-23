import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, SlidersHorizontal, Download, Upload, Trash2, ShieldCheck, CloudUpload, CloudDownload } from 'lucide-react';
import type { TradeRecord } from '../types';
import { getSettings, saveSettings, type Settings } from '../lib/settings';
import { exportBackup, restoreBackup, clearAllData, storageUsageMB, buildBackup, mergeBackups, type Backup } from '../lib/backup';
import { getErrors, clearErrors, type LoggedError } from '../lib/logger';
import { setLang, t, type Lang } from '../lib/i18n';
import { useLang } from '../lib/useLang';
import { ACCENTS, getAccentId, setAccent, getHighContrast, setHighContrast } from '../lib/theme';
import AccountSection from './AccountSection';
import TagsManager from './TagsManager';
import SyncConflictModal from './SyncConflictModal';
import { useAccount } from '../lib/useAccount';
import { pullBackup, pushBackup, isRemoteNewer, getLastSynced, markSynced, getAutoSync, setAutoSync } from '../lib/cloudSync';

interface Props {
  onClose: () => void;
  trades: TradeRecord[];
  onReplaceTrades: (trades: TradeRecord[]) => void;
}

const CURRENCIES = ['$', '€', '£', '¥', '₹', 'A$', 'C$'];

export default function SettingsModal({ onClose, trades, onReplaceTrades }: Props) {
  const [s, setS] = useState<Settings>(() => ({ ...getSettings() }));
  const [usage, setUsage] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<LoggedError[]>(() => getErrors());
  const [accent, setAccentId] = useState(() => getAccentId());
  const [contrast, setContrast] = useState(() => getHighContrast());
  const account = useAccount();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [auto, setAuto] = useState(() => getAutoSync());
  const [conflict, setConflict] = useState<{ local: Backup; cloud: Backup; updatedAt: string | null } | null>(null);
  const lang = useLang();

  async function cloudPush() {
    setSyncing(true); setSyncMsg('Checking cloud…');
    try {
      const remote = await pullBackup();
      if (isRemoteNewer(remote.updatedAt) && remote.blob) {
        // Surface a conflict resolver instead of a blunt overwrite.
        setConflict({ local: await buildBackup(trades), cloud: remote.blob, updatedAt: remote.updatedAt });
        setSyncMsg(null); setSyncing(false); return;
      }
      const ts = await pushBackup(await buildBackup(trades));
      setSyncMsg(`Pushed to cloud at ${new Date(ts).toLocaleString()}.`);
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'Push failed.');
    } finally {
      setSyncing(false);
    }
  }

  async function cloudPull() {
    setSyncing(true); setSyncMsg('Pulling…');
    try {
      const { blob, updatedAt } = await pullBackup();
      if (!blob) { setSyncMsg('Nothing stored in the cloud yet.'); setSyncing(false); return; }
      if (trades.length > 0 && isRemoteNewer(updatedAt)) {
        setConflict({ local: await buildBackup(trades), cloud: blob, updatedAt });
        setSyncMsg(null); setSyncing(false); return;
      }
      await applyCloud(blob, updatedAt);
      setSyncMsg(`Pulled ${blob.trades.length} trades from cloud.`);
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'Pull failed.');
    } finally {
      setSyncing(false);
    }
  }

  async function applyCloud(blob: Backup, updatedAt: string | null) {
    const restored = await restoreBackup(JSON.stringify(blob));
    onReplaceTrades(restored);
    setS({ ...getSettings() });
    if (updatedAt) markSynced(updatedAt);
  }

  async function resolveKeepLocal() {
    if (!conflict) return;
    setConflict(null); setSyncing(true);
    try { const ts = await pushBackup(conflict.local); setSyncMsg(`Kept this device; pushed at ${new Date(ts).toLocaleString()}.`); }
    catch (e) { setSyncMsg(e instanceof Error ? e.message : 'Push failed.'); }
    finally { setSyncing(false); }
  }

  async function resolveKeepCloud() {
    if (!conflict) return;
    const c = conflict; setConflict(null); setSyncing(true);
    try { await applyCloud(c.cloud, c.updatedAt); setSyncMsg(`Kept cloud; restored ${c.cloud.trades.length} trades.`); }
    catch (e) { setSyncMsg(e instanceof Error ? e.message : 'Pull failed.'); }
    finally { setSyncing(false); }
  }

  async function resolveMerge() {
    if (!conflict) return;
    const c = conflict; setConflict(null); setSyncing(true);
    try {
      const merged = mergeBackups(c.local, c.cloud);
      await applyCloud(merged, null);
      const ts = await pushBackup(merged);
      setSyncMsg(`Merged into ${merged.trades.length} trades; synced at ${new Date(ts).toLocaleString()}.`);
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'Merge failed.');
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    storageUsageMB().then(setUsage);
  }, []);

  function update(patch: Partial<Settings>) {
    const next = { ...s, ...patch };
    setS(next);
    saveSettings(patch);
  }

  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const restored = await restoreBackup(String(reader.result));
        onReplaceTrades(restored);
        setS({ ...getSettings() });
        setMsg(`Restored ${restored.length} trades from backup.`);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Could not read that backup file.');
      }
    };
    reader.readAsText(file);
  }

  async function onClearAll() {
    if (!window.confirm('Erase all local data (trades, tags, rules, screenshots, settings)? This cannot be undone.')) return;
    await clearAllData();
    onReplaceTrades([]);
    setS({ ...getSettings() });
    setMsg('All local data cleared.');
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
            <h2>{t('settings.title')}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="settings-body">
          <label className="set-row">
            <span className="set-label">{t('settings.language')}<small>UI language</small></span>
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={t('settings.language')}>
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </label>

          <div className="set-row">
            <span className="set-label">Accent<small>Theme highlight color</small></span>
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
            <span className="set-label">High contrast<small>Stronger borders &amp; text</small></span>
            <input
              type="checkbox"
              className="set-checkbox"
              checked={contrast}
              onChange={(e) => { setHighContrast(e.target.checked); setContrast(e.target.checked); }}
            />
          </label>

          <label className="set-row">
            <span className="set-label">{t('settings.currency')}<small>Symbol shown on all amounts</small></span>
            <select value={s.currency} onChange={(e) => update({ currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label className="set-row">
            <span className="set-label">{t('settings.weekStart')}<small>Used for the weekly review</small></span>
            <select value={s.weekStart} onChange={(e) => update({ weekStart: Number(e.target.value) as 0 | 1 })}>
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </select>
          </label>

          <label className="set-row">
            <span className="set-label">{t('settings.accountSize')}<small>Starting balance for drawdown %</small></span>
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
            <span className="set-label">{t('settings.risk')}<small>Used to express results in R-multiples</small></span>
            <div className="set-money">
              <span>{s.currency}</span>
              <input
                type="number" min={0} step={10} value={s.riskPerTrade || ''}
                placeholder="0"
                onChange={(e) => update({ riskPerTrade: Number(e.target.value) || 0 })}
              />
            </div>
          </label>

          <label className="set-row">
            <span className="set-label">{t('settings.goal')}<small>Tracked on the calendar summary</small></span>
            <div className="set-money">
              <span>{s.currency}</span>
              <input
                type="number" min={0} step={100} value={s.monthlyGoal || ''}
                placeholder="0"
                onChange={(e) => update({ monthlyGoal: Number(e.target.value) || 0 })}
              />
            </div>
          </label>
        </div>

        <AccountSection />

        <TagsManager />

        {account && (
          <div className="acct-section sync-section">
            <div className="set-section-head"><CloudUpload size={14} /> Cloud sync</div>
            <p className="set-data-note">
              Back up this profile to your account, or restore it on another device.
              {getLastSynced() && <> Last synced {new Date(getLastSynced()!).toLocaleString()}.</>}
            </p>
            <div className="set-data-actions">
              <button className="set-data-btn" disabled={syncing} onClick={cloudPush}><CloudUpload size={14} /> Push to cloud</button>
              <button className="set-data-btn" disabled={syncing} onClick={cloudPull}><CloudDownload size={14} /> Pull from cloud</button>
            </div>
            <label className="set-toggle" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={auto} onChange={(e) => { setAutoSync(e.target.checked); setAuto(e.target.checked); }} />
              <span><b>Auto-sync</b><small>Push changes to the cloud automatically (debounced).</small></span>
            </label>
            {syncMsg && <div className="set-data-msg">{syncMsg}</div>}
          </div>
        )}

        <div className="settings-data">
          <div className="set-section-head"><ShieldCheck size={14} /> {t('settings.dataPrivacy')}</div>
          <p className="set-data-note">
            Everything is stored locally in your browser{usage != null && <> · using <b>{usage.toFixed(1)} MB</b></>}.
            Back it up or move it to another device with a JSON file.
          </p>
          <div className="set-data-actions">
            <button className="set-data-btn" onClick={() => exportBackup(trades)}>
              <Download size={14} /> {t('settings.exportBackup')}
            </button>
            <label className="set-data-btn">
              <Upload size={14} /> {t('settings.importBackup')}
              <input
                type="file" accept="application/json,.json"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ''; }}
              />
            </label>
            <button className="set-data-btn danger" onClick={onClearAll}>
              <Trash2 size={14} /> {t('settings.clearAll')}
            </button>
          </div>
          {msg && <div className="set-data-msg">{msg}</div>}

          <label className="set-toggle">
            <input
              type="checkbox"
              checked={s.errorLogging}
              onChange={(e) => update({ errorLogging: e.target.checked })}
            />
            <span>
              <b>{t('settings.diagnostics')}</b>
              <small>Record runtime errors locally so you can copy them when reporting a bug. Nothing is ever uploaded.</small>
            </span>
          </label>
          {s.errorLogging && (
            <div className="set-errors">
              <div className="set-errors-head">
                <span>Recent errors ({errors.length})</span>
                {errors.length > 0 && <button onClick={() => { clearErrors(); setErrors([]); }}>Clear</button>}
              </div>
              {errors.length === 0
                ? <div className="set-errors-empty">None recorded. 🎉</div>
                : <ul>{errors.slice(0, 5).map((er, i) => (
                    <li key={i}><span className="se-time">{er.time.slice(5, 16).replace('T', ' ')}</span> {er.message}</li>
                  ))}</ul>}
            </div>
          )}

          <p className="set-privacy">
            <b>Privacy.</b> PnL Calendar is local-first: your trades, notes, screenshots and
            settings live in your browser only. There is no account and no analytics. Importing a
            Google Sheet fetches it through a proxy you control; license checks send only the key
            you enter. Use Export backup to move data between devices.
          </p>
        </div>

        <div className="settings-foot">
          <span className="set-note">{t('settings.savedLocal')}</span>
          <button className="btn btn-upload" onClick={onClose}>{t('settings.done')}</button>
        </div>
      </motion.div>

      {conflict && (
        <SyncConflictModal
          local={conflict.local}
          cloud={conflict.cloud}
          cloudUpdatedAt={conflict.updatedAt}
          onKeepLocal={resolveKeepLocal}
          onKeepCloud={resolveKeepCloud}
          onMerge={resolveMerge}
          onClose={() => setConflict(null)}
        />
      )}
    </motion.div>
  );
}
