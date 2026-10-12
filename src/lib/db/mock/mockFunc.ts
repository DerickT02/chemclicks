// src/lib/db/mock.ts
// Mock backend functions. Swap implementations with real Supabase calls when ready.
// Call sites import from "@/lib/db/mock" — rename file contents, not import paths.

// Inline types — duplicate of src/lib/db/*.ts.
// When those files exist on this branch, delete these and import from '@/lib/db/*' instead.

type Teacher = {
  id: string
  email: string
  display_name: string
  created_at: string
}

type Class = {
  id: string
  teacher_id: string
  name: string
  section: string
  class_code: string
  is_active: boolean
  created_at: string
}

type Student = {
  id: string
  class_id: string
  first_name: string
  last_name: string
  created_at: string
}

type ActivityType =
  | 'bohr_model_intro'
  | 'bohr_model_stability'
  | 'lewis_diagram'
  | 'lewis_structures_covalent'
  | 'lewis_structures_ionic'
  | 'measurement_ruler_tenths'
  | 'measurement_ruler_hundredths'
  | 'measurement_graduated_cylinder'

type Activity = {
  id: string
  title: string
  type: ActivityType
  order_index: number
}

type ClassActivity = {
  id: string
  class_id: string
  activity_id: string
  opens_at: string | null
  closes_at: string | null
  passing_threshold: number
  created_at: string
}

type ProgressStatus = 'not_started' | 'in_progress' | 'completed'

