import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { TradeRecord } from '../types';
import {
  FIELDS, autoMap, guessSheetIndex, headerRowIndex, parseSheet,
  type SheetData, type Mapping, type FieldKey,
} from '../lib/parseWorkbook';
import { formatMoneySigned, shortDate } from '../lib/metrics';

interface Props {
  sheets: SheetData[];
  onImport: (trades: TradeRecord[]) => void;
  onClose: () => void;
}

export default function ImportWizard({ sheets, onImport, onClose }: Props) {
  const [sheetIdx, setSheetIdx] = useState(() => guessSheetIndex(sheets));

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
        className="import-card"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      >
        <div className="iw-head">
          <div className="iw-title">
            <FileSpreadsheet size={18} />
            <h2>Import trades</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {sheets.length > 1 && (
          <label className="iw-sheet">
            <span>Worksheet</span>
            <select value={sheetIdx} onChange={(e) => setSheetIdx(Number(e.target.value))}>
              {sheets.map((s, i) => (
                <option key={i} value={i}>{s.name || `Sheet ${i + 1}`}</option>
              ))}
            </select>
          </label>
        )}

        {/* Remounts (and re-detects mapping) whenever the chosen sheet changes. */}
        <SheetStep key={sheetIdx} sheet={sheets[sheetIdx]} onImport={onImport} onClose={onClose} />
      </motion.div>
    </motion.div>
  );
}

function SheetStep({ sheet, onImport, onClose }: { sheet: SheetData; onImport: (t: TradeRecord[]) => void; onClose: () => void }) {
  const hIdx = useMemo(() => headerRowIndex(sheet.rows), [sheet]);
  const headerCells = (sheet.rows[hIdx] ?? []) as unknown[];
  const [mapping, setMapping] = useState<Mapping>(() => autoMap(headerCells));

  const result = useMemo(() => parseSheet(sheet, mapping), [sheet, mapping]);
  const canImport = mapping.date !== undefined && result.trades.length > 0;

  const options = headerCells.map((c, i) => ({ i, label: String(c ?? '').trim() || `Column ${i + 1}` }));

  function setField(key: FieldKey, idx: number) {
    setMapping((m) => {
      const next = { ...m };
      if (idx < 0) delete next[key];
      else next[key] = idx;
      return next;
    });
  }

  return (
    <>
      <div className="iw-body">
        <div className="iw-map">
          <div className="iw-map-head">Map your columns</div>
          <div className="iw-grid">
            {FIELDS.map((f) => (
              <div className="iw-row" key={f.key}>
                <span className="iw-field">
                  {f.label}{f.required && <span className="iw-req"> *</span>}
                </span>
                <select
                  className="iw-select"
                  value={mapping[f.key] ?? -1}
                  onChange={(e) => setField(f.key, Number(e.target.value))}
                >
                  <option value={-1}>— not set —</option>
                  {options.map((o) => (
                    <option key={o.i} value={o.i}>{o.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="iw-preview">
          <div className={`iw-report ${result.skipped.length ? 'warn' : 'ok'}`}>
            {result.skipped.length === 0 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>
              <b>{result.trades.length}</b> of {result.total} rows ready
              {result.skipped.length > 0 && <> · <b>{result.skipped.length}</b> skipped</>}
            </span>
          </div>
          {mapping.date === undefined && (
            <div className="iw-hint">Map a <b>Date</b> column to continue.</div>
          )}
          {result.skipped.length > 0 && (
            <div className="iw-skips">
              {result.skipped.slice(0, 4).map((s, i) => (
                <div key={i}>Row {s.row}: {s.reason}</div>
              ))}
              {result.skipped.length > 4 && <div>…and {result.skipped.length - 4} more</div>}
            </div>
          )}

          <div className="iw-preview-head">Preview</div>
          <div className="iw-table-wrap">
            <table className="iw-table">
              <thead>
                <tr><th>Date</th><th>Symbol</th><th>Side</th><th>P&amp;L</th></tr>
              </thead>
              <tbody>
                {result.trades.slice(0, 7).map((t, i) => (
                  <tr key={i}>
                    <td>{shortDate(t.date)}</td>
                    <td>{t.symbol || '—'}</td>
                    <td>{t.direction || '—'}</td>
                    <td className={t.profitLoss >= 0 ? 'pos' : 'neg'}>{formatMoneySigned(t.profitLoss)}</td>
                  </tr>
                ))}
                {result.trades.length === 0 && (
                  <tr><td colSpan={4} className="iw-empty">No rows parsed yet — check your mapping.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="iw-foot">
        <button className="btn iw-cancel" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-upload iw-import"
          disabled={!canImport}
          onClick={() => onImport(result.trades)}
        >
          Import {result.trades.length} trades
        </button>
      </div>
    </>
  );
}
