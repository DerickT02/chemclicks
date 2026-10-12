import { describe, expect, it } from 'vitest'
import config from '../../vitest.config.mts'
import packageJson from '../../package.json'
import { DATABASE_WRITE_ACKNOWLEDGEMENT, UNIT_TEST_ENV, databaseTestEnvironment } from '../../scripts/test-safety.mts'

const ref = 'abcdefghijklmnopqrst'
function jwt(role: string, projectRef?: string): string {
  return `header.${Buffer.from(JSON.stringify({ role, ...(projectRef ? { ref: projectRef } : {}) })).toString('base64url')}.signature`
}
const fixture = {
  CHEMCLICKS_ALLOW_DATABASE_WRITES: DATABASE_WRITE_ACKNOWLEDGEMENT,
  TEST_SUPABASE_URL: `https://${ref}.supabase.co`,
  TEST_SUPABASE_PROJECT_REF: ref,
  TEST_SUPABASE_ANON_KEY: jwt('anon', ref),
  TEST_SUPABASE_SERVICE_ROLE_KEY: jwt('service_role', ref),
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
  it.each(['TEST_SUPABASE_URL', 'TEST_SUPABASE_PROJECT_REF', 'TEST_SUPABASE_ANON_KEY', 'TEST_SUPABASE_SERVICE_ROLE_KEY'])('requires dedicated %s, never falling back to application values', name => {
    expect(() => environment({ [name]: undefined, ...UNIT_TEST_ENV })).toThrow(`require ${name}`)
  })
  it('maps only validated fixture credentials to the existing test API', () => {
    expect(environment()).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: fixture.TEST_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: fixture.TEST_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: fixture.TEST_SUPABASE_SERVICE_ROLE_KEY,
    })
  })
  it.each([
    'not-a-url', `http://${ref}.supabase.co`, 'https://example.com',
    `https://${ref}.supabase.co:8080`, `https://${ref}.supabase.co/rest/v1`,
    `https://user:private-password@${ref}.supabase.co`,
    `https://${ref}.supabase.co/?key=private-key`, `https://${ref}.supabase.co/#fragment`,
    'file:///tmp/project', 'https://otherprojectabcdefgh.supabase.co',
  ])('rejects unsafe, mismatched, or non-origin targets (%s)', url => {
    expect(() => environment({ TEST_SUPABASE_URL: url })).toThrow()
  })
  it.each([fixture.TEST_SUPABASE_URL, `${fixture.TEST_SUPABASE_URL}/rest/v1`, `${fixture.TEST_SUPABASE_URL}/`])('rejects the configured application project (%s)', applicationUrl => {
    expect(() => environment({}, [applicationUrl])).toThrow('configured application project')
  })
  it('accepts an unrelated known application project, without using its credentials', () => {
    expect(environment({}, ['https://otherprojectabcdefgh.supabase.co'])).toHaveProperty('NEXT_PUBLIC_SUPABASE_URL', fixture.TEST_SUPABASE_URL)
  })
  it.each(['http://127.0.0.1:55421', 'http://localhost:55421', 'http://[::1]:55421'])('permits an explicitly identified isolated loopback project (%s)', url => {
    expect(environment({ TEST_SUPABASE_URL: url, TEST_SUPABASE_PROJECT_REF: 'local', TEST_SUPABASE_ANON_KEY: jwt('anon'), TEST_SUPABASE_SERVICE_ROLE_KEY: jwt('service_role') })).toHaveProperty('NEXT_PUBLIC_SUPABASE_URL', url)
  })
  it.each(['http://localhost:55421', 'http://[::1]:55421'])('rejects aliases of the same local application project (%s)', applicationUrl => {
    expect(() => environment({ TEST_SUPABASE_URL: 'http://127.0.0.1:55421', TEST_SUPABASE_PROJECT_REF: 'local' }, [applicationUrl])).toThrow('configured application project')
  })
  it('requires the local-project marker on loopback targets', () => {
    expect(() => environment({ TEST_SUPABASE_URL: 'http://localhost:55421' })).toThrow('PROJECT_REF=local')
  })
  it.each([
    { TEST_SUPABASE_ANON_KEY: jwt('service_role', ref) },
    { TEST_SUPABASE_SERVICE_ROLE_KEY: jwt('anon', ref) },
    { TEST_SUPABASE_SERVICE_ROLE_KEY: jwt('service_role', 'different-project') },
    { TEST_SUPABASE_ANON_KEY: 'private-malformed-key' },
    { TEST_SUPABASE_SERVICE_ROLE_KEY: 'header.invalid-json.signature' },
    { TEST_SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_' },
  ])('rejects mismatched roles, project refs and malformed keys without exposing them (%j)', patch => {
    expect(() => environment(patch)).toThrow('key contents are not logged')
    try { environment(patch) } catch (error) {
      expect(String(error)).not.toContain(Object.values(patch)[0])
    }
  })
  it('supports publishable/secret key formats without claiming to verify their project association', () => {
    expect(environment({ TEST_SUPABASE_ANON_KEY: 'sb_publishable_fixture', TEST_SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_fixture' })).toMatchObject({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fixture', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_fixture' })
  })
})
