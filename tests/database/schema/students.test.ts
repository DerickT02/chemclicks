import { createClient } from '@supabase/supabase-js'
import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest'

// ─── Admin client ─────────────────────────────────────────────────────────────
// Service role key bypasses RLS so tests exercise constraints directly.
// Set SUPABASE_SERVICE_ROLE_KEY in .env.test.local (never commit that file).

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ─── Fixtures ─────────────────────────────────────────────────────────────────
// Each function does exactly one thing: create or read one type of row.

async function fetchExistingTeacherId(): Promise<string> {
  const { data, error } = await supabase.from('teachers').select('id').limit(1).single()
  if (error) throw new Error(`Setup: need at least one row in "teachers". ${error.message}`)
  return data.id
}

async function fetchExistingClassActivityId(): Promise<string> {
  const { data, error } = await supabase.from('class_activities').select('id').limit(1).single()
  if (error) throw new Error(`Setup: need at least one row in "class_activities". ${error.message}`)
  return data.id
}

/** Returns a random 6-character uppercase alphanumeric string matching ^[A-Z0-9]{6}$. */
function generateClassCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function insertTestClass(teacherId: string): Promise<string> {
  const { data, error } = await supabase
    .from('classes')
    .insert({ teacher_id: teacherId, name: 'Test Class', section: generateClassCode(), class_code: generateClassCode() })
    .select('id')
    .single()
  if (error) throw new Error(`insertTestClass failed: ${error.message}`)
  return data.id
}

async function insertStudent(classId: string, firstName = 'Alice', lastName = 'Smith') {
  return supabase
    .from('students')
    .insert({ class_id: classId, first_name: firstName, last_name: lastName })
    .select('*')
    .single()
}

async function insertStudentProgress(studentId: string, classActivityId: string): Promise<string> {
  const { data, error } = await supabase
    .from('student_progress')
    .insert({ student_id: studentId, class_activity_id: classActivityId })
    .select('id')
    .single()
  if (error) throw new Error(`insertStudentProgress failed: ${error.message}`)
  return data.id
}

async function fetchStudentsByClassId(classId: string) {
  return supabase.from('students').select('id').eq('class_id', classId)
}

async function fetchProgressByStudentId(studentId: string) {
  return supabase.from('student_progress').select('id').eq('student_id', studentId)
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────
// Tracks rows inserted during each test. afterEach deletes them in child-first
// order. Cascade-deleted rows are silently ignored by .delete().in().

const track = {
  classIds: [] as string[],
  studentIds: [] as string[],
  progressIds: [] as string[],
}

afterEach(async () => {
  if (track.progressIds.length > 0) {
    await supabase.from('student_progress').delete().in('id', track.progressIds)
    track.progressIds.length = 0
  }
  if (track.studentIds.length > 0) {
    await supabase.from('students').delete().in('id', track.studentIds)
    track.studentIds.length = 0
  }
  if (track.classIds.length > 0) {
    await supabase.from('classes').delete().in('id', track.classIds)
    track.classIds.length = 0
  }
})

// ─── Suite setup ──────────────────────────────────────────────────────────────
// primaryClassId is shared across tests that only need a stable FK anchor.
// Tests that need to delete a class create their own disposable one.

let teacherId: string
let classActivityId: string
let primaryClassId: string

beforeAll(async () => {
  teacherId       = await fetchExistingTeacherId()
  classActivityId = await fetchExistingClassActivityId()
  primaryClassId  = await insertTestClass(teacherId)
})

afterAll(async () => {
  await supabase.from('classes').delete().eq('id', primaryClassId)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('students table schema', () => {

  describe('column defaults', () => {
    it('auto-generates a uuid for id', async () => {
      const { data, error } = await insertStudent(primaryClassId)
      if (data?.id) track.studentIds.push(data.id)

      expect(error).toBeNull()
      expect(data!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })

    it('auto-sets created_at to a recent timestamp', async () => {
      const before = Date.now()
      const { data, error } = await insertStudent(primaryClassId)
      if (data?.id) track.studentIds.push(data.id)
      const after = Date.now()

      expect(error).toBeNull()
      const createdAt = new Date(data!.created_at).getTime()
      expect(createdAt).toBeGreaterThanOrEqual(before)
      expect(createdAt).toBeLessThanOrEqual(after)
    })
  })

  describe('NOT NULL constraints (pg error 23502)', () => {
    it('rejects insert without class_id', async () => {
      const { error } = await supabase
        .from('students')
        .insert({ first_name: 'Alice', last_name: 'Smith' })
        .select()

      expect(error?.code).toBe('23502')
    })

    it('rejects insert without first_name', async () => {
      const { error } = await supabase
        .from('students')
        .insert({ class_id: primaryClassId, last_name: 'Smith' })
        .select()

      expect(error?.code).toBe('23502')
    })

    it('rejects insert without last_name', async () => {
      const { error } = await supabase
        .from('students')
        .insert({ class_id: primaryClassId, first_name: 'Alice' })
        .select()

      expect(error?.code).toBe('23502')
    })
  })

  describe('UNIQUE constraint — (class_id, first_name, last_name) (pg error 23505)', () => {
    it('rejects a duplicate student in the same class', async () => {
      const { data: first } = await insertStudent(primaryClassId, 'Alice', 'Smith')
      if (first?.id) track.studentIds.push(first.id)

      const { error } = await insertStudent(primaryClassId, 'Alice', 'Smith')

      expect(error?.code).toBe('23505')
    })

    it('allows the same name in a different class', async () => {
      const secondClassId = await insertTestClass(teacherId)
      track.classIds.push(secondClassId)

      const { data: s1 } = await insertStudent(primaryClassId, 'Alice', 'Smith')
      if (s1?.id) track.studentIds.push(s1.id)

      const { data: s2, error } = await insertStudent(secondClassId, 'Alice', 'Smith')
      if (s2?.id) track.studentIds.push(s2.id)

      expect(error).toBeNull()
      expect(s2).not.toBeNull()
    })
  })

  describe('FOREIGN KEY constraint (pg error 23503)', () => {
    it('rejects insert with a non-existent class_id', async () => {
      const { error } = await supabase
        .from('students')
        .insert({
          class_id: '00000000-0000-0000-0000-000000000000',
          first_name: 'Alice',
          last_name: 'Smith',
        })
        .select()

      expect(error?.code).toBe('23503')
    })
  })

  describe('ON DELETE CASCADE — classes → students', () => {
    it('removes students when their class is deleted', async () => {
      const classId = await insertTestClass(teacherId)
      const { data: student } = await insertStudent(classId, 'Alice', 'Smith')
      // Track as safety net; cascade will delete this before afterEach runs.
      if (student?.id) track.studentIds.push(student.id)

      await supabase.from('classes').delete().eq('id', classId)

      const { data: remaining } = await fetchStudentsByClassId(classId)
      expect(remaining).toHaveLength(0)
    })
  })

  describe('ON DELETE CASCADE — students → student_progress', () => {
    it('removes student_progress rows when the student is deleted', async () => {
      const { data: student } = await insertStudent(primaryClassId)
      const studentId = student!.id
      track.studentIds.push(studentId)

      const progressId = await insertStudentProgress(studentId, classActivityId)
      // Track as safety net; cascade will delete this before afterEach runs.
      track.progressIds.push(progressId)

      await supabase.from('students').delete().eq('id', studentId)

      const { data: remaining } = await fetchProgressByStudentId(studentId)
      expect(remaining).toHaveLength(0)
    })
  })

})
