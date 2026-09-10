import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The receipt parity test imports the frozen desktop renderer, which
      // lives outside this package and imports React by bare specifier. CI
      // installs dependencies only in web/, so point those at this package's
      // copy (the directory, so react/jsx-runtime still resolves).
      react: fileURLToPath(new URL('./node_modules/react', import.meta.url))
    }
  },
  define: { __APP_VERSION__: JSON.stringify('test') },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false
  }
})
