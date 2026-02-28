import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig,loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
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
            skipWaiting: true,
            clientsClaim: true,
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
        }),
      ],
      define: {
        // Note: GEMINI_API_KEY is used for AI features client-side
        // If this needs to be private, move to server-side proxy
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              // Vendor chunking based on node_modules path
              if (id.includes('node_modules')) {
                // Core React - split react-dom separately (larger)
                if (id.includes('react-dom')) {
                  return 'vendor-react-dom';
                }
                // React Router - loaded with app
                if (id.includes('react-router')) {
                  return 'vendor-router';
                }
                // Core React
                if (id.includes('/react/') || id.includes('/scheduler/')) {
                  return 'vendor-react';
                }
                // Supabase SDK - heavy, load on auth
                if (id.includes('@supabase')) {
                  return 'vendor-supabase';
                }
                // Charts - only needed on dashboard
                if (id.includes('recharts') || id.includes('d3-')) {
                  return 'vendor-charts';
                }
                // Icons - split from main bundle
                if (id.includes('lucide-react')) {
                  return 'vendor-icons';
                }
                // Toast notifications
                if (id.includes('sonner')) {
                  return 'vendor-toast';
                }
                // React Query - loaded with authenticated app
                if (id.includes('@tanstack')) {
                  return 'vendor-query';
                }
                // AI features - loaded only when used
                if (id.includes('@google/genai')) {
                  return 'vendor-genai';
                }
                // Error tracking - lazy loaded
                if (id.includes('@sentry')) {
                  return 'vendor-sentry';
                }
                // Zip utilities - loaded on export
                if (id.includes('jszip')) {
                  return 'vendor-zip';
                }
              }
              // Don't force other node_modules into one chunk - let Vite decide
            }
          }
        },
        // Increase warning threshold since we have proper chunking now
        chunkSizeWarningLimit: 600,
      }
    };
});
