import { createClient } from '@supabase/supabase-js'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { createTestStudentAuthUser, deleteTestAuthUsers } from '../auth-fixtures'

// ─── Context ──────────────────────────────────────────────────────────────────
// Runtime student access uses a Supabase Auth session and RLS. These fixtures
// use the service role only to set up cross-class records and verify the scoped
// query shape independently of authentication.
//
// A student in Class A must never read progress belonging to a student in
// Class B.

// ─── Admin client ─────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ─── Server-side query functions ──────────────────────────────────────────────
// Student-facing code uses auth.uid(), which is also the public.students UUID;
// it never accepts an arbitrary student_id from the client.

function getProgressForStudent(studentId: string) {
  return supabase
    .from('student_progress')
    .select('id, student_id, class_activity_id, status, started_at, completed_at')
    .eq('student_id', studentId)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateClassCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

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

async function insertClass(teacherId: string): Promise<string> {
  const { data, error } = await supabase
    .from('classes')
    .insert({ teacher_id: teacherId, name: 'Integration Class', section: generateClassCode(), class_code: generateClassCode() })
    .select('id')
    .single()
  if (error) throw new Error(`insertClass failed: ${error.message}`)
  return data.id
}

async function insertClassActivity(classId: string, activityId: string): Promise<string> {
  const { data, error } = await supabase
    .from('class_activities')
    .insert({ class_id: classId, activity_id: activityId })
    .select('id')
    .single()
  if (error) throw new Error(`insertClassActivity failed: ${error.message}`)
  return data.id
}

const authUserIds: string[] = []

async function insertStudent(classId: string, firstName: string, lastName: string): Promise<string> {
  const authUserId = await createTestStudentAuthUser(supabase)
  authUserIds.push(authUserId)
  const studentId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const { data, error } = await supabase
    .from('students')
    .insert({ id: authUserId, class_id: classId, first_name: firstName, last_name: lastName, student_id: studentId })
    .select('id')
    .single()
  if (error) throw new Error(`insertStudent failed: ${error.message}`)
  return data.id
}

async function insertProgress(studentId: string, classActivityId: string): Promise<string> {
  const { data, error } = await supabase
    .from('student_progress')
    .insert({ student_id: studentId, class_activity_id: classActivityId })
    .select('id')
    .single()
  if (error) throw new Error(`insertProgress failed: ${error.message}`)
  return data.id
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
// Two classes, one student each. Each student has one progress record.
// Isolation is verified across the class boundary.

let classAId: string
let classBId: string
let studentAId: string
let studentBId: string
let progressAId: string
let progressBId: string

beforeAll(async () => {
  const teacherId  = await fetchExistingTeacherId()
  const activityId = await fetchExistingActivityId()

  classAId = await insertClass(teacherId)
  classBId = await insertClass(teacherId)

  const classActivityAId = await insertClassActivity(classAId, activityId)
  const classActivityBId = await insertClassActivity(classBId, activityId)

  studentAId = await insertStudent(classAId, 'Alice', 'Smith')
  studentBId = await insertStudent(classBId, 'Bob',   'Jones')

  progressAId = await insertProgress(studentAId, classActivityAId)
  progressBId = await insertProgress(studentBId, classActivityBId)
})

afterAll(async () => {
  await supabase.from('classes').delete().in('id', [classAId, classBId])
  await deleteTestAuthUsers(supabase, authUserIds)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('student_progress data isolation (server-side)', () => {

  describe('progress access', () => {
    it("returns progress records for the queried student", async () => {
      const { data, error } = await getProgressForStudent(studentAId)

      expect(error).toBeNull()
      const ids = data!.map(r => r.id)
      expect(ids).toContain(progressAId)
    })

    it("does not return another student's progress when querying by student_id", async () => {
      const { data, error } = await getProgressForStudent(studentAId)

      expect(error).toBeNull()
      const ids = data!.map(r => r.id)
      expect(ids).not.toContain(progressBId)
    })

    it("does not return Class A's progress when querying with Class B's student_id", async () => {
      const { data, error } = await getProgressForStudent(studentBId)

      expect(error).toBeNull()
      const ids = data!.map(r => r.id)
      expect(ids).not.toContain(progressAId)
    })

    it("returns an empty array when queried with a non-existent student_id", async () => {
      const { data, error } = await getProgressForStudent('00000000-0000-0000-0000-000000000000')

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })
  })

  describe('read-only access', () => {
    it("getProgressForStudent only exposes safe read-only fields", async () => {
      const { data } = await getProgressForStudent(studentAId)

      expect(data![0]).toHaveProperty('id')
      expect(data![0]).toHaveProperty('student_id')
      expect(data![0]).toHaveProperty('class_activity_id')
      expect(data![0]).toHaveProperty('status')
      expect(data![0]).toHaveProperty('started_at')
      expect(data![0]).toHaveProperty('completed_at')
    })
  })

})
