import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// Served from https://guynuri.github.io/onlyLeveling/ (CLAUDE.md "Hosting and auth constraints").
// This is the single place the base path is defined; the SW scope follows from it.
const BASE = '/onlyLeveling/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      // Our own service worker (src/sw.ts): precache plus push alerts (PLAN Phase 9). The plugin injects the precache list.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // autoUpdate: a new build activates on its own. 'prompt' needs an update UI that does not exist yet,
      // and without it an installed iOS app keeps the old build until every copy is closed.
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'onlyLeveling',
        short_name: 'onlyLeveling',
        description: 'Home training coach for adjustable dumbbells',
        theme_color: '#111418',
        background_color: '#111418',
        display: 'standalone',
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'shared/**/*.test.ts'],
    environment: 'node',
  },
});
