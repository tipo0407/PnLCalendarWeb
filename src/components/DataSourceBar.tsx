import { useRef, useState } from 'react';
import { Link2, RefreshCw, Upload, Sparkles } from 'lucide-react';
import type { TradeRecord } from '../types';
import { parseWorkbook, fetchGoogleSheet } from '../lib/parseWorkbook';

interface Props {
  onLoaded: (trades: TradeRecord[]) => void;
  storageKey: string;
  onSample?: () => void;
}

export default function DataSourceBar({ onLoaded, storageKey, onSample }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState<string>(() => localStorage.getItem(storageKey) ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      onLoaded(parseWorkbook(buf));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    if (!link.trim()) {
      setError('Paste a Google Sheet link first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const trades = await fetchGoogleSheet(link);
      localStorage.setItem(storageKey, link.trim());
      onLoaded(trades);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="data-source">
      <div className="ds-row">
        <div className="ds-input-wrap">
          <span className="ds-input-icon"><Link2 size={15} /></span>
          <input
            className="ds-input"
            type="text"
            placeholder="Paste Google Sheet link…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSync()}
          />
        </div>
        <button className="btn btn-sync" onClick={handleSync} disabled={busy}>
          <RefreshCw size={15} className={busy ? 'spin' : ''} />
          {busy ? 'Loading…' : 'Sync'}
        </button>
        <button
          className="btn btn-upload"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <Upload size={15} />
          Upload .xlsx
        </button>
        {onSample && (
          <button className="btn btn-ghost-sample" onClick={onSample} disabled={busy} title="Load sample data">
            <Sparkles size={15} />
            Sample
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
      </div>
      {error && <div className="ds-error">{error}</div>}
    </div>
  );
}
