import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ client: vi.fn(), user: vi.fn(), update: vi.fn(), inFilter: vi.fn() }))
vi.mock('@/lib/server/database', () => ({ createServiceClient: mocks.client }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  ...mocks.client(), auth: { getUser: mocks.user },
}) }))

import { approveOwnedStudent, approveOwnedStudents, getOwnedStudentRoster } from '@/lib/server/student-roster'

const classId = '11111111-1111-4111-8111-111111111111'
const otherClassId = '22222222-2222-4222-8222-222222222222'
const studentId = '33333333-3333-4333-8333-333333333333'
const otherStudentId = '44444444-4444-4444-8444-444444444444'
type Row = Record<string, unknown>
let tables: Record<string, Row[]>
let failRead: boolean
let failSave: boolean
let teacherId: string

// Stateful local database substitute: filters actually apply and updates persist.
// No Supabase credentials, requests, or writes to a real project.
function from(table: string) {
  const filters: [string, (value: unknown) => boolean][] = []
  let update: Row | undefined
  const result = () => {
    const rows = tables[table].filter(row => filters.every(([key, matches]) => matches(row[key])))
    if (update && failSave) return { data: null, error: { message: 'private save failure' } }
    if (table === 'students' && failRead && !update && filters.some(([key]) => key === 'class_id')) return { data: null, error: { message: 'private read failure' } }
    if (update) rows.forEach(row => Object.assign(row, update))
    return { data: rows, error: null }
  }
  const chain = {
    select: () => chain,
    eq: (key: string, value: unknown) => { filters.push([key, row => row === value]); return chain },
    in: (key: string, values: unknown[]) => { mocks.inFilter(values); filters.push([key, row => values.includes(row)]); return chain },
    order: () => chain,
    update: (value: Row) => { mocks.update(value); update = value; return chain },
    maybeSingle: async () => {
      const { data, error } = result()
      return { data: data?.[0] ?? null, error }
    },
    range: async (start: number, end: number) => {
      const { data, error } = result()
      return { data: data?.slice(start, end + 1) ?? null, error }
    },
    // Awaiting the chain itself returns every matching row, as PostgREST does.
    then: (resolve: (value: ReturnType<typeof result>) => unknown) => resolve(result()),
  }
  return chain
}

beforeEach(() => {
  vi.resetAllMocks()
  failRead = false; failSave = false; teacherId = 'owner'
  tables = {
    teachers: [{ id: 'owner' }, { id: 'other-teacher' }, { id: 'student-user' }],
    classes: [
      { id: classId, teacher_id: 'owner', is_active: true },
      { id: otherClassId, teacher_id: 'other-teacher', is_active: true },
    ],
    students: [
      { id: studentId, class_id: classId, first_name: 'Alex', last_name: 'Waiting', student_id: 'TEST1', verified: false, auth_user_id: null },
      { id: otherStudentId, class_id: otherClassId, first_name: 'Jo', last_name: 'Other', student_id: 'TEST2', verified: false, auth_user_id: 'student-user' },
    ],
  }
  mocks.client.mockReturnValue({ from })
  mocks.user.mockImplementation(async () => ({ data: { user: teacherId ? { id: teacherId, email_confirmed_at: 'now' } : null }, error: null }))
})

