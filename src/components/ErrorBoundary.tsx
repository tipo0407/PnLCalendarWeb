import { Component, type ErrorInfo, type ReactNode } from 'react';
import { recordError } from '../lib/logger';

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
      return (
        <div className="crash">
          <div className="crash-card">
            <h2>Something went wrong</h2>
            <p>The app hit an unexpected error. Your data is safe — try reloading.</p>
            <pre className="crash-msg">{this.state.error.message}</pre>
            <div className="crash-actions">
              <button className="btn btn-upload" onClick={() => window.location.reload()}>Reload</button>
              <button
                className="btn"
                onClick={() => {
                  try { localStorage.clear(); } catch { /* ignore */ }
                  window.location.reload();
                }}
              >
                Reset &amp; reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
