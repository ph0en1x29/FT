import { VitePWA } from 'vite-plugin-pwa';

export default VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico'],
  manifest: {
    name: 'FieldPro',
    short_name: 'FieldPro',
    theme_color: '#2563eb',
    background_color: '#ffffff',
    display: 'standalone',
    start_url: '/',
    icons: [
      { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  workbox: {
    runtimeCaching: [
      {
        urlPattern: /supabase\.co/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: { maxAgeSeconds: 86400 },
        },
      },
      {
        urlPattern: /\.(js|css|woff2)/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-cache',
          expiration: { maxAgeSeconds: 2592000 },
        },
      },
    ],
  },
});
