import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, expect, it } from 'vitest'

// Creates a disposable class in the configured test project, then deletes only
// that class. Existing teacher/activity records are read-only fixture anchors.
// Complements assign_while_pending.sql's single-transaction, sequential proof
// with real overlapping requests over independent connections: a teacher
// assigning the activity races a student's approval and a brand-new signup.
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const other = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let classId: string
let activityId: string
let pendingId: string

beforeAll(async () => {
  const { data: teacher, error: teacherError } = await client.from('teachers').select('id').limit(1).single()
  if (teacherError) throw teacherError
  const { data: activity, error: activityError } = await client.from('activities').select('id').eq('type', 'lewis_diagram').limit(1).single()
  if (activityError) throw activityError
  activityId = activity.id
  const { data: classroom, error: classError } = await client.from('classes').insert({
    teacher_id: teacher.id, name: 'Assign while pending concurrency test', section: 'Test',
    class_code: randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase(),
  }).select('id').single()
  if (classError) throw classError
  classId = classroom.id
  const { data: pending, error: pendingError } = await client.from('students').insert({
    class_id: classId, first_name: 'Race', last_name: 'Pending', student_id: `test-${randomUUID()}`, verified: false,
  }).select('id').single()
  if (pendingError) throw pendingError
  pendingId = pending.id
})
afterAll(async () => {
  if (classId) {
    const { error } = await client.from('classes').delete().eq('id', classId)
    if (error) throw error
  }
})

it('settles an assignment created concurrently with an approval and a new signup into one consistent state', async () => {
  const [assignResult, approveResult, signupResult, ...retries] = await Promise.all([
    client.from('class_activities').insert({ class_id: classId, activity_id: activityId }).select('id').single(),
    other.from('students').update({ verified: true }).eq('id', pendingId).eq('class_id', classId).select('id, verified').single(),
    other.from('students').insert({
      class_id: classId, first_name: 'Race', last_name: 'Latecomer', student_id: `test-${randomUUID()}`, verified: false,
    }).select('id').single(),
    // The same approval fired again at the same instant must not fail or double-apply.
    client.from('students').update({ verified: true }).eq('id', pendingId).eq('class_id', classId).select('id, verified').single(),
    other.from('students').update({ verified: true }).eq('id', pendingId).eq('class_id', classId).select('id, verified').single(),
  ])

  expect(assignResult.error).toBeNull()
  expect(approveResult.error).toBeNull()
  expect(signupResult.error).toBeNull()
  for (const retry of retries) expect(retry.error).toBeNull()
  const assignmentId = assignResult.data!.id
  const lateId = signupResult.data!.id

  // Exactly one assignment exists for this class/activity, however many
  // concurrent requests raced to create or read it.
  const { data: assignments, error: assignmentsError } = await client.from('class_activities')
    .select('id').eq('class_id', classId).eq('activity_id', activityId).is('archived_at', null)
  expect(assignmentsError).toBeNull()
  expect(assignments).toHaveLength(1)
  expect(assignments![0].id).toBe(assignmentId)

  // The approved student is verified exactly once; the concurrent signup stays pending.
  const { data: students, error: studentsError } = await client.from('students')
    .select('id, verified').eq('class_id', classId).order('id')
  expect(studentsError).toBeNull()
  expect(students).toEqual(expect.arrayContaining([
    { id: pendingId, verified: true },
    { id: lateId, verified: false },
  ]))
  expect(students).toHaveLength(2)

  // Both the approved student and (after their own later approval) the
  // latecomer see the assignment purely through class_id, with no grant step.
  await client.from('students').update({ verified: true }).eq('id', lateId)
  for (const studentId of [pendingId, lateId]) {
    const { data: student, error } = await client.from('students').select('class_id').eq('id', studentId).single()
    expect(error).toBeNull()
    const { data: visible, error: visibleError } = await client.from('class_activities')
      .select('id').eq('class_id', student!.class_id).eq('id', assignmentId).is('archived_at', null).maybeSingle()
    expect(visibleError).toBeNull()
    expect(visible).toEqual({ id: assignmentId })
  }

  // Approval and registration never fabricated progress or attempt rows.
  const { count, error: progressError } = await client.from('student_progress')
    .select('id', { count: 'exact', head: true }).in('student_id', [pendingId, lateId])
  expect(progressError).toBeNull()
  expect(count).toBe(0)
}, 30000)
