import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { TradeRecord } from '../types';
import {
  FIELDS, autoMap, guessSheetIndex, headerRowIndex, parseSheet,
  type SheetData, type Mapping, type FieldKey,
} from '../lib/parseWorkbook';
import { BROKER_TEMPLATES, applyTemplate, detectTemplate } from '../lib/brokerTemplates';
import { dataHealth } from '../lib/dataHealth';
import { formatMoneySigned, shortDate } from '../lib/metrics';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';
import { useFocusTrap } from '../lib/useFocusTrap';

interface Props {
  sheets: SheetData[];
  onImport: (trades: TradeRecord[], mode: 'replace' | 'append') => void;
  onClose: () => void;
  existingCount?: number;
}

export default function ImportWizard({ sheets, onImport, onClose, existingCount = 0 }: Props) {
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
        aria-labelledby="iw-title-heading"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      >
        <div className="iw-head">
          <div className="iw-title">
            <FileSpreadsheet size={18} />
            <h2 id="iw-title-heading">{t('iw.title')}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}><X size={18} /></button>
        </div>

        <div className="iw-selects">
          {sheets.length > 1 && (
            <label className="iw-sheet">
              <span>{t('iw.worksheet')}</span>
              <select value={sheetIdx} onChange={(e) => setSheetIdx(Number(e.target.value))}>
                {sheets.map((s, i) => (
                  <option key={i} value={i}>{s.name || t('iw.sheetN', { n: i + 1 })}</option>
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
        <SheetStep key={`${sheetIdx}:${templateId}`} sheet={sheets[sheetIdx]} templateId={templateId} onImport={onImport} onClose={onClose} existingCount={existingCount} />
      </motion.div>
    </motion.div>
  );
}

function SheetStep({ sheet, templateId, onImport, onClose, existingCount }: { sheet: SheetData; templateId: string; onImport: (t: TradeRecord[], mode: 'replace' | 'append') => void; onClose: () => void; existingCount: number }) {
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
  const health = useMemo(() => dataHealth(result.trades), [result.trades]);
  const canImport = mapping.date !== undefined && result.trades.length > 0;

  const options = headerCells.map((c, i) => ({ i, label: String(c ?? '').trim() || t('iw.columnN', { n: i + 1 }) }));

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
                  {t(`iw.field.${f.key}`)}{f.required && <span className="iw-req"> *</span>}
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
                <div key={i}>{t('iw.rowSkip', { row: s.row, reason: s.reason })}</div>
              ))}
              {result.skipped.length > 4 && <div>{t('iw.andMore', { n: result.skipped.length - 4 })}</div>}
            </div>
          )}

          {result.trades.length > 0 && (
            <div className="iw-health">
              <div className="iwh-row">
                <span className="iwh-label">{t('iwh.range')}</span>
                <span className="iwh-val">{health.start ? `${shortDate(health.start)} – ${shortDate(health.end!)}` : '—'}</span>
              </div>
              <div className="iwh-row">
                <span className="iwh-label">{t('iwh.symbols')}</span>
                <span className="iwh-val">{health.symbols}</span>
                {health.duplicates > 0 && <span className="iwh-dup">{health.duplicates} {t('iwh.dupes')}</span>}
              </div>
              <div className="iwh-cov">
                <Cov label={t('iwh.symbol')} v={health.coverage.symbol} />
                <Cov label={t('iwh.side')} v={health.coverage.direction} />
                <Cov label={t('iwh.time')} v={health.coverage.entryTime} />
                <Cov label={t('iwh.setup')} v={health.coverage.setup} />
              </div>
            </div>
          )}

          <div className="iw-preview-head">{t('iw.preview')}</div>
          <div className="iw-table-wrap">
            <table className="iw-table">
              <thead>
                <tr><th>{t('tt.date')}</th><th>{t('tt.symbol')}</th><th>{t('tt.side')}</th><th>{t('tt.pnl')}</th></tr>
              </thead>
              <tbody>
                {result.trades.slice(0, 7).map((t, i) => (
                  <tr key={i}>
                    <td>{shortDate(t.date)}</td>
                    <td>{t.symbol || '—'}</td>
                    <td>{formatSide(t.direction)}</td>
                    <td className={t.profitLoss >= 0 ? 'pos' : 'neg'}>{formatMoneySigned(t.profitLoss)}</td>
                  </tr>
                ))}
                {result.trades.length === 0 && (
                  <tr><td colSpan={4} className="iw-empty">{t('iw.noRows')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="iw-foot">
        <button className="btn iw-cancel" onClick={onClose}>{t('iw.cancel')}</button>
        {existingCount > 0 && (
          <button
            className="btn iw-append"
            disabled={!canImport}
            onClick={() => onImport(result.trades, 'append')}
            title={t('iw.appendTitle')}
          >
            {t('iw.append')} ({existingCount})
          </button>
        )}
        <button
          className="btn btn-upload iw-import"
          disabled={!canImport}
          onClick={() => onImport(result.trades, 'replace')}
        >
          {existingCount > 0 ? t('iw.replace') : t('iw.import')} {result.trades.length} {t('iw.tradesWord')}
        </button>
      </div>
    </>
  );
}

/** A compact field-coverage meter (label + percentage bar). */
function Cov({ label, v }: { label: string; v: number }) {
  const pct = Math.round(v * 100);
  const cls = pct >= 80 ? 'ok' : pct >= 40 ? 'mid' : 'low';
  return (
    <div className="iwh-cov-item" title={`${pct}%`}>
      <span className="iwh-cov-label">{label}</span>
      <span className="iwh-cov-bar"><span className={`iwh-cov-fill ${cls}`} style={{ width: `${pct}%` }} /></span>
      <span className="iwh-cov-pct">{pct}%</span>
    </div>
  );
}

function formatSide(side: string): string {
  if (!side) return '—';
  if (/short|sell|空/i.test(side)) return t('tt.short');
  if (/long|buy|多/i.test(side)) return t('tt.long');
  return side;
}
