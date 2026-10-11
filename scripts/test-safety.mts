export const UNIT_TEST_DIRECTORIES = [
  'auth', 'assignments', 'bohr', 'chemistry', 'classes', 'measurement', 'quiz', 'routes', 'testing', 'ui',
] as const

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

function isLoopback(url: URL): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
}

function targetIdentity(url: URL): string {
  return isLoopback(url) ? `loopback:${url.port || (url.protocol === 'https:' ? '443' : '80')}` : url.hostname
}

function validateKey(key: string, role: 'anon' | 'service_role', projectRef: string): void {
  const prefix = role === 'anon' ? 'sb_publishable_' : 'sb_secret_'
  if (key.startsWith(prefix) && key.length > prefix.length) return
  try {
    const parts = key.split('.')
    if (parts.length !== 3) throw new Error()
    const payload: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (!payload || typeof payload !== 'object' || !('role' in payload) || payload.role !== role) throw new Error()
    if ('ref' in payload && payload.ref !== projectRef) throw new Error()
  } catch {
    throw new Error(`Database tests require a ${role} key for the selected test project; key contents are not logged.`)
  }
}

/** Local checks only: no network access and no assertion that a project is truly disposable. */
export function databaseTestEnvironment(env: Environment, applicationUrls: readonly string[]): Record<string, string> {
  assertDatabaseTestOptIn(env)
  const rawUrl = required(env, 'TEST_SUPABASE_URL')
  const projectRef = required(env, 'TEST_SUPABASE_PROJECT_REF')
  const anonKey = required(env, 'TEST_SUPABASE_ANON_KEY')
  const serviceKey = required(env, 'TEST_SUPABASE_SERVICE_ROLE_KEY')
  let url: URL
  try { url = new URL(rawUrl) } catch { throw new Error('TEST_SUPABASE_URL must be a valid test-project URL.') }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('TEST_SUPABASE_URL must be a plain project origin without credentials, path, query, or fragment.')
  }
  const local = isLoopback(url)
  if (local) {
    if (!['http:', 'https:'].includes(url.protocol) || projectRef !== 'local') {
      throw new Error('Loopback database tests require HTTP(S) and TEST_SUPABASE_PROJECT_REF=local.')
    }
  } else if (url.protocol !== 'https:' || url.port || !/^[a-z0-9]{20}$/.test(projectRef)
    || url.hostname !== `${projectRef}.supabase.co`) {
    throw new Error('Hosted database tests require HTTPS and a matching TEST_SUPABASE_PROJECT_REF on the standard Supabase project URL.')
  }
  for (const applicationUrl of applicationUrls) {
    let parsed: URL
    try { parsed = new URL(applicationUrl) } catch { continue }
    if (targetIdentity(parsed) === targetIdentity(url)) {
      throw new Error('Refusing database tests against a configured application project. Use a separate disposable project.')
    }
  }
  validateKey(anonKey, 'anon', projectRef)
  validateKey(serviceKey, 'service_role', projectRef)
  return {
    NEXT_PUBLIC_SUPABASE_URL: url.origin,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  }
}
