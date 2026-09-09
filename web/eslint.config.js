import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'src/routeTree.gen.ts', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { window: 'readonly', document: 'readonly', localStorage: 'readonly', navigator: 'readonly', fetch: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', BroadcastChannel: 'readonly', atob: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', Headers: 'readonly', FormData: 'readonly', Response: 'readonly', RequestInfo: 'readonly', RequestInit: 'readonly', HTMLElement: 'readonly', MessageEvent: 'readonly', __APP_VERSION__: 'readonly' } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  }
)
