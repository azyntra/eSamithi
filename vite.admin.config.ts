import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Super-admin operator console (admin-web, requirements doc §4.1): a standalone
// React SPA served at /admin/, reusing the desktop app's design tokens.
export default defineConfig({
  root: resolve('src/admin'),
  base: '/admin/',
  resolve: { alias: { '@': resolve('src/renderer/src') } },
  plugins: [react()],
  build: {
    outDir: resolve('dist-admin'),
    emptyOutDir: true,
    rollupOptions: { input: resolve('src/admin/index.html') }
  }
})
