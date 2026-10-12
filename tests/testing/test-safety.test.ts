import { describe, expect, it } from 'vitest'
import config from '../../vitest.config.mts'
import packageJson from '../../package.json'
import { DATABASE_WRITE_ACKNOWLEDGEMENT, UNIT_TEST_ENV, databaseTestEnvironment } from '../../scripts/test-safety.mts'

const fixture = {
  CHEMCLICKS_ALLOW_DATABASE_WRITES: DATABASE_WRITE_ACKNOWLEDGEMENT,
  TEST_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  TEST_SUPABASE_ANON_KEY: 'test-anon-key',
  TEST_SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
}
const environment = (patch: Record<string, string | undefined> = {}, applicationUrls: string[] = []) => databaseTestEnvironment({ ...fixture, ...patch }, applicationUrls)

describe('safe unit-test policy', () => {
  it('disables dotenv loading and runs every suite except the database fixtures', () => {
    expect(config).toMatchObject({
      envDir: false,
      test: { environment: 'node', env: UNIT_TEST_ENV, include: ['tests/**/*.test.{ts,tsx}'], exclude: ['tests/database/**'] },
    })
  })
  it('pins run/watch scripts to the safe config and separates the database runner', () => {
    expect(packageJson.scripts.test).toBe('vitest run --config vitest.config.mts')
    expect(packageJson.scripts['test:watch']).toBe('vitest --config vitest.config.mts')
    expect(packageJson.scripts['test:database']).toBe('vitest run --config vitest.database.config.mts')
  })
  it('replaces inherited application credentials with inert test values', () => {
    for (const [name, value] of Object.entries(UNIT_TEST_ENV)) expect(process.env[name]).toBe(value)
  })
  it('blocks unmocked fetch before it can contact a project', async () => {
    expect(globalThis.fetch.name).toBe('blockedFetch')
    await expect(fetch('http://127.0.0.1:1')).rejects.toThrow('Network fetch is disabled in unit tests')
  })
})

describe('database-test local preflight (no project contacted)', () => {
  it.each([undefined, '', '1', 'true'])('requires the exact write acknowledgement (%s)', value => {
    expect(() => environment({ CHEMCLICKS_ALLOW_DATABASE_WRITES: value })).toThrow('Database tests write/delete')
  })
  it.each(['TEST_SUPABASE_URL', 'TEST_SUPABASE_ANON_KEY', 'TEST_SUPABASE_SERVICE_ROLE_KEY'])('requires dedicated %s, never falling back to application values', name => {
    expect(() => environment({ [name]: undefined, ...UNIT_TEST_ENV })).toThrow(`require ${name}`)
  })
  it('maps only the fixture credentials to the existing test API', () => {
    expect(environment()).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: fixture.TEST_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: fixture.TEST_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: fixture.TEST_SUPABASE_SERVICE_ROLE_KEY,
    })
  })
  it('rejects a target that is not a URL', () => {
    expect(() => environment({ TEST_SUPABASE_URL: 'not-a-url' })).toThrow('valid test-project URL')
  })
  it.each([fixture.TEST_SUPABASE_URL, `${fixture.TEST_SUPABASE_URL}/rest/v1`, `${fixture.TEST_SUPABASE_URL}/`])('rejects the configured application project (%s)', applicationUrl => {
    expect(() => environment({}, [applicationUrl])).toThrow('configured application project')
  })
  it('accepts an unrelated known application project, without using its credentials', () => {
    expect(environment({}, ['https://otherprojectabcdefgh.supabase.co'])).toHaveProperty('NEXT_PUBLIC_SUPABASE_URL', fixture.TEST_SUPABASE_URL)
  })
  it.each(['http://localhost:55421', 'http://[::1]:55421'])('rejects aliases of the same local application project (%s)', applicationUrl => {
    expect(() => environment({ TEST_SUPABASE_URL: 'http://127.0.0.1:55421' }, [applicationUrl])).toThrow('configured application project')
  })
  it('permits a local project on a different port from the application', () => {
    expect(environment({ TEST_SUPABASE_URL: 'http://127.0.0.1:55421' }, ['http://localhost:54321'])).toHaveProperty('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:55421')
  })
})
