import { useEffect, useState } from 'react';
import { ImagePlus, Trash2, Maximize2, Plus, ClipboardPaste } from 'lucide-react';
import type { DailyPnl, TradeRecord } from '../types';
import { formatMoneySigned } from '../lib/metrics';
import { putShot, getShot, delShot, shotKey } from '../lib/screenshots';
import { allMistakeTags } from '../lib/tags';
import { allEmotions } from '../lib/emotions';
import { tradeTagKey, getTradeTags, toggleTag, type TradeTags } from '../lib/userTags';
import { addCustomTag, removeCustomTag, getCustomTags, CUSTOM_TAGS_EVENT } from '../lib/customTags';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';

function hhmm(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Pull the first image blob out of a clipboard payload, or null. */
async function imageFromClipboard(items?: DataTransferItemList | null): Promise<Blob | null> {
  // Prefer a paste event's items when available (works without permissions).
  if (items) {
    for (const it of Array.from(items)) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) return f;
      }
    }
    return null;
  }
  // Fall back to the async Clipboard API (needs permission + a user gesture).
  try {
    const clip = await navigator.clipboard.read();
    for (const item of clip) {
      const type = item.types.find((ty) => ty.startsWith('image/'));
      if (type) return await item.getType(type);
    }
  } catch {
    /* no permission / not an image */
  }
  return null;
}

interface Props {
  daily: DailyPnl;
}

