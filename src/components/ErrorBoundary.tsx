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
    // Log the full error (with stack) and the React component stack to the
    // console, and record them locally when opt-in logging is enabled.
    console.error('PnL Calendar crashed:', error, info.componentStack);
    const detail = [error.stack, info.componentStack].filter(Boolean).join('\n\n');
    recordError(error.message, 'render', detail);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return <CrashScreen message={this.state.error.message} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

function CrashScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  useLang();
  return (
    <div className="crash">
      <div className="crash-card">
        <h2>{t('crash.title')}</h2>
        <p>{t('crash.body')}</p>
        <pre className="crash-msg">{message}</pre>
        <div className="crash-actions">
          <button className="btn btn-upload" onClick={onRetry}>{t('crash.retry')}</button>
          <button className="btn" onClick={() => window.location.reload()}>{t('crash.reload')}</button>
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
