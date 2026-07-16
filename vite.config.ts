import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import rsc from '@vitejs/plugin-rsc';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

const securityHeaders = {
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'SAMEORIGIN',
};

export default defineConfig({
  plugins: [
    tanstackStart({ rsc: { enabled: true } }),
    nitro({
      preset: 'node-server',
      compressPublicAssets: { gzip: true, brotli: true },
      routeRules: {
        '/**': { headers: securityHeaders },
        '/assets/**': {
          headers: { 'cache-control': 'public, max-age=31536000, immutable' },
        },
        '/environments/**': {
          headers: { 'cache-control': 'public, max-age=3600, must-revalidate' },
        },
        '/environments/textures/**': {
          headers: { 'cache-control': 'public, max-age=31536000, immutable' },
        },
        '/fonts/**': {
          headers: { 'cache-control': 'public, max-age=31536000, immutable' },
        },
        '/twemoji/**': {
          headers: { 'cache-control': 'public, max-age=31536000, immutable' },
        },
        '/health': { headers: { 'cache-control': 'no-store' } },
      },
    }),
    rsc(),
    viteReact(),
    tailwindcss(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    sourcemap: false,
    minify: 'oxc',
    chunkSizeWarningLimit: 1024,
  },
});
