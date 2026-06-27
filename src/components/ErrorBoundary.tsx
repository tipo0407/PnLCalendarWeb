import { Component, type ErrorInfo, type ReactNode } from 'react';
import { recordError } from '../lib/logger';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Catches render errors so a bad import or chart never white-screens the app. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a breadcrumb in the console; record locally when opt-in logging is on.
    console.error('PnL Calendar crashed:', error, info.componentStack);
    recordError(error.message, 'render');
  }

  render() {
    if (this.state.error) {
      return <CrashScreen message={this.state.error.message} />;
    }
    return this.props.children;
  }
}

function CrashScreen({ message }: { message: string }) {
  useLang();
  return (
    <div className="crash">
      <div className="crash-card">
        <h2>{t('crash.title')}</h2>
        <p>{t('crash.body')}</p>
        <pre className="crash-msg">{message}</pre>
        <div className="crash-actions">
          <button className="btn btn-upload" onClick={() => window.location.reload()}>{t('crash.reload')}</button>
          <button
            className="btn"
            onClick={() => {
              try { localStorage.clear(); } catch { /* ignore */ }
              window.location.reload();
            }}
          >
            {t('crash.resetReload')}
          </button>
        </div>
      </div>
    </div>
  );
}
