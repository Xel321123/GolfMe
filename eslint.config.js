/**
 * ESLint flat configuration for GolfMe.
 *
 * Enforces the portability contract: modules under src/domain, src/services,
 * src/storage and src/analytics must never import React or touch browser
 * globals (window, document, localStorage, ...) so they can be copied into a
 * React Native codebase verbatim.
 */
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'legacy'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Portability guard: the framework-agnostic core must stay platform-neutral.
    files: [
      'src/domain/**/*.ts',
      'src/services/**/*.ts',
      'src/storage/**/*.ts',
      'src/analytics/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom', 'react/jsx-runtime'],
          patterns: [{ group: ['*/react*'], message: 'Core modules must be platform-agnostic: React imports are not allowed.' }],
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'alert',
        'confirm',
        'prompt',
        'location',
        'history',
      ],
    },
  }
)
