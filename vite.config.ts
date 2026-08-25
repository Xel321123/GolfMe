import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Vite + Vitest configuration for GolfMe.
 *
 * The test environment defaults to `node` because the domain, storage, and
 * analytics layers are pure TypeScript and must never require a DOM. Files
 * that legitimately need a DOM (React hook tests) opt in per-file with the
 * `@vitest-environment jsdom` pragma.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
})
