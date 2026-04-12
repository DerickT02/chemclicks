import { createClient } from '@supabase/supabase-js'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'

// ─── Context ──────────────────────────────────────────────────────────────────
// Students have no Supabase auth accounts. Their data isolation is enforced
// server-side: the Next.js layer reads { class_id } from the student's session
// cookie and always scopes queries to that class_id.
//
// These tests verify that the server-side query pattern correctly isolates
// student data — a student in Class A can never read data belonging to Class B.

// ─── Admin client ─────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ─── Server-side query functions ──────────────────────────────────────────────
// These mirror exactly what Next.js server actions will execute on a student's
// behalf. Each receives the student's class_id from their session — the server
// never lets the student supply an arbitrary class_id.

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

async function insertStudent(classId: string, firstName: string, lastName: string): Promise<string> {
  const { data, error } = await supabase
    .from('students')
    .insert({ class_id: classId, first_name: firstName, last_name: lastName })
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
