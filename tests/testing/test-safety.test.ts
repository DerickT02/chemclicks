import { describe, expect, it } from 'vitest'

describe('safe unit-test policy', () => {
  it('replaces application credentials with inert test values', () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:1')
    expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('unit-test-anon-key')
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBe('unit-test-service-role-key')
  })
  it('blocks unmocked fetch before it can contact a project', async () => {
    expect(globalThis.fetch.name).toBe('blockedFetch')
    await expect(fetch('http://127.0.0.1:1')).rejects.toThrow('Network fetch is disabled in unit tests')
  })
})
