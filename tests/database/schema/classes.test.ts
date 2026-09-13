import { createClient } from '@supabase/supabase-js'
import { afterEach, describe, it, expect } from 'vitest'

// ─── Admin client ─────────────────────────────────────────────────────────────
// Service role key bypasses RLS so tests exercise constraints directly.
// Set SUPABASE_SERVICE_ROLE_KEY in .env.test.local (never commit that file).

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ─── Fixtures ─────────────────────────────────────────────────────────────────

async function fetchExistingTeacherId(): Promise<string> {
  const { data, error } = await supabase.from('teachers').select('id').limit(1).single()
  if (error) throw new Error(`Setup: need at least one row in "teachers". ${error.message}`)
  return data.id
}

/** Returns a random 6-character uppercase alphanumeric string matching ^[A-Z0-9]{6}$. */
function generateClassCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function insertTestClass(teacherId: string, overrides: Partial<{
  name: string
  section: string
  class_code: string
}> = {}) {
  return supabase
    .from('classes')
    .insert({
      teacher_id: teacherId,
      name: overrides.name ?? 'Test Class',
      section: overrides.section ?? generateClassCode(),
      class_code: overrides.class_code ?? generateClassCode(),
    })
    .select('id')
    .single()
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

const track = { classIds: [] as string[] }

afterEach(async () => {
  if (track.classIds.length > 0) {
    await supabase.from('classes').delete().in('id', track.classIds)
    track.classIds.length = 0
  }
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('classes table schema', () => {

  describe('UNIQUE constraint — class_code (pg error 23505)', () => {
    it('rejects a duplicate class_code for the same teacher', async () => {
      const teacherId = await fetchExistingTeacherId()
      const sharedCode = generateClassCode()

      const { data: first } = await insertTestClass(teacherId, { class_code: sharedCode })
      if (first?.id) track.classIds.push(first.id)

      const { error } = await supabase
        .from('classes')
        .insert({
          teacher_id: teacherId,
          name: 'A Different Class',
          section: generateClassCode(),
          class_code: sharedCode,
        })
        .select()

      expect(error?.code).toBe('23505')
      expect(error?.message).toContain('class_code')
    })

    it('rejects a duplicate class_code across different teachers', async () => {
      const teacherId = await fetchExistingTeacherId()
      const sharedCode = generateClassCode()

      const { data: first } = await insertTestClass(teacherId, { class_code: sharedCode })
      if (first?.id) track.classIds.push(first.id)

      const { error } = await supabase
        .from('classes')
        .insert({
          teacher_id: teacherId,
          name: 'Someone Elses Class',
          section: generateClassCode(),
          class_code: sharedCode,
        })
        .select()

      expect(error?.code).toBe('23505')
    })

    it('a duplicate submission does not create a second row', async () => {
      const teacherId = await fetchExistingTeacherId()
      const sharedCode = generateClassCode()

      const { data: first } = await insertTestClass(teacherId, { class_code: sharedCode })
      if (first?.id) track.classIds.push(first.id)

      await supabase
        .from('classes')
        .insert({
          teacher_id: teacherId,
          name: 'Duplicate Attempt',
          section: generateClassCode(),
          class_code: sharedCode,
        })
        .select()

      const { data: rows, error } = await supabase
        .from('classes')
        .select('id')
        .eq('class_code', sharedCode)

      expect(error).toBeNull()
      expect(rows).toHaveLength(1)
    })

    it('allows the same class name to repeat with a different code and section', async () => {
      const teacherId = await fetchExistingTeacherId()

      const { data: c1 } = await insertTestClass(teacherId, { name: 'Chemistry' })
      if (c1?.id) track.classIds.push(c1.id)

      const { data: c2, error } = await insertTestClass(teacherId, { name: 'Chemistry' })
      if (c2?.id) track.classIds.push(c2.id)

      expect(error).toBeNull()
      expect(c2).not.toBeNull()
    })
  })

  describe('CHECK constraint — class_code format (pg error 23514)', () => {
    it('rejects a class_code shorter than 6 characters', async () => {
      const teacherId = await fetchExistingTeacherId()
      const { error } = await insertTestClass(teacherId, { class_code: 'AB12' })

      expect(error?.code).toBe('23514')
    })

    it('rejects a class_code with non-alphanumeric characters', async () => {
      const teacherId = await fetchExistingTeacherId()
      const { error } = await insertTestClass(teacherId, { class_code: 'AB12-!' })

      expect(error?.code).toBe('23514')
    })
  })

})