/** Per-trade screenshot attachments, persisted locally in IndexedDB. */
export default function TradeShots({ daily }: Props) {
  useLang();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [pasteError, setPasteError] = useState('');

  useEffect(() => {
    let revoked = false;
    const created: string[] = [];
    (async () => {
      const next: Record<string, string> = {};
      for (const t of daily.trades) {
        const key = shotKey(daily.date, t.tradeNumber, t.rowNumber);
        const blob = await getShot(key);
        if (blob) {
          const url = URL.createObjectURL(blob);
          created.push(url);
          next[key] = url;
        }
      }
      if (!revoked) setUrls(next);
    })();
    return () => {
      revoked = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [daily.date, daily.trades]);

  async function attach(t: TradeRecord, blob: Blob) {
    const key = shotKey(daily.date, t.tradeNumber, t.rowNumber);
    await putShot(key, blob);
    setUrls((prev) => {
      if (prev[key]) URL.revokeObjectURL(prev[key]);
      return { ...prev, [key]: URL.createObjectURL(blob) };
    });
  }

  /** Paste from the clipboard into a specific trade card (button click). */
  async function pasteInto(t: TradeRecord) {
    setPasteError('');
    const blob = await imageFromClipboard();
    if (blob) await attach(t, blob);
    else setPasteError(t.tradeNumber ? `#${t.tradeNumber}` : '#');
  }

  /** Ctrl/Cmd+V anywhere in the panel: attach to the focused (or first empty) card. */
  async function onPaste(e: React.ClipboardEvent) {
    const blob = await imageFromClipboard(e.clipboardData?.items);
    if (!blob) return;
    e.preventDefault();
    const target =
      daily.trades.find((tr) => shotKey(daily.date, tr.tradeNumber, tr.rowNumber) === focusKey) ||
      daily.trades.find((tr) => !urls[shotKey(daily.date, tr.tradeNumber, tr.rowNumber)]);
    if (target) await attach(target, blob);
  }

  async function remove(t: TradeRecord) {
    const key = shotKey(daily.date, t.tradeNumber, t.rowNumber);
    await delShot(key);
    setUrls((prev) => {
      if (prev[key]) URL.revokeObjectURL(prev[key]);
      const { [key]: _drop, ...rest } = prev;
      void _drop;
      return rest;
    });
  }

  return (
    <div className="shots" onPaste={onPaste}>
      <div className="shots-head">{t('modal.tradesShots')}<span className="shots-hint">{t('shots.pasteHint')}</span></div>
      <div className="shots-grid">
        {daily.trades.map((t) => {
          const key = shotKey(daily.date, t.tradeNumber, t.rowNumber);
          const url = urls[key];
          return (
            <div
              className={`shot-card ${focusKey === key ? 'focused' : ''}`}
              key={key}
              tabIndex={0}
              onFocus={() => setFocusKey(key)}
              onClick={() => setFocusKey(key)}
            >
              <div className="shot-meta">
                <span className="shot-num">#{t.tradeNumber || t.rowNumber}</span>
                <span className="shot-sym">{t.symbol}</span>
                <span className={`shot-pnl ${t.profitLoss >= 0 ? 'pos' : 'neg'}`}>
                  {formatMoneySigned(t.profitLoss)}
                </span>
                {t.entryTime != null && <span className="shot-time">{hhmm(t.entryTime)}</span>}
              </div>
              {url ? (
                <div className="shot-thumb">
                  <img src={url} alt={t2('tt.tradeShotAlt', { n: t.tradeNumber })} />
                  <div className="shot-actions">
                    <a className="shot-act" href={url} target="_blank" rel="noreferrer" title={t2('tt.openFullSize')}>
                      <Maximize2 size={14} />
                    </a>
                    <button className="shot-act" onClick={() => remove(t)} title={t2('tt.remove')}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="shot-add-row">
                  <label className="shot-add">
                    <ImagePlus size={16} />
                    <span>{t2('shots.add')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) attach(t, f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <button className="shot-paste" onClick={() => pasteInto(t)} title={t2('shots.pasteTitle')}>
                    <ClipboardPaste size={15} />
                  </button>
                </div>
              )}
              <TradeTagEditor trade={t} date={daily.date} />
            </div>
          );
        })}
      </div>
      {pasteError && <div className="shots-paste-error">{t('shots.pasteFail')}</div>}
    </div>
  );
}

/** Tiny alias so the per-trade map variable `t` doesn't shadow the i18n `t`. */
const t2 = t;

/** Toggleable manual mistake/emotion tags for one trade, persisted locally. */
function TradeTagEditor({ trade, date }: { trade: TradeRecord; date: string }) {
  const key = tradeTagKey(date, trade.tradeNumber, trade.rowNumber);
  const [tags, setTags] = useState<TradeTags>(() => getTradeTags(key));
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);
  const [newMistake, setNewMistake] = useState('');
  const [newEmotion, setNewEmotion] = useState('');

  useEffect(() => {
    const refresh = () => bump((n) => n + 1);
    window.addEventListener(CUSTOM_TAGS_EVENT, refresh);
    return () => window.removeEventListener(CUSTOM_TAGS_EVENT, refresh);
  }, []);

  const mistakeDefs = allMistakeTags();
  const emotionDefs = allEmotions();
  const mistakeLabel = new Map(mistakeDefs.map((m) => [m.key, translatedLabel('tag', m.key, m.label)]));
  const emotionLabel = new Map(emotionDefs.map((e) => [e.key, translatedLabel('emotion', e.key, e.label)]));
  const customKeys = new Set([...getCustomTags().mistakes, ...getCustomTags().emotions].map((d) => d.key));

  function flip(kind: 'mistake' | 'emotion', tagKey: string) {
    setTags(toggleTag(key, kind, tagKey));
  }

  function translatedLabel(group: 'tag' | 'emotion', key: string, fallback: string): string {
    const dictKey = `${group}.${key}`;
    const translated = t(dictKey);
    return translated === dictKey ? fallback : translated;
  }

  function addCustom(kind: 'mistake' | 'emotion', label: string) {
    if (!label.trim()) return;
    const def = addCustomTag(kind, label);
    setTags(toggleTag(key, kind, def.key));
    if (kind === 'mistake') setNewMistake(''); else setNewEmotion('');
  }

  const hasTags = tags.mistakes.length > 0 || tags.emotions.length > 0;

  return (
    <div className="shot-tags">
      <div className="shot-tag-row">
        {tags.mistakes.map((m) => (
          <button key={`m-${m}`} className="utag mistake" onClick={() => flip('mistake', m)} title={t('shots.removeTag')}>
            {mistakeLabel.get(m) ?? m}
          </button>
        ))}
        {tags.emotions.map((e) => (
          <button key={`e-${e}`} className="utag emotion" onClick={() => flip('emotion', e)} title={t('shots.removeTag')}>
            {emotionLabel.get(e) ?? e}
          </button>
        ))}
        <button className={`utag add ${open ? 'on' : ''}`} onClick={() => setOpen((o) => !o)}>
          <Plus size={11} /> {hasTags ? t('shots.tag') : t('shots.addTag')}
        </button>
      </div>
      {open && (
        <div className="shot-tag-picker">
          <span className="tag-group-label">{t('shots.mistakes')}</span>
          <div className="tag-chips">
            {mistakeDefs.map((m) => (
              <span key={m.key} className="chip-wrap">
                <button
                  className={`chip ${tags.mistakes.includes(m.key) ? 'on mistake' : ''}`}
                  onClick={() => flip('mistake', m.key)}
                >
                  {mistakeLabel.get(m.key) ?? m.label}
                </button>
                {customKeys.has(m.key) && (
                  <button className="chip-del" title={t('shots.deleteCustomTag')} onClick={() => removeCustomTag('mistake', m.key)}>×</button>
                )}
              </span>
            ))}
          </div>
          <div className="tag-add">
            <input
              value={newMistake}
              placeholder={t('shots.customMistake')}
              onChange={(e) => setNewMistake(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCustom('mistake', newMistake); }}
            />
          </div>
          <span className="tag-group-label">{t('shots.emotions')}</span>
          <div className="tag-chips">
            {emotionDefs.map((e) => (
              <span key={e.key} className="chip-wrap">
                <button
                  className={`chip ${tags.emotions.includes(e.key) ? 'on emotion' : ''}`}
                  onClick={() => flip('emotion', e.key)}
                >
                  {emotionLabel.get(e.key) ?? e.label}
                </button>
                {customKeys.has(e.key) && (
                  <button className="chip-del" title={t('shots.deleteCustomTag')} onClick={() => removeCustomTag('emotion', e.key)}>×</button>
                )}
              </span>
            ))}
          </div>
          <div className="tag-add">
            <input
              value={newEmotion}
              placeholder={t('shots.customEmotion')}
              onChange={(e) => setNewEmotion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCustom('emotion', newEmotion); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
