import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { version } from './package.json'

// Two main processes share this repo. index.ts is the full office application
// (the 1.3.x line the office runs today). shell.ts is the Phase 5 thin shell
// that loads app.esamithi.com; it is built only when asked for, and shipped
// only when the pilot says so:  ESAMITHI_SHELL=1 npm run build
const mainEntry = process.env.ESAMITHI_SHELL === '1' ? 'src/main/shell.ts' : 'src/main/index.ts'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(mainEntry) },
        external: ['better-sqlite3']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    define: {
      __APP_VERSION__: JSON.stringify(version)
    },
    plugins: [react()]
  }
})
