import { motion } from 'framer-motion';
import { AlertTriangle, Laptop, Cloud, Merge } from 'lucide-react';
import type { Backup } from '../lib/backup';
import { useFocusTrap } from '../lib/useFocusTrap';

interface Props {
  local: Backup;
  cloud: Backup;
  cloudUpdatedAt: string | null;
  onKeepLocal: () => void;
  onKeepCloud: () => void;
  onMerge: () => void;
  onClose: () => void;
}

export default function SyncConflictModal({ local, cloud, cloudUpdatedAt, onKeepLocal, onKeepCloud, onMerge, onClose }: Props) {
  const localCount = local.trades.length;
  const cloudCount = cloud.trades.length;
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
        className="conflict-card"
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Sync conflict"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      >
        <div className="conflict-head">
          <AlertTriangle size={18} />
          <h2>Sync conflict</h2>
        </div>
        <p className="conflict-note">
          The cloud copy changed since your last sync. Choose how to resolve it.
        </p>
        <div className="conflict-cols">
          <div className="conflict-col">
            <span className="cc-label"><Laptop size={13} /> This device</span>
            <span className="cc-big">{localCount}</span>
            <span className="cc-sub">trades</span>
          </div>
          <div className="conflict-col">
            <span className="cc-label"><Cloud size={13} /> Cloud</span>
            <span className="cc-big">{cloudCount}</span>
            <span className="cc-sub">{cloudUpdatedAt ? new Date(cloudUpdatedAt).toLocaleString() : 'trades'}</span>
          </div>
        </div>
        <div className="conflict-actions">
          <button className="conflict-btn" onClick={onKeepLocal}><Laptop size={14} /> Keep this device</button>
          <button className="conflict-btn" onClick={onKeepCloud}><Cloud size={14} /> Keep cloud</button>
          <button className="conflict-btn primary" onClick={onMerge}><Merge size={14} /> Merge both</button>
        </div>
        <p className="conflict-foot">Merge keeps every trade from both (de-duplicated) and your local rules &amp; settings.</p>
      </motion.div>
    </motion.div>
  );
}
