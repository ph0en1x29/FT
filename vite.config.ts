import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
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
            manualChunks: {
              // Core React/Router - loaded immediately
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],
              // Supabase - loaded with first auth check
              'vendor-supabase': ['@supabase/supabase-js'],
              // Charts - loaded when dashboard renders
              'vendor-charts': ['recharts'],
              // UI utilities - loaded as needed
              'vendor-ui': ['sonner', 'lucide-react'],
            }
          }
        },
        // Increase warning threshold since we have proper chunking now
        chunkSizeWarningLimit: 600,
      }
    };
});
