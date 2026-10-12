export const UNIT_TEST_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'unit-test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'unit-test-service-role-key',
}

export const DATABASE_WRITE_ACKNOWLEDGEMENT = 'disposable-test-project'

type Environment = Readonly<Record<string, string | undefined>>

export function assertDatabaseTestOptIn(env: Environment): void {
  if (env.CHEMCLICKS_ALLOW_DATABASE_WRITES !== DATABASE_WRITE_ACKNOWLEDGEMENT) {
    throw new Error('Database tests write/delete database and Auth fixtures. Obtain approval for a disposable test project, then set CHEMCLICKS_ALLOW_DATABASE_WRITES=disposable-test-project. See docs/database-testing.md.')
  }
}

function required(env: Environment, name: string): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`Database tests require ${name}; application credentials are never a fallback.`)
  return value
}

/** Host and port, with every loopback name treated as the same machine. */
function target(value: string): string | null {
  try {
    const url = new URL(value)
    const host = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? 'loopback' : url.hostname
    return `${host}:${url.port}`
  } catch {
    return null
  }
}

/** Local checks only: no network access and no assertion that a project is truly disposable. */
export function databaseTestEnvironment(env: Environment, applicationUrls: readonly string[]): Record<string, string> {
  assertDatabaseTestOptIn(env)
  const url = required(env, 'TEST_SUPABASE_URL')
  const anonKey = required(env, 'TEST_SUPABASE_ANON_KEY')
  const serviceKey = required(env, 'TEST_SUPABASE_SERVICE_ROLE_KEY')
  const testTarget = target(url)
  if (testTarget === null) throw new Error('TEST_SUPABASE_URL must be a valid test-project URL.')
  if (applicationUrls.some(applicationUrl => target(applicationUrl) === testTarget)) {
    throw new Error('Refusing database tests against a configured application project. Use a separate disposable project.')
  }
  return {
    NEXT_PUBLIC_SUPABASE_URL: new URL(url).origin,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  }
}
