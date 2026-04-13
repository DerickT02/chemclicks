import { createClient } from '@supabase/supabase-js'
import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest'

// ─── Admin client ─────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ─── Fixtures ─────────────────────────────────────────────────────────────────
// Each function does exactly one thing.

/** Creates a Supabase auth user and returns their UUID. */
async function createAuthUser(email: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: 'test-password-123',
    email_confirm: true,
  })
  if (error) throw new Error(`createAuthUser failed: ${error.message}`)
  return data.user.id
}

/** Deletes a Supabase auth user — cascades to the teachers row automatically. */
async function deleteAuthUser(userId: string): Promise<void> {
  await supabase.auth.admin.deleteUser(userId)
}

async function insertTeacher(id: string, email: string, displayName = 'Test Teacher') {
  return supabase
    .from('teachers')
    .insert({ id, email, display_name: displayName })
    .select('*')
    .single()
}

async function fetchTeacherById(id: string) {
  return supabase.from('teachers').select('id').eq('id', id).single()
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────
// Deleting an auth user cascades to the teachers row — only auth user IDs
// need to be tracked. afterEach runs after every test.

const trackedAuthUserIds: string[] = []

afterEach(async () => {
  for (const userId of trackedAuthUserIds) {
    await deleteAuthUser(userId)
  }
  trackedAuthUserIds.length = 0
})

// ─── Suite setup ──────────────────────────────────────────────────────────────
// primaryAuthUserId backs the teacher row used across tests that need a valid
// anchor but do not need to delete it. Cleaned up in afterAll.

let primaryAuthUserId: string

beforeAll(async () => {
  primaryAuthUserId = await createAuthUser('primary-teacher@test.com')
  const { error } = await insertTeacher(primaryAuthUserId, 'primary-teacher@test.com')
  if (error) throw new Error(`Suite setup failed: could not insert primary teacher. ${error.message}`)
})

afterAll(async () => {
  await deleteAuthUser(primaryAuthUserId)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('teachers table schema', () => {

  describe('column structure', () => {
    it('id is the primary key and must be provided — it has no auto-generated default', async () => {
      // teachers.id references auth.users(id) and has no DEFAULT gen_random_uuid().
      // Omitting id should fail with a not-null violation.
      const { error } = await supabase
        .from('teachers')
        .insert({ email: 'no-id@test.com', display_name: 'No ID' })
        .select()

      expect(error?.code).toBe('23502')
    })

    it('id matches the auth user uuid', async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('id')
        .eq('id', primaryAuthUserId)
        .single()

      expect(error).toBeNull()
      expect(data!.id).toBe(primaryAuthUserId)
    })

    it('auto-sets created_at to a recent timestamp', async () => {
      const authUserId = await createAuthUser('created-at-teacher@test.com')
      trackedAuthUserIds.push(authUserId)

      const before = Date.now()
      const { data, error } = await insertTeacher(authUserId, 'created-at-teacher@test.com')
      const after = Date.now()

      expect(error).toBeNull()
      const createdAt = new Date(data!.created_at).getTime()
      expect(createdAt).toBeGreaterThanOrEqual(before)
      expect(createdAt).toBeLessThanOrEqual(after)
    })
  })

  describe('NOT NULL constraints (pg error 23502)', () => {
    it('rejects insert without email', async () => {
      const { error } = await supabase
        .from('teachers')
        .insert({ id: primaryAuthUserId, display_name: 'No Email' })
        .select()

      expect(error?.code).toBe('23502')
    })

    it('rejects insert without display_name', async () => {
      const { error } = await supabase
        .from('teachers')
        .insert({ id: primaryAuthUserId, email: 'no-display@test.com' })
        .select()

      expect(error?.code).toBe('23502')
    })
  })

  describe('UNIQUE constraint — email (pg error 23505)', () => {
    it('rejects insert with a duplicate email', async () => {
      const authUserId = await createAuthUser('duplicate-email@test.com')
      trackedAuthUserIds.push(authUserId)
      await insertTeacher(authUserId, 'duplicate-email@test.com')

      const secondAuthUserId = await createAuthUser('duplicate-email-2@test.com')
      trackedAuthUserIds.push(secondAuthUserId)

      // Use a different auth user id but the same email
      const { error } = await supabase
        .from('teachers')
        .insert({ id: secondAuthUserId, email: 'duplicate-email@test.com', display_name: 'Duplicate' })
        .select()

      expect(error?.code).toBe('23505')
    })
  })

  describe('FOREIGN KEY constraint — id references auth.users(id) (pg error 23503)', () => {
    it('rejects insert with an id that does not exist in auth.users', async () => {
      const { error } = await supabase
        .from('teachers')
        .insert({
          id: '00000000-0000-0000-0000-000000000000',
          email: 'ghost@test.com',
          display_name: 'Ghost',
        })
        .select()

      expect(error?.code).toBe('23503')
    })
  })

  describe('ON DELETE CASCADE — auth.users → teachers', () => {
    it('removes the teacher row when the auth user is deleted', async () => {
      const authUserId = await createAuthUser('cascade-teacher@test.com')
      // Do not push to trackedAuthUserIds — this test deletes the auth user itself.
      await insertTeacher(authUserId, 'cascade-teacher@test.com')

      await deleteAuthUser(authUserId)

      const { data } = await fetchTeacherById(authUserId)
      expect(data).toBeNull()
    })
  })

})
