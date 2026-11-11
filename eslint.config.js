import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'dev-dist',
    // End-to-end specs and the legacy local webhook server have their own
    // runtimes; they are tracked for clean-up in the engineering handbook.
    'cypress',
    'backend_webhooks',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Jest tests run in Node with the Jest globals.
    files: ['**/__tests__/**/*.{js,jsx}', '**/*.test.{js,jsx}', 'src/tests/**/*.{js,jsx}', 'src/setupTests.js'],
    languageOptions: { globals: { ...globals.jest, ...globals.node } },
  },
  {
    // Node scripts and tool configuration.
    files: ['scripts/**/*.{js,mjs,cjs}', '*.config.{js,mjs,cjs}', 'netlify/functions/**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
])
