import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { version } from './package.json'

// Standalone web build of the desktop renderer for the super-admin support
// workspace (served at /workspace/). Uses a fetch-backed window.api shim +
// impersonation token instead of the Electron IPC bridge.
export default defineConfig({
  root: resolve('src/renderer'),
  base: '/workspace/',
  resolve: { alias: { '@': resolve('src/renderer/src') } },
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  build: {
    outDir: resolve('dist-web'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve('src/renderer/workspace.html')
    }
  }
})
