import { defineConfig } from 'vitest/config'
import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { fileURLToPath, URL } from 'node:url'
import { assertDatabaseTestOptIn, databaseTestEnvironment } from './scripts/test-safety.mts'

// Fail before reading fixture credentials or importing any database test module.
assertDatabaseTestOptIn(process.env)
const root = fileURLToPath(new URL('.', import.meta.url))
function envFile(name: string): Record<string, string | undefined> {
  const path = fileURLToPath(new URL(name, import.meta.url))
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {}
}
const fixtureEnv = { ...envFile('.env.database-test.local'), ...process.env }
// Read only for the denylist; these files never supply database-test credentials.
const applicationUrls = [
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_URL,
  ...['.env', '.env.local', '.env.development', '.env.development.local',
    '.env.production', '.env.production.local', '.env.test', '.env.test.local']
    .flatMap(name => {
      const env = envFile(name)
      return [env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_URL]
    }),
].filter((value): value is string => Boolean(value))
const env = databaseTestEnvironment(fixtureEnv, applicationUrls)

export default defineConfig({
  root,
  envDir: false,
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/database/**/*.test.ts'],
    env,
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
})
