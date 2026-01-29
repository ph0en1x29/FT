import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ChunkErrorBoundary from './components/ChunkErrorBoundary';
import { QueryProvider } from './contexts/QueryProvider';
import { initErrorTracking } from './services/errorTracking';

// Initialize error tracking (Sentry)
initErrorTracking();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ChunkErrorBoundary>
      <QueryProvider>
        <App />
      </QueryProvider>
    </ChunkErrorBoundary>
  </React.StrictMode>
);
