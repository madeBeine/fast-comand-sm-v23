

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Fix: Use __dirname to avoid property 'cwd' not found error on 'process' type
  const env = loadEnv(mode, __dirname, '');

  // Ensure API_KEY is available even if not prefixed with VITE_
  const apiKey = env.API_KEY || env.VITE_API_KEY || '';

  return {
    plugins: [react()],
    base: '/', 
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey),
      'import.meta.env.VITE_API_KEY': JSON.stringify(apiKey),
      'process.env': env 
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                  return 'react-vendor';
              }
              if (id.includes('supabase')) {
                  return 'supabase-vendor';
              }
              if (id.includes('recharts') || id.includes('lucide')) {
                  return 'ui-vendor';
              }
              return 'vendor';
            }
          }
        }
      }
    }
  };
});
