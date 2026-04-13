import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'

// ─── Context ──────────────────────────────────────────────────────────────────
// RLS policies on the teachers table:
//   SELECT — authenticated only, USING (auth.uid() = id)
//   UPDATE — authenticated only, USING (auth.uid() = id) WITH CHECK (auth.uid() = id)
//   INSERT — no policy (handled server-side via Edge Function with service role key)
//   DELETE — no policy (admin operation only)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ─── Clients ──────────────────────────────────────────────────────────────────

/** Bypasses RLS — used only for test setup and teardown. */
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/** Returns a fresh client signed in as the given teacher. Respects RLS. */
async function signInAsTeacher(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signInAsTeacher failed: ${error.message}`)
  return client
}

/** Returns a fresh client with no session. Respects RLS. */
function unauthenticatedClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY)
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

async function createAuthUser(email: string, password: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(`createAuthUser failed: ${error.message}`)
  return data.user.id
}

async function insertTeacher(id: string, email: string, displayName: string): Promise<void> {
  const { error } = await admin.from('teachers').insert({ id, email, display_name: displayName })
  if (error) throw new Error(`insertTeacher failed: ${error.message}`)
}

async function deleteAuthUser(userId: string): Promise<void> {
  await admin.auth.admin.deleteUser(userId)
}

// ─── Suite setup ──────────────────────────────────────────────────────────────
// Two real teachers are created for the duration of the suite.
// Deleting each auth user cascades to their teacher row.

const PASSWORD = 'test-password-123'

/** Unique to this file so Vitest can run DB suites in parallel without auth email collisions. */
const TEACHER_A_EMAIL = 'integration-teachers-rls-a@test.com'
const TEACHER_B_EMAIL = 'integration-teachers-rls-b@test.com'

let teacherAId: string
let teacherBId: string

beforeAll(async () => {
  teacherAId = await createAuthUser(TEACHER_A_EMAIL, PASSWORD)
  teacherBId = await createAuthUser(TEACHER_B_EMAIL, PASSWORD)
  await insertTeacher(teacherAId, TEACHER_A_EMAIL, 'Teacher A')
  await insertTeacher(teacherBId, TEACHER_B_EMAIL, 'Teacher B')
})

afterAll(async () => {
  await deleteAuthUser(teacherAId)
  await deleteAuthUser(teacherBId)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('teachers table RLS', () => {

  describe('SELECT policy', () => {
    it('teacher can read their own row', async () => {
      const client = await signInAsTeacher(TEACHER_A_EMAIL, PASSWORD)
      const { data, error } = await client.from('teachers').select('id, email, display_name')

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data![0].id).toBe(teacherAId)
    })

    it('teacher never sees another teacher\'s row', async () => {
      const client = await signInAsTeacher(TEACHER_A_EMAIL, PASSWORD)
      const { data, error } = await client.from('teachers').select('id')

      expect(error).toBeNull()
      const ids = data!.map(r => r.id)
      expect(ids).not.toContain(teacherBId)
    })

    it('unauthenticated request returns no rows', async () => {
      const client = unauthenticatedClient()
      const { data, error } = await client.from('teachers').select('id')

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })
  })

  describe('UPDATE policy', () => {
    it('teacher can update their own display_name', async () => {
      const client = await signInAsTeacher(TEACHER_A_EMAIL, PASSWORD)
      const { error } = await client
        .from('teachers')
        .update({ display_name: 'Teacher A Updated' })
        .eq('id', teacherAId)

      expect(error).toBeNull()

      // Verify the update took effect using admin client
      const { data } = await admin.from('teachers').select('display_name').eq('id', teacherAId).single()
      expect(data!.display_name).toBe('Teacher A Updated')
    })

    it('teacher cannot update another teacher\'s display_name', async () => {
      const client = await signInAsTeacher(TEACHER_A_EMAIL, PASSWORD)
      const { error } = await client
        .from('teachers')
        .update({ display_name: 'Hacked' })
        .eq('id', teacherBId)

      expect(error).toBeNull() // RLS silently affects 0 rows

      // Verify Teacher B's row was not changed
      const { data } = await admin.from('teachers').select('display_name').eq('id', teacherBId).single()
      expect(data!.display_name).toBe('Teacher B')
    })

    it('teacher cannot update another teacher\'s email', async () => {
      const client = await signInAsTeacher(TEACHER_A_EMAIL, PASSWORD)
      await client
        .from('teachers')
        .update({ email: 'hacked@test.com' })
        .eq('id', teacherBId)

      const { data } = await admin.from('teachers').select('email').eq('id', teacherBId).single()
      expect(data!.email).toBe(TEACHER_B_EMAIL)
    })
  })

  describe('INSERT policy', () => {
    it('authenticated teacher cannot insert directly — no INSERT policy exists', async () => {
      const client = await signInAsTeacher(TEACHER_A_EMAIL, PASSWORD)
      const { error } = await client
        .from('teachers')
        .insert({ id: teacherAId, email: 'direct-insert@test.com', display_name: 'Direct' })
        .select()

      // No INSERT policy → RLS blocks the operation
      expect(error).not.toBeNull()
      expect(error!.code).toBe('42501')
    })
  })

  describe('DELETE policy', () => {
    it('authenticated teacher cannot delete their own row — no DELETE policy exists', async () => {
      const client = await signInAsTeacher(TEACHER_A_EMAIL, PASSWORD)
      const { error } = await client
        .from('teachers')
        .delete()
        .eq('id', teacherAId)

      // No DELETE policy → RLS silently affects 0 rows
      expect(error).toBeNull()

      // Verify the row still exists
      const { data } = await admin.from('teachers').select('id').eq('id', teacherAId).single()
      expect(data!.id).toBe(teacherAId)
    })
  })

})
