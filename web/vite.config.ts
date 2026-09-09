import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import pkg from './package.json' with { type: 'json' }

// base: '/' on app.esamithi.com, '/app/' on the console QA host (VITE_BASE).
// The API and the directory are ALWAYS same-origin at the root (/api/v1,
// /directory/) — never under base — see requirements §6.4.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_BASE || '/'
  const devApi = env.VITE_DEV_API || 'https://console.esamithi.com'
  const pwa = (env.VITE_PWA || 'on') !== 'off'
  return {
    base,
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true, routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts' }),
      react(),
      tailwindcss(),
      VitePWA({
          disable: !pwa,
          registerType: 'prompt',
          includeAssets: ['icons/*.png', 'offline.html', 'boot.js'],
          manifest: {
            id: base,
            name: 'eSamithi',
            short_name: 'eSamithi',
            description: 'eSamithi office application',
            start_url: base,
            scope: base,
            display: 'standalone',
            theme_color: '#1E64D4',
            background_color: '#0F172A',
            lang: 'en',
            categories: ['finance', 'productivity'],
            icons: [
              { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
              { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
            ]
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}'],
            navigateFallback: `${base}index.html`,
            navigateFallbackDenylist: [/^\/api\//, /^\/directory\//],
            cleanupOutdatedCaches: true,
            runtimeCaching: [] // the API is never cached — always network
          },
          devOptions: { enabled: false }
        })
    ],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: devApi, changeOrigin: true, secure: true },
        '/directory': { target: devApi, changeOrigin: true, secure: true }
      }
    },
    build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 600 }
  }
})
