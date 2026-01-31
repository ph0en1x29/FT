import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ChunkErrorBoundary from './components/ChunkErrorBoundary';
import { QueryProvider } from './contexts/QueryProvider';

// Lazy load error tracking (Sentry) - not needed on initial render
// This reduces main bundle by ~50KB
if (!import.meta.env.DEV) {
  import('./services/errorTracking').then(({ initErrorTracking }) => {
    initErrorTracking();
  });
}

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
