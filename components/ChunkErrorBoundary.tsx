import React, { Component, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

/**
 * Error boundary that catches chunk loading failures (common after deployments)
 * and prompts user to refresh instead of showing a broken page.
 */
class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, isChunkError: false };
  
  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a chunk loading error
    const isChunkError = 
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('Loading CSS chunk') ||
      error.name === 'ChunkLoadError';
    
    return { hasError: true, isChunkError };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  }

  handleRefresh = () => {
    // Clear cache and reload
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.state.isChunkError) {
        // Chunk loading error - show friendly refresh prompt
        return (
          <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
            <div className="bg-[var(--surface)] rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-[var(--text)] mb-2">
                New Version Available
              </h2>
              <p className="text-[var(--text-muted)] mb-6">
                FieldPro has been updated. Please refresh to get the latest version.
              </p>
              <button
                onClick={this.handleRefresh}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Refresh Now
              </button>
              <p className="text-xs text-[var(--text-muted)] mt-4">
                This usually happens after we deploy updates.
              </p>
            </div>
          </div>
        );
      }

      // Generic error - show error message
      return (
        <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-xl font-bold text-[var(--text)] mb-2">
              Something went wrong
            </h2>
            <p className="text-[var(--text-muted)] mb-6">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <button
              onClick={this.handleRefresh}
              className="w-full bg-slate-600 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChunkErrorBoundary;
