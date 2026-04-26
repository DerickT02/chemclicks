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

async function fetchExistingActivityId(): Promise<string> {
  const { data, error } = await supabase.from('activities').select('id').limit(1).single()
  if (error) throw new Error(`Setup: need at least one row in "activities". ${error.message}`)
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

async function insertTestClassActivity(classId: string, activityId: string): Promise<string> {
  const { data, error } = await supabase
    .from('class_activities')
    .insert({ class_id: classId, activity_id: activityId })
    .select('id')
    .single()
  if (error) throw new Error(`insertTestClassActivity failed: ${error.message}`)
  return data.id
}

async function insertStudent(classId: string, firstName = 'Alice', lastName = 'Smith'): Promise<string> {
  const studentId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const { data, error } = await supabase
    .from('students')
    .insert({ class_id: classId, first_name: firstName, last_name: lastName, student_id: studentId })
    .select('id')
    .single()
  if (error) throw new Error(`insertStudent failed: ${error.message}`)
  return data.id
}

async function insertStudentProgress(studentId: string, classActivityId: string) {
  return supabase
    .from('student_progress')
    .insert({ student_id: studentId, class_activity_id: classActivityId })
    .select('*')
    .single()
}

async function insertStudentAttempt(progressId: string): Promise<string> {
  const { data, error } = await supabase
    .from('student_attempts')
    .insert({ progress_id: progressId, attempt_number: 1 })
    .select('id')
    .single()
  if (error) throw new Error(`insertStudentAttempt failed: ${error.message}`)
  return data.id
}

async function fetchProgressByStudentId(studentId: string) {
  return supabase.from('student_progress').select('id').eq('student_id', studentId)
}

async function fetchProgressByClassActivityId(classActivityId: string) {
  return supabase.from('student_progress').select('id').eq('class_activity_id', classActivityId)
}

async function fetchAttemptsByProgressId(progressId: string) {
  return supabase.from('student_attempts').select('id').eq('progress_id', progressId)
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────
// Tracks rows inserted during each test. afterEach deletes them in child-first
// order. Cascade-deleted rows are silently ignored by .delete().in().

const track = {
  attemptIds: [] as string[],
  progressIds: [] as string[],
  studentIds: [] as string[],
  classIds: [] as string[],
}

afterEach(async () => {
  if (track.attemptIds.length > 0) {
    await supabase.from('student_attempts').delete().in('id', track.attemptIds)
    track.attemptIds.length = 0
  }
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
// primaryClassId and secondaryClassId are shared FK anchors used across tests.
// primaryStudentId belongs to primaryClassId.
// secondaryClassActivityId lets the UNIQUE test insert a second progress row
// for the same student without violating the constraint.
// Tests that need to delete a class or class_activity create disposable ones.

let teacherId: string
let activityId: string
let primaryClassId: string
let primaryClassActivityId: string
let secondaryClassId: string
let secondaryClassActivityId: string
let primaryStudentId: string

beforeAll(async () => {
  teacherId  = await fetchExistingTeacherId()
  activityId = await fetchExistingActivityId()

  primaryClassId           = await insertTestClass(teacherId)
  primaryClassActivityId   = await insertTestClassActivity(primaryClassId, activityId)
  primaryStudentId         = await insertStudent(primaryClassId)

  secondaryClassId          = await insertTestClass(teacherId)
  secondaryClassActivityId  = await insertTestClassActivity(secondaryClassId, activityId)
})

afterAll(async () => {
  await supabase.from('classes').delete().in('id', [primaryClassId, secondaryClassId])
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('student_progress table schema', () => {

  describe('column defaults', () => {
    it('auto-generates a uuid for id', async () => {
      const { data, error } = await insertStudentProgress(primaryStudentId, primaryClassActivityId)
      if (data?.id) track.progressIds.push(data.id)

      expect(error).toBeNull()
      expect(data!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })

    it('defaults status to not_started', async () => {
      const { data, error } = await insertStudentProgress(primaryStudentId, primaryClassActivityId)
      if (data?.id) track.progressIds.push(data.id)

      expect(error).toBeNull()
      expect(data!.status).toBe('not_started')
    })

    it('allows null started_at and null completed_at', async () => {
      const { data, error } = await insertStudentProgress(primaryStudentId, primaryClassActivityId)
      if (data?.id) track.progressIds.push(data.id)

      expect(error).toBeNull()
      expect(data!.started_at).toBeNull()
      expect(data!.completed_at).toBeNull()
    })
  })

  describe('progress_status enum', () => {
    it('accepts in_progress as a valid status value', async () => {
      const { data, error } = await supabase
        .from('student_progress')
        .insert({ student_id: primaryStudentId, class_activity_id: primaryClassActivityId, status: 'in_progress' })
        .select('*')
        .single()
      if (data?.id) track.progressIds.push(data.id)

      expect(error).toBeNull()
      expect(data!.status).toBe('in_progress')
    })

    it('accepts completed as a valid status value', async () => {
      const { data, error } = await supabase
        .from('student_progress')
        .insert({ student_id: primaryStudentId, class_activity_id: primaryClassActivityId, status: 'completed' })
        .select('*')
        .single()
      if (data?.id) track.progressIds.push(data.id)

      expect(error).toBeNull()
      expect(data!.status).toBe('completed')
    })

    it('rejects an invalid status value (pg error 22P02)', async () => {
      const { error } = await supabase
        .from('student_progress')
        .insert({ student_id: primaryStudentId, class_activity_id: primaryClassActivityId, status: 'invalid_status' })
        .select()

      expect(error).not.toBeNull()
      expect(error!.code).toBe('22P02')
    })
  })

  describe('NOT NULL constraints (pg error 23502)', () => {
    it('rejects insert without student_id', async () => {
      const { error } = await supabase
        .from('student_progress')
        .insert({ class_activity_id: primaryClassActivityId })
        .select()

      expect(error?.code).toBe('23502')
    })

    it('rejects insert without class_activity_id', async () => {
      const { error } = await supabase
        .from('student_progress')
        .insert({ student_id: primaryStudentId })
        .select()

      expect(error?.code).toBe('23502')
    })
  })

  describe('UNIQUE constraint — (student_id, class_activity_id) (pg error 23505)', () => {
    it('rejects a duplicate (student_id, class_activity_id) pair', async () => {
      const { data: first } = await insertStudentProgress(primaryStudentId, primaryClassActivityId)
      if (first?.id) track.progressIds.push(first.id)

      const { error } = await insertStudentProgress(primaryStudentId, primaryClassActivityId)

      expect(error?.code).toBe('23505')
    })

    it('allows the same student_id with a different class_activity_id', async () => {
      const { data: first, error: e1 } = await insertStudentProgress(primaryStudentId, primaryClassActivityId)
      if (first?.id) track.progressIds.push(first.id)

      const { data: second, error: e2 } = await insertStudentProgress(primaryStudentId, secondaryClassActivityId)
      if (second?.id) track.progressIds.push(second.id)

      expect(e1).toBeNull()
      expect(e2).toBeNull()
      expect(second).not.toBeNull()
    })
  })

  describe('FOREIGN KEY constraints (pg error 23503)', () => {
    it('rejects insert with a non-existent student_id', async () => {
      const { error } = await supabase
        .from('student_progress')
        .insert({ student_id: '00000000-0000-0000-0000-000000000000', class_activity_id: primaryClassActivityId })
        .select()

      expect(error?.code).toBe('23503')
    })

    it('rejects insert with a non-existent class_activity_id', async () => {
      const { error } = await supabase
        .from('student_progress')
        .insert({ student_id: primaryStudentId, class_activity_id: '00000000-0000-0000-0000-000000000000' })
        .select()

      expect(error?.code).toBe('23503')
    })
  })

  describe('ON DELETE CASCADE — students → student_progress', () => {
    it('removes student_progress rows when the student is deleted', async () => {
      const studentId = await insertStudent(primaryClassId, 'Bob', 'Jones')
      // Track as safety net; cascade will delete this before afterEach runs.
      track.studentIds.push(studentId)

      const { data: progress } = await insertStudentProgress(studentId, primaryClassActivityId)
      track.progressIds.push(progress!.id)

      await supabase.from('students').delete().eq('id', studentId)

      const { data: remaining } = await fetchProgressByStudentId(studentId)
      expect(remaining).toHaveLength(0)
    })
  })

  describe('ON DELETE CASCADE — class_activities → student_progress', () => {
    it('removes student_progress rows when the class_activity is deleted', async () => {
      const disposableClassId = await insertTestClass(teacherId)
      track.classIds.push(disposableClassId)
      const disposableClassActivityId = await insertTestClassActivity(disposableClassId, activityId)

      const { data: progress } = await insertStudentProgress(primaryStudentId, disposableClassActivityId)
      track.progressIds.push(progress!.id)

      await supabase.from('class_activities').delete().eq('id', disposableClassActivityId)

      const { data: remaining } = await fetchProgressByClassActivityId(disposableClassActivityId)
      expect(remaining).toHaveLength(0)
    })
  })

  describe('ON DELETE CASCADE — student_progress → student_attempts', () => {
    it('removes student_attempts rows when the student_progress row is deleted', async () => {
      const { data: progress } = await insertStudentProgress(primaryStudentId, primaryClassActivityId)
      const progressId = progress!.id
      track.progressIds.push(progressId)

      const attemptId = await insertStudentAttempt(progressId)
      // Track as safety net; cascade will delete this before afterEach runs.
      track.attemptIds.push(attemptId)

      await supabase.from('student_progress').delete().eq('id', progressId)

      const { data: remaining } = await fetchAttemptsByProgressId(progressId)
      expect(remaining).toHaveLength(0)
    })
  })

})
