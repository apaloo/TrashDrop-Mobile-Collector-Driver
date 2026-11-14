import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'dev-dist',
    // Browser-test output (Playwright report and traces)
    'playwright-report',
    'test-results',
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
      // A leading _ marks an unused name on purpose (argument, caught error)
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // A hot-reload hint for development, not a bug
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // Jest tests run in Node with the Jest globals.
    files: ['**/__tests__/**/*.{js,jsx}', '**/*.test.{js,jsx}', 'src/tests/**/*.{js,jsx}', 'src/setupTests.js'],
    languageOptions: { globals: { ...globals.jest, ...globals.node } },
  },
  {
    // Node scripts and tool configuration.
    files: ['scripts/**/*.{js,mjs,cjs}', '.github/scripts/**/*.{js,mjs,cjs}', '*.config.{js,mjs,cjs}', 'netlify/functions/**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
])
