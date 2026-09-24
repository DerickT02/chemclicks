import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, expect, it } from 'vitest'

// Creates a disposable class in the configured test project, then deletes only
// that class. Existing teacher/activity records are read-only fixture anchors.
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
let classId: string | undefined
let studentId: string
let assignmentId: string
beforeAll(async () => {
  const { data: teacher, error: teacherError } = await client.from('teachers').select('id').limit(1).single()
  if (teacherError) throw teacherError
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
it('serializes simultaneous starts/retries and makes completion replay-safe', async () => {
  const starts = await Promise.all(Array.from({ length: 6 }, () => transition('start')))
  expect(new Set(starts.map(a => a.id)).size).toBe(1)
  expect(starts[0].attempt_number).toBe(1)
  const completions = await Promise.all(Array.from({ length: 3 }, () => transition('complete', starts[0].id)))
  expect(new Set(completions.map(a => a.completed_at)).size).toBe(1)
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
}, 30000)
