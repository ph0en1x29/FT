import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ChunkErrorBoundary from './components/ChunkErrorBoundary';
import './index.css';

// Normalize direct deep-links into hash routes so bookmarked URLs like
// /jobs and /forklifts still land on the correct screen with HashRouter.
if (!window.location.hash && window.location.pathname !== '/') {
  const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const nextUrl = `/#${normalizedPath}${window.location.search}`;
  window.history.replaceState(null, '', nextUrl);
}

// Lazy load error tracking (Sentry) - not needed on initial render
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
      <App />
    </ChunkErrorBoundary>
  </React.StrictMode>
);