type StudentProgress = {
  id: string
  student_id: string
  class_activity_id: string
  status: ProgressStatus
  started_at: string | null
  completed_at: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const delay = <T>(data: T, ms = 200): Promise<T> =>
  new Promise(resolve => setTimeout(() => resolve(data), ms))

const uuid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockTeachers: Teacher[] = [
  { id: 'teacher-1', email: 'jane@school.edu', display_name: 'Ms. Jane Doe', created_at: '2026-01-10T09:00:00Z' },
]

const mockClasses: Class[] = [
  { id: 'class-1', teacher_id: 'teacher-1', name: 'Chemistry Period 1', section: 'A', class_code: 'ABC123', is_active: true, created_at: '2026-01-15T09:00:00Z' },
  { id: 'class-2', teacher_id: 'teacher-1', name: 'Chemistry Period 2', section: 'B', class_code: 'XYZ789', is_active: true, created_at: '2026-01-15T09:05:00Z' },
]

const mockStudents: Student[] = [
  { id: 'student-1', class_id: 'class-1', first_name: 'Alice',   last_name: 'Smith',   created_at: '2026-01-16T08:00:00Z' },
  { id: 'student-2', class_id: 'class-1', first_name: 'Bob',     last_name: 'Jones',   created_at: '2026-01-16T08:01:00Z' },
  { id: 'student-3', class_id: 'class-2', first_name: 'Charlie', last_name: 'Brown',   created_at: '2026-01-16T08:02:00Z' },
]

const mockActivities: Activity[] = [
  { id: 'activity-1', title: 'Bohr Models: Intro',           type: 'bohr_model_intro',             order_index: 1 },
  { id: 'activity-2', title: 'Bohr Models: Stability',       type: 'bohr_model_stability',         order_index: 2 },
  { id: 'activity-3', title: 'Lewis Diagrams',               type: 'lewis_diagram',                order_index: 3 },
  { id: 'activity-4', title: 'Lewis Structures: Covalent',   type: 'lewis_structures_covalent',    order_index: 4 },
  { id: 'activity-5', title: 'Lewis Structures: Ionic',      type: 'lewis_structures_ionic',       order_index: 5 },
  { id: 'activity-6', title: 'Ruler (Tenths)',               type: 'measurement_ruler_tenths',     order_index: 6 },
  { id: 'activity-7', title: 'Ruler (Hundredths)',           type: 'measurement_ruler_hundredths', order_index: 7 },
  { id: 'activity-8', title: 'Graduated Cylinder',           type: 'measurement_graduated_cylinder', order_index: 8 },
]

const mockClassActivities: ClassActivity[] = [
  { id: 'ca-1', class_id: 'class-1', activity_id: 'activity-1', opens_at: null, closes_at: null, passing_threshold: 70, created_at: '2026-01-16T09:00:00Z' },
  { id: 'ca-2', class_id: 'class-1', activity_id: 'activity-2', opens_at: null, closes_at: null, passing_threshold: 70, created_at: '2026-01-16T09:01:00Z' },
]

const mockStudentProgress: StudentProgress[] = [
  { id: 'sp-1', student_id: 'student-1', class_activity_id: 'ca-1', status: 'completed',   started_at: '2026-02-01T10:00:00Z', completed_at: '2026-02-01T10:25:00Z' },
  { id: 'sp-2', student_id: 'student-1', class_activity_id: 'ca-2', status: 'in_progress', started_at: '2026-02-02T10:00:00Z', completed_at: null },
  { id: 'sp-3', student_id: 'student-2', class_activity_id: 'ca-1', status: 'not_started', started_at: null,                   completed_at: null },
]

// ─── Teachers ─────────────────────────────────────────────────────────────────
// GET /api/teachers/:id

export async function getTeacherById(id: string): Promise<Teacher | null> {
  return delay(mockTeachers.find(t => t.id === id) ?? null)
}

// ─── Classes ──────────────────────────────────────────────────────────────────
// GET /api/classes?teacher_id=
// GET /api/classes/:id
// POST /api/classes
// PATCH /api/classes/:id
// DELETE /api/classes/:id

export async function getClassesByTeacher(teacherId: string): Promise<Class[]> {
  return delay(mockClasses.filter(c => c.teacher_id === teacherId))
}

export async function getClassById(id: string): Promise<Class | null> {
  return delay(mockClasses.find(c => c.id === id) ?? null)
}

export async function createClass(input: {
  teacher_id: string
  name: string
  section: string
  class_code: string
}): Promise<Class> {
  const row: Class = { id: uuid(), is_active: true, created_at: now(), ...input }
  mockClasses.push(row)
  return delay(row)
}

export async function updateClass(id: string, patch: Partial<Pick<Class, 'name' | 'section' | 'is_active'>>): Promise<Class | null> {
  const idx = mockClasses.findIndex(c => c.id === id)
  if (idx === -1) return delay(null)
  mockClasses[idx] = { ...mockClasses[idx], ...patch }
  return delay(mockClasses[idx])
}

export async function deleteClass(id: string): Promise<boolean> {
  const idx = mockClasses.findIndex(c => c.id === id)
  if (idx === -1) return delay(false)
  mockClasses.splice(idx, 1)
  return delay(true)
}

// ─── Students ─────────────────────────────────────────────────────────────────
// GET /api/students?class_id=
// GET /api/students/:id
// POST /api/students
// DELETE /api/students/:id

export async function getStudentsByClass(classId: string): Promise<Student[]> {
  return delay(mockStudents.filter(s => s.class_id === classId))
}

export async function getStudentById(id: string): Promise<Student | null> {
  return delay(mockStudents.find(s => s.id === id) ?? null)
}

export async function createStudent(input: {
  class_id: string
  first_name: string
  last_name: string
}): Promise<Student> {
  const row: Student = { id: uuid(), created_at: now(), ...input }
  mockStudents.push(row)
  return delay(row)
}

export async function deleteStudent(id: string): Promise<boolean> {
  const idx = mockStudents.findIndex(s => s.id === id)
  if (idx === -1) return delay(false)
  mockStudents.splice(idx, 1)
  return delay(true)
}

// ─── Activities ───────────────────────────────────────────────────────────────
// GET /api/activities

export async function getActivities(): Promise<Activity[]> {
  return delay([...mockActivities].sort((a, b) => a.order_index - b.order_index))
}

// ─── Class activities ─────────────────────────────────────────────────────────
// GET /api/class-activities?class_id=
// POST /api/class-activities
// PATCH /api/class-activities/:id

export async function getClassActivitiesByClass(classId: string): Promise<ClassActivity[]> {
  return delay(mockClassActivities.filter(ca => ca.class_id === classId))
}

export async function createClassActivity(input: { class_id: string; activity_id: string }): Promise<ClassActivity> {
  const row: ClassActivity = {
    id: uuid(),
    class_id: input.class_id,
    activity_id: input.activity_id,
    opens_at: null,
    closes_at: null,
    passing_threshold: 70,
    created_at: now(),
  }
  mockClassActivities.push(row)
  return delay(row)
}

export async function updateClassActivity(
  id: string,
  patch: Partial<Pick<ClassActivity, 'opens_at' | 'closes_at' | 'passing_threshold'>>,
): Promise<ClassActivity | null> {
  const idx = mockClassActivities.findIndex(ca => ca.id === id)
  if (idx === -1) return delay(null)
  mockClassActivities[idx] = { ...mockClassActivities[idx], ...patch }
  return delay(mockClassActivities[idx])
}

// ─── Student progress ─────────────────────────────────────────────────────────
// GET /api/student-progress?student_id=
// GET /api/student-progress?class_activity_id=

export async function getProgressByStudent(studentId: string): Promise<StudentProgress[]> {
  return delay(mockStudentProgress.filter(p => p.student_id === studentId))
}

export async function getProgressByClassActivity(classActivityId: string): Promise<StudentProgress[]> {
  return delay(mockStudentProgress.filter(p => p.class_activity_id === classActivityId))
}