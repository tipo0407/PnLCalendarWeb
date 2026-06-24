import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { TradeRecord } from '../types';
import {
  FIELDS, autoMap, guessSheetIndex, headerRowIndex, parseSheet,
  type SheetData, type Mapping, type FieldKey,
} from '../lib/parseWorkbook';
import { BROKER_TEMPLATES, applyTemplate, detectTemplate } from '../lib/brokerTemplates';
import { formatMoneySigned, shortDate } from '../lib/metrics';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';
import { useFocusTrap } from '../lib/useFocusTrap';

interface Props {
  sheets: SheetData[];
  onImport: (trades: TradeRecord[]) => void;
  onClose: () => void;
}

export default function ImportWizard({ sheets, onImport, onClose }: Props) {
  useLang();
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [sheetIdx, setSheetIdx] = useState(() => guessSheetIndex(sheets));
  // 'auto' = alias auto-mapping; otherwise a broker template id.
  const [templateId, setTemplateId] = useState<string>(() => {
    const sheet = sheets[guessSheetIndex(sheets)];
    const hIdx = headerRowIndex(sheet.rows);
    const detected = detectTemplate((sheet.rows[hIdx] ?? []) as unknown[]);
    return detected ? detected.id : 'auto';
  });

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
        ref={trapRef}
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
            <h2>{t('iw.title')}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="iw-selects">
          {sheets.length > 1 && (
            <label className="iw-sheet">
              <span>{t('iw.worksheet')}</span>
              <select value={sheetIdx} onChange={(e) => setSheetIdx(Number(e.target.value))}>
                {sheets.map((s, i) => (
                  <option key={i} value={i}>{s.name || `Sheet ${i + 1}`}</option>
                ))}
              </select>
            </label>
          )}
          <label className="iw-sheet">
            <span>{t('iw.format')}</span>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="auto">{t('iw.autoDetect')}</option>
              {BROKER_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.hint ? ` — ${t.hint}` : ''}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Remounts (and re-detects mapping) whenever the chosen sheet or template changes. */}
        <SheetStep key={`${sheetIdx}:${templateId}`} sheet={sheets[sheetIdx]} templateId={templateId} onImport={onImport} onClose={onClose} />
      </motion.div>
    </motion.div>
  );
}

function SheetStep({ sheet, templateId, onImport, onClose }: { sheet: SheetData; templateId: string; onImport: (t: TradeRecord[]) => void; onClose: () => void }) {
  const hIdx = useMemo(() => headerRowIndex(sheet.rows), [sheet]);
  const headerCells = (sheet.rows[hIdx] ?? []) as unknown[];
  const [mapping, setMapping] = useState<Mapping>(() => {
    if (templateId !== 'auto') {
      const tpl = BROKER_TEMPLATES.find((t) => t.id === templateId);
      if (tpl) return applyTemplate(headerCells, tpl);
    }
    return autoMap(headerCells);
  });

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
          <div className="iw-map-head">{t('iw.mapColumns')}</div>
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
                  <option value={-1}>{t('iw.notSet')}</option>
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
              <b>{result.trades.length}</b> / {result.total} {t('iw.rowsReady')}
              {result.skipped.length > 0 && <> · <b>{result.skipped.length}</b> {t('iw.skipped')}</>}
            </span>
          </div>
          {mapping.date === undefined && (
            <div className="iw-hint">{t('iw.mapDate')}</div>
          )}
          {result.skipped.length > 0 && (
            <div className="iw-skips">
              {result.skipped.slice(0, 4).map((s, i) => (
                <div key={i}>Row {s.row}: {s.reason}</div>
              ))}
              {result.skipped.length > 4 && <div>…and {result.skipped.length - 4} more</div>}
            </div>
          )}

          <div className="iw-preview-head">{t('iw.preview')}</div>
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
        <button className="btn iw-cancel" onClick={onClose}>{t('iw.cancel')}</button>
        <button
          className="btn btn-upload iw-import"
          disabled={!canImport}
          onClick={() => onImport(result.trades)}
        >
          {t('iw.import')} {result.trades.length} {t('iw.tradesWord')}
        </button>
      </div>
    </>
  );
}
