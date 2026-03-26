import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

const CHUNK_ERROR_KEY = 'chunk_error_reload';

function isChunkLoadError(error: Error): boolean {
  const msg = error.message;
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    (error.name === 'TypeError' && msg.includes('Failed to fetch'))
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);

    // Auto-reload once on chunk load failure (stale deployment)
    if (isChunkLoadError(error)) {
      const lastReload = sessionStorage.getItem(CHUNK_ERROR_KEY);
      if (!lastReload || Date.now() - Number(lastReload) > 10_000) {
        sessionStorage.setItem(CHUNK_ERROR_KEY, String(Date.now()));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: '1rem',
          fontFamily: 'system-ui', color: 'var(--color-text-primary, #333)',
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ color: 'var(--color-text-secondary, #666)' }}>
            Please refresh the page to try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer',
              background: 'var(--color-accent, #3B82F6)', color: 'white',
              border: 'none', fontSize: '0.875rem', fontWeight: 500,
            }}
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