describe('owned class student roster and approval', () => {
  it('places a new signup only in Pending with its names and Student ID', async () => {
    const roster = await getOwnedStudentRoster(classId)
    expect(roster.pending).toEqual([expect.objectContaining({ id: studentId, first_name: 'Alex', last_name: 'Waiting', student_id: 'TEST1' })])
    expect(roster.active).toEqual([])
  })

  it('persists approval on the same account across fresh reads and concurrent retries', async () => {
    const before = await getOwnedStudentRoster(classId)
    await Promise.all([approveOwnedStudent(classId, studentId), approveOwnedStudent(classId, studentId)])
    await approveOwnedStudent(classId, studentId)
    const refreshed = await getOwnedStudentRoster(classId)
    expect(refreshed.pending).toHaveLength(0)
    expect(refreshed.active).toEqual([expect.objectContaining({ id: before.pending[0].id, verified: true })])
    expect(tables.students).toHaveLength(2)
    expect(tables.students[0].auth_user_id).toBeNull()
    expect(mocks.update).toHaveBeenCalledWith({ verified: true })
  })

  it.each(['other-teacher', 'student-user', ''])('refuses roster reads and direct approval by %j', async caller => {
    teacherId = caller
    await expect(getOwnedStudentRoster(classId)).rejects.toThrow()
    await expect(approveOwnedStudent(classId, studentId)).rejects.toThrow()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(tables.students[0].verified).toBe(false)
  })

  it('rejects a student even if a legacy profile owns a class', async () => {
    teacherId = 'student-user'
    tables.classes[0].teacher_id = teacherId
    await expect(getOwnedStudentRoster(classId)).rejects.toThrow('teacher account')
    await expect(approveOwnedStudent(classId, studentId)).rejects.toThrow('teacher account')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('refuses a foreign class and a foreign student ID submitted with an owned class', async () => {
    await expect(getOwnedStudentRoster(otherClassId)).rejects.toThrow('access denied')
    await expect(approveOwnedStudent(otherClassId, otherStudentId)).rejects.toThrow('access denied')
    await expect(approveOwnedStudent(classId, otherStudentId)).rejects.toThrow('could not be confirmed')
    expect(tables.students[1].verified).toBe(false)
  })

  it('refuses disabled classes and invalid identifiers', async () => {
    tables.classes[0].is_active = false
    await expect(getOwnedStudentRoster(classId)).rejects.toThrow('access denied')
    await expect(approveOwnedStudent(classId, studentId)).rejects.toThrow('access denied')
    await expect(getOwnedStudentRoster('invalid')).rejects.toThrow('Invalid class')
    await expect(approveOwnedStudent(classId, 'invalid')).rejects.toThrow('Invalid student')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('does not report failed saves as approved and allows retry', async () => {
    failSave = true
    await expect(approveOwnedStudent(classId, studentId)).rejects.toThrow('could not be confirmed')
    expect((await getOwnedStudentRoster(classId)).pending).toHaveLength(1)
    failSave = false
    await approveOwnedStudent(classId, studentId)
    expect((await getOwnedStudentRoster(classId)).active).toHaveLength(1)
  })

  it('distinguishes empty rosters from failed reads without leaking errors', async () => {
    tables.students = []
    expect(await getOwnedStudentRoster(classId)).toEqual({ pending: [], active: [] })
    failRead = true
    await expect(getOwnedStudentRoster(classId)).rejects.toThrow('Student roster could not be loaded. Please try again.')
  })

  it('does not truncate lists or counts at one API page', async () => {
    tables.students = Array.from({ length: 501 }, (_, index) => ({
      id: String(index), class_id: classId, first_name: 'Test', last_name: 'Student', student_id: `TEST${index}`, verified: index % 2 === 0,
    }))
    const roster = await getOwnedStudentRoster(classId)
    expect(roster.pending).toHaveLength(250)
    expect(roster.active).toHaveLength(251)
  })

  it('approves every listed pending student in one request and leaves later signups pending', async () => {
    const lateId = '55555555-5555-4555-8555-555555555555'
    const secondId = '66666666-6666-4666-8666-666666666666'
    tables.students.push(
      { id: secondId, class_id: classId, first_name: 'Sam', last_name: 'Waiting', student_id: 'TEST3', verified: false, auth_user_id: null },
      { id: lateId, class_id: classId, first_name: 'Late', last_name: 'Signup', student_id: 'TEST4', verified: false, auth_user_id: null },
    )
    expect(await approveOwnedStudents(classId, [studentId, secondId, studentId])).toBe(2)
    expect(await approveOwnedStudents(classId, [studentId, secondId])).toBe(2)
    const roster = await getOwnedStudentRoster(classId)
    expect(roster.active.map(student => student.id).sort()).toEqual([studentId, secondId].sort())
    expect(roster.pending.map(student => student.id)).toEqual([lateId])
    expect(tables.students).toHaveLength(4)
  })

  it('splits large bulk approvals into bounded requests', async () => {
    const ids = Array.from({ length: 250 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`)
    tables.students = ids.map(id => ({ id, class_id: classId, first_name: 'Test', last_name: 'Student', student_id: id, verified: false }))
    expect(await approveOwnedStudents(classId, ids)).toBe(250)
    expect(mocks.inFilter.mock.calls.map(([values]) => values.length)).toEqual([100, 100, 50])
    expect((await getOwnedStudentRoster(classId)).pending).toHaveLength(0)
  })

  it('refuses bulk approval for foreign students, other callers, and invalid input', async () => {
    await expect(approveOwnedStudents(classId, [studentId, otherStudentId])).rejects.toThrow('could not be confirmed')
    expect(tables.students[1].verified).toBe(false)
    await expect(approveOwnedStudents(classId, [])).rejects.toThrow('Invalid student')
    await expect(approveOwnedStudents(classId, ['invalid'])).rejects.toThrow('Invalid student')
    // The owned row in that request may already be saved; the refreshed roster shows it.
    teacherId = 'other-teacher'
    tables.students[0].verified = false
    await expect(approveOwnedStudents(classId, [studentId])).rejects.toThrow('access denied')
    expect(tables.students[0].verified).toBe(false)
  })
})
