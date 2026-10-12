import { beforeEach } from 'vitest'

// Install directly so vi.unstubAllGlobals() restores this guard, not real fetch.
// Tests that exercise HTTP must explicitly replace it with a mocked response.
const blockedFetch: typeof fetch = async () => {
  throw new Error('Network fetch is disabled in unit tests. Mock the request; do not use a live Supabase project.')
}
globalThis.fetch = blockedFetch
beforeEach(() => { globalThis.fetch = blockedFetch })
