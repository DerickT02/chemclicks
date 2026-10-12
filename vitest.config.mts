import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'
import { UNIT_TEST_ENV } from './scripts/test-safety.mts'

export default defineConfig({
  // Never load application .env files for unit/component tests.
  envDir: false,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    env: UNIT_TEST_ENV,
    setupFiles: [fileURLToPath(new URL('./tests/setup-unit.ts', import.meta.url))],
    // DOM suites already opt in with @vitest-environment jsdom. SSR tests stay in Node.
    environment: 'node',
    // Every suite runs except the database fixtures, which write to a real project.
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/database/**'],
  },
})
