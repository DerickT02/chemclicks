import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // Never load application .env files for unit/component tests.
  envDir: false,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // Inert values, so no test can reach a real Supabase project.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'unit-test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'unit-test-service-role-key',
    },
    setupFiles: [fileURLToPath(new URL('./tests/setup-unit.ts', import.meta.url))],
    // DOM suites already opt in with @vitest-environment jsdom. SSR tests stay in Node.
    environment: 'node',
    // Every suite runs except the database fixtures, which write to a real project.
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/database/**'],
  },
})
