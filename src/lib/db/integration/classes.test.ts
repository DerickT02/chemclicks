import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'

// ─── Context ──────────────────────────────────────────────────────────────────
// RLS policies on the classes table:
//   SELECT — authenticated only, USING (teacher_id = auth.uid())
//   INSERT — authenticated only, WITH CHECK (teacher_id = auth.uid())
//   UPDATE — authenticated only, USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid())
//   DELETE — authenticated only, USING (teacher_id = auth.uid())

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateClassCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
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

async function insertClass(teacherId: string, name: string): Promise<string> {
  const { data, error } = await admin
    .from('classes')
    .insert({ teacher_id: teacherId, name, section: generateClassCode(), class_code: generateClassCode() })
    .select('id')
    .single()
  if (error) throw new Error(`insertClass failed: ${error.message}`)
  return data.id
}

async function deleteAuthUser(userId: string): Promise<void> {
  await admin.auth.admin.deleteUser(userId)
}

// ─── Suite setup ──────────────────────────────────────────────────────────────
// Two teachers, each owning one class. Cross-teacher isolation is verified.
// Deleting each auth user cascades to teachers → classes.

const PASSWORD = 'test-password-123'

let teacherAId: string
let teacherBId: string
let classAId: string
let classBId: string

beforeAll(async () => {
  teacherAId = await createAuthUser('teacher-a@test.com', PASSWORD)
  teacherBId = await createAuthUser('teacher-b@test.com', PASSWORD)
  await insertTeacher(teacherAId, 'teacher-a@test.com', 'Teacher A')
  await insertTeacher(teacherBId, 'teacher-b@test.com', 'Teacher B')

  classAId = await insertClass(teacherAId, "Teacher A's Class")
  classBId = await insertClass(teacherBId, "Teacher B's Class")
})

afterAll(async () => {
  await deleteAuthUser(teacherAId)
  await deleteAuthUser(teacherBId)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('classes table RLS', () => {

  describe('SELECT policy', () => {
    it('teacher can read their own classes', async () => {
      const client = await signInAsTeacher('teacher-a@test.com', PASSWORD)
      const { data, error } = await client.from('classes').select('id, name, teacher_id')

      expect(error).toBeNull()
      const ids = data!.map(r => r.id)
      expect(ids).toContain(classAId)
    })

    it("teacher never sees another teacher's classes", async () => {
      const client = await signInAsTeacher('teacher-a@test.com', PASSWORD)
      const { data, error } = await client.from('classes').select('id')

      expect(error).toBeNull()
      const ids = data!.map(r => r.id)
      expect(ids).not.toContain(classBId)
    })

    it('unauthenticated request returns no rows', async () => {
      const client = unauthenticatedClient()
      const { data, error } = await client.from('classes').select('id')

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it('service role bypasses RLS and sees all classes', async () => {
      const { data, error } = await admin.from('classes').select('id').in('id', [classAId, classBId])

      expect(error).toBeNull()
      const ids = data!.map(r => r.id)
      expect(ids).toContain(classAId)
      expect(ids).toContain(classBId)
    })
  })

  describe('INSERT policy', () => {
    it('teacher can insert a class owned by themselves', async () => {
      const client = await signInAsTeacher('teacher-a@test.com', PASSWORD)
      const { data, error } = await client
        .from('classes')
        .insert({
          teacher_id: teacherAId,
          name: 'Self-Owned Class',
          section: generateClassCode(),
          class_code: generateClassCode(),
        })
        .select('id')
        .single()

      expect(error).toBeNull()
      expect(data!.id).toBeDefined()

      // Cleanup
      await admin.from('classes').delete().eq('id', data!.id)
    })

    it('teacher cannot insert a class owned by another teacher', async () => {
      const client = await signInAsTeacher('teacher-a@test.com', PASSWORD)
      const { error } = await client
        .from('classes')
        .insert({
          teacher_id: teacherBId,
          name: 'Hijacked Class',
          section: generateClassCode(),
          class_code: generateClassCode(),
        })
        .select()

      // WITH CHECK fails → RLS blocks the operation
      expect(error).not.toBeNull()
      expect(error!.code).toBe('42501')
    })
  })

  describe('UPDATE policy', () => {
    it('teacher can update their own class', async () => {
      // Throwaway row so this test does not mutate suite fixtures
      const throwawayId = await insertClass(teacherAId, 'Update Target')

      const client = await signInAsTeacher('teacher-a@test.com', PASSWORD)
      const { error } = await client
        .from('classes')
        .update({ name: 'Update Target Updated' })
        .eq('id', throwawayId)

      expect(error).toBeNull()

      const { data } = await admin.from('classes').select('name').eq('id', throwawayId).single()
      expect(data!.name).toBe('Update Target Updated')

      await admin.from('classes').delete().eq('id', throwawayId)
    })

    it("teacher cannot update another teacher's class", async () => {
      const client = await signInAsTeacher('teacher-a@test.com', PASSWORD)
      const { error } = await client
        .from('classes')
        .update({ name: 'Hacked' })
        .eq('id', classBId)

      expect(error).toBeNull() // RLS silently affects 0 rows

      const { data } = await admin.from('classes').select('name').eq('id', classBId).single()
      expect(data!.name).toBe("Teacher B's Class")
    })
  })

  describe('DELETE policy', () => {
    it('teacher can delete their own class', async () => {
      // Throwaway row so this test does not disturb suite fixtures
      const throwawayId = await insertClass(teacherAId, 'Delete Target')

      const client = await signInAsTeacher('teacher-a@test.com', PASSWORD)
      const { error } = await client.from('classes').delete().eq('id', throwawayId)

      expect(error).toBeNull()

      const { data } = await admin.from('classes').select('id').eq('id', throwawayId).maybeSingle()
      expect(data).toBeNull()
    })

    it("teacher cannot delete another teacher's class", async () => {
      const client = await signInAsTeacher('teacher-a@test.com', PASSWORD)
      const { error } = await client.from('classes').delete().eq('id', classBId)

      expect(error).toBeNull() // RLS silently affects 0 rows

      const { data } = await admin.from('classes').select('id').eq('id', classBId).single()
      expect(data!.id).toBe(classBId)
    })
  })

})