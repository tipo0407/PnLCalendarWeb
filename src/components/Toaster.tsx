import { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { subscribeToasts, dismissToast, type Toast } from '../lib/toast';
import { t } from '../lib/i18n';

const ICONS = {
  success: <CheckCircle2 size={16} />,
  error: <AlertTriangle size={16} />,
  info: <Info size={16} />,
};

/** Renders the stack of active toasts. Mount once near the app root. */
export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;
  return (
    <div className="toaster" role="region" aria-label={t('toast.region')}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.kind}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
        >
          <span className="toast-icon">{ICONS[toast.kind]}</span>
          <span className="toast-msg">{toast.message}</span>
          <button className="toast-close" onClick={() => dismissToast(toast.id)} aria-label={t('common.close')}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
