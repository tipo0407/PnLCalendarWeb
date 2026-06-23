import { useRef, useState } from 'react';
import { Link2, RefreshCw, Upload, Sparkles } from 'lucide-react';
import type { SheetData } from '../lib/parseWorkbook';
import { readSheets, fetchGoogleSheetBuffer } from '../lib/parseWorkbook';

interface Props {
  onSheets: (sheets: SheetData[]) => void;
  storageKey: string;
  onSample?: () => void;
}

export default function DataSourceBar({ onSheets, storageKey, onSample }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState<string>(() => localStorage.getItem(storageKey) ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const sheets = readSheets(buf);
      if (sheets.length === 0) throw new Error('That file has no readable sheets.');
      onSheets(sheets);
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
      const buf = await fetchGoogleSheetBuffer(link);
      const sheets = readSheets(buf);
      localStorage.setItem(storageKey, link.trim());
      onSheets(sheets);
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
          Upload
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
          accept=".xlsx,.xls,.csv"
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
