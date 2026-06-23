import { useEffect, useState } from 'react';
import { ImagePlus, Trash2, Maximize2, Plus } from 'lucide-react';
import type { DailyPnl, TradeRecord } from '../types';
import { formatMoneySigned } from '../lib/metrics';
import { putShot, getShot, delShot, shotKey } from '../lib/screenshots';
import { MISTAKE_TAGS } from '../lib/tags';
import { EMOTIONS } from '../lib/emotions';
import { tradeTagKey, getTradeTags, toggleTag, type TradeTags } from '../lib/userTags';

function hhmm(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface Props {
  daily: DailyPnl;
}

/** Per-trade screenshot attachments, persisted locally in IndexedDB. */
export default function TradeShots({ daily }: Props) {
  const [urls, setUrls] = useState<Record<string, string>>({});

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

  async function attach(t: TradeRecord, file: File) {
    const key = shotKey(daily.date, t.tradeNumber, t.rowNumber);
    await putShot(key, file);
    setUrls((prev) => {
      if (prev[key]) URL.revokeObjectURL(prev[key]);
      return { ...prev, [key]: URL.createObjectURL(file) };
    });
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
    <div className="shots">
      <div className="shots-head">Trades &amp; screenshots</div>
      <div className="shots-grid">
        {daily.trades.map((t) => {
          const key = shotKey(daily.date, t.tradeNumber, t.rowNumber);
          const url = urls[key];
          return (
            <div className="shot-card" key={key}>
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
                  <img src={url} alt={`Trade ${t.tradeNumber} screenshot`} />
                  <div className="shot-actions">
                    <a className="shot-act" href={url} target="_blank" rel="noreferrer" title="Open full size">
                      <Maximize2 size={14} />
                    </a>
                    <button className="shot-act" onClick={() => remove(t)} title="Remove">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="shot-add">
                  <ImagePlus size={16} />
                  <span>Add screenshot</span>
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
              )}
              <TradeTagEditor trade={t} date={daily.date} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MISTAKE_LABEL = new Map(MISTAKE_TAGS.map((m) => [m.key, m.label]));
const EMOTION_LABEL = new Map(EMOTIONS.map((e) => [e.key, e.label]));

/** Toggleable manual mistake/emotion tags for one trade, persisted locally. */
function TradeTagEditor({ trade, date }: { trade: TradeRecord; date: string }) {
  const key = tradeTagKey(date, trade.tradeNumber, trade.rowNumber);
  const [tags, setTags] = useState<TradeTags>(() => getTradeTags(key));
  const [open, setOpen] = useState(false);

  function flip(kind: 'mistake' | 'emotion', tagKey: string) {
    setTags(toggleTag(key, kind, tagKey));
  }

  const hasTags = tags.mistakes.length > 0 || tags.emotions.length > 0;

  return (
    <div className="shot-tags">
      <div className="shot-tag-row">
        {tags.mistakes.map((m) => (
          <button key={`m-${m}`} className="utag mistake" onClick={() => flip('mistake', m)} title="Remove tag">
            {MISTAKE_LABEL.get(m) ?? m}
          </button>
        ))}
        {tags.emotions.map((e) => (
          <button key={`e-${e}`} className="utag emotion" onClick={() => flip('emotion', e)} title="Remove tag">
            {EMOTION_LABEL.get(e) ?? e}
          </button>
        ))}
        <button className={`utag add ${open ? 'on' : ''}`} onClick={() => setOpen((o) => !o)}>
          <Plus size={11} /> {hasTags ? 'Tag' : 'Add tag'}
        </button>
      </div>
      {open && (
        <div className="shot-tag-picker">
          <span className="tag-group-label">Mistakes</span>
          <div className="tag-chips">
            {MISTAKE_TAGS.map((m) => (
              <button
                key={m.key}
                className={`chip ${tags.mistakes.includes(m.key) ? 'on mistake' : ''}`}
                onClick={() => flip('mistake', m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <span className="tag-group-label">Emotions</span>
          <div className="tag-chips">
            {EMOTIONS.map((e) => (
              <button
                key={e.key}
                className={`chip ${tags.emotions.includes(e.key) ? 'on emotion' : ''}`}
                onClick={() => flip('emotion', e.key)}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
