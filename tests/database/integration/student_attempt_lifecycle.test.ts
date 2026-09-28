import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { TeacherActivityAttemptSummary } from '@/lib/server/teacher-attempts'

// Creates a disposable class in the configured test project, then deletes only
// that class. Existing teacher/activity records are read-only fixture anchors.
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
let classId: string | undefined
let teacherId: string
let zeroStudentId: string
let studentId: string
let assignmentId: string
beforeAll(async () => {
  const { data: teacher, error: teacherError } = await client.from('teachers').select('id').limit(1).single()
  if (teacherError) throw teacherError
  teacherId = teacher.id
  const { data: activity, error: activityError } = await client.from('activities').select('id').eq('type', 'lewis_diagram').limit(1).single()
  if (activityError) throw activityError
  const { data: classroom, error: classError } = await client.from('classes').insert({
    teacher_id: teacher.id, name: 'Attempt concurrency test', section: 'Test',
    class_code: randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase(),
  }).select('id').single()
  if (classError) throw classError
  classId = classroom.id
  const { data: student, error: studentError } = await client.from('students').insert({
    class_id: classId, first_name: 'Concurrency', last_name: 'Test', student_id: `test-${randomUUID()}`, verified: true,
  }).select('id').single()
  if (studentError) throw studentError
  studentId = student.id
  const { data: zeroStudent, error: zeroError } = await client.from('students').insert({
    class_id: classId, first_name: 'Zero', last_name: 'Test', student_id: `test-${randomUUID()}`, verified: true,
  }).select('id').single()
  if (zeroError) throw zeroError
  zeroStudentId = zeroStudent.id
  const { data: assignment, error: assignmentError } = await client.from('class_activities').insert({
    class_id: classId, activity_id: activity.id,
  }).select('id').single()
  if (assignmentError) throw assignmentError
  assignmentId = assignment.id
})
afterAll(async () => {
  if (classId) {
    const { error } = await client.from('classes').delete().eq('id', classId)
    if (error) throw error
  }
})
async function transition(action: string, attemptId: string | null = null) {
  const { data, error } = await client.rpc('student_attempt_transition', {
    p_student_id: studentId, p_class_id: classId, p_assignment_id: assignmentId,
    p_action: action, p_attempt_id: attemptId,
  })
  if (error) throw error
  expect(data).toHaveLength(1)
  return data[0] as { id: string; progress_id: string; attempt_number: number; completed_at: string | null; status: string }
}
async function expectReport(count: number, completed: number, active: number) {
  const { data, error } = await client.rpc('teacher_activity_attempt_summary', {
    p_teacher_id: teacherId, p_class_id: classId, p_assignment_id: assignmentId,
  })
  expect(error).toBeNull()
  const report = data as TeacherActivityAttemptSummary
  expect(report.classId).toBe(classId)
  expect(report.assignmentId).toBe(assignmentId)
  expect(report.students).toHaveLength(2)
  const student = report.students.find(row => row.studentId === studentId)!
  expect(student).toMatchObject({ attemptCount: count, completedCount: completed, inProgressCount: active })
  expect(student.attempts).toHaveLength(count)
  expect(report.students.find(row => row.studentId === zeroStudentId)).toMatchObject({
    attemptCount: 0, completedCount: 0, inProgressCount: 0, attempts: [],
  })
  return student
}
it('reports zero, one and multiple attempts through concurrent starts, completion and retries', async () => {
  await expectReport(0, 0, 0)
  const starts = await Promise.all(Array.from({ length: 6 }, () => transition('start')))
  expect(new Set(starts.map(a => a.id)).size).toBe(1)
  expect(starts[0].attempt_number).toBe(1)
  const started = await expectReport(1, 0, 1)
  expect(started.attempts[0]).toMatchObject({ id: starts[0].id, status: 'in_progress', completedAt: null })
  const completions = await Promise.all(Array.from({ length: 3 }, () => transition('complete', starts[0].id)))
  expect(new Set(completions.map(a => a.completed_at)).size).toBe(1)
  const completed = await expectReport(1, 1, 0)
  expect(Date.parse(completed.attempts[0].completedAt!)).toBe(Date.parse(completions[0].completed_at!))
  expect(completed.attempts[0].startedAt).toBe(started.attempts[0].startedAt)
  const retries = await Promise.all(Array.from({ length: 6 }, () => transition('retry', starts[0].id)))
  expect(new Set(retries.map(a => a.id)).size).toBe(1)
  expect(retries[0].attempt_number).toBe(2)
  await transition('complete', starts[0].id)
  const { data: progress, error } = await client.from('student_progress').select('status, completed_at').eq('id', starts[0].progress_id).single()
  expect(error).toBeNull()
  expect(progress).toEqual({ status: 'in_progress', completed_at: null })
  const { count, error: countError } = await client.from('student_attempts').select('id', { count: 'exact', head: true }).eq('progress_id', starts[0].progress_id)
  expect(countError).toBeNull()
  expect(count).toBe(2)
  const retried = await expectReport(2, 1, 1)
  expect(retried.attempts.map(a => a.id)).toEqual([retries[0].id, starts[0].id])
  expect(retried.attempts[1].completedAt).toBe(completed.attempts[0].completedAt)
  const resumed = await transition('start')
  expect(resumed.id).toBe(retries[0].id)
  await transition('complete', resumed.id)
  await expectReport(2, 2, 0)
  for (const scope of [
    { p_teacher_id: randomUUID(), p_class_id: classId, p_assignment_id: assignmentId },
    { p_teacher_id: teacherId, p_class_id: randomUUID(), p_assignment_id: assignmentId },
    { p_teacher_id: teacherId, p_class_id: classId, p_assignment_id: randomUUID() },
  ]) {
    const denied = await client.rpc('teacher_activity_attempt_summary', scope)
    expect(denied.error?.code).toBe('42501')
    expect(denied.data).toBeNull()
  }
}, 30000)
