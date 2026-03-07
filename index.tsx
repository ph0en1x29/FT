import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ChunkErrorBoundary from './components/ChunkErrorBoundary';
import './index.css';

// Lazy load error tracking (Sentry) - not needed on initial render
if (!import.meta.env.DEV) {
  import('./services/errorTracking').then(({ initErrorTracking }) => {
    initErrorTracking();
  });
}

// HashRouter deep-link normalization: redirect /jobs → /#/jobs
// Bookmarked or shared URLs without the hash prefix won't match HashRouter routes
const { pathname } = window.location;
if (pathname !== '/' && !pathname.startsWith('/#')) {
  const hash = `#${pathname}${window.location.search}`;
  window.history.replaceState(null, '', `/${hash}`);
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
