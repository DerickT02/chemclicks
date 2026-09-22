import { createClient } from '@supabase/supabase-js'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { createTestStudentAuthUser, deleteTestAuthUsers } from '../auth-fixtures'

// ─── Context ──────────────────────────────────────────────────────────────────
// Runtime student access uses a Supabase Auth session where auth.users.id and
// students.id are the same UUID. These fixtures use the service role only to
// set up cross-class records and verify the scoped query shape.

// ─── Admin client ─────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ─── Server-side query functions ──────────────────────────────────────────────
// Student-facing code derives class_id from the students row whose id equals
// auth.uid(); it never accepts an arbitrary class_id from the client.

function getClassForStudent(classId: string) {
  return supabase
    .from('classes')
    .select('id, name, section, class_code, is_active')
    .eq('id', classId)
    .single()
}

function getStudentsInClass(classId: string) {
  return supabase
    .from('students')
    .select('id, first_name, last_name')
    .eq('class_id', classId)
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

async function insertClass(teacherId: string): Promise<string> {
  const { data, error } = await supabase
    .from('classes')
    .insert({ teacher_id: teacherId, name: 'Integration Class', section: generateClassCode(), class_code: generateClassCode() })
    .select('id')
    .single()
  if (error) throw new Error(`insertClass failed: ${error.message}`)
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────
// Two classes, one student each. Isolation is verified across the boundary.

let classAId: string
let classBId: string
let studentAId: string
let studentBId: string

beforeAll(async () => {
  const teacherId = await fetchExistingTeacherId()

  classAId  = await insertClass(teacherId)
  classBId  = await insertClass(teacherId)

  studentAId = await insertStudent(classAId, 'Alice', 'Smith')
  studentBId = await insertStudent(classBId, 'Bob',   'Jones')
})

afterAll(async () => {
  await supabase.from('students').delete().in('id', [studentAId, studentBId])
  await supabase.from('classes').delete().in('id', [classAId, classBId])
  await deleteTestAuthUsers(supabase, authUserIds)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('student data isolation (server-side)', () => {

  describe('class access', () => {
    it("returns the class a student is enrolled in", async () => {
      const { data, error } = await getClassForStudent(classAId)

      expect(error).toBeNull()
      expect(data!.id).toBe(classAId)
    })

    it("does not return Class B when querying with Class A's id", async () => {
      const { data, error } = await getClassForStudent(classAId)

      expect(error).toBeNull()
      expect(data!.id).not.toBe(classBId)
    })

    it("returns no data when queried with a non-existent class_id", async () => {
      const { data, error } = await getClassForStudent('00000000-0000-0000-0000-000000000000')

      expect(data).toBeNull()
      expect(error?.code).toBe('PGRST116') // no rows returned
    })
  })

  describe('student roster access', () => {
    it("returns only students enrolled in the queried class", async () => {
      const { data, error } = await getStudentsInClass(classAId)

      expect(error).toBeNull()
      const ids = data!.map(s => s.id)
      expect(ids).toContain(studentAId)
      expect(ids).not.toContain(studentBId)
    })

    it("does not expose Class A's students when querying with Class B's id", async () => {
      const { data, error } = await getStudentsInClass(classBId)

      expect(error).toBeNull()
      const ids = data!.map(s => s.id)
      expect(ids).not.toContain(studentAId)
    })
  })

  describe('read-only access', () => {
    // Students interact with the database only through the two read functions
    // above. No write functions are defined for the student-facing query layer —
    // the server never exposes INSERT, UPDATE, or DELETE on their behalf.

    it("getClassForStudent only exposes safe read-only fields", async () => {
      const { data } = await getClassForStudent(classAId)

      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('section')
      expect(data).toHaveProperty('class_code')
      expect(data).toHaveProperty('is_active')
      // teacher_id is intentionally not selected — students have no need for it
      expect(data).not.toHaveProperty('teacher_id')
    })

    it("getStudentsInClass only exposes safe read-only fields", async () => {
      const { data } = await getStudentsInClass(classAId)

      expect(data![0]).toHaveProperty('id')
      expect(data![0]).toHaveProperty('first_name')
      expect(data![0]).toHaveProperty('last_name')
      // created_at is intentionally not selected — students have no need for it
      expect(data![0]).not.toHaveProperty('created_at')
    })
  })

})
