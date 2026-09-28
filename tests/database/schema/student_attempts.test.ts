import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// These tests WRITE fixtures. Use a dedicated test Supabase project.
// Service role bypasses RLS: this suite validates schema, not access policies.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

let classId: string | undefined
let progressId: string
let otherProgressId: string
let nextNumber = 1

beforeAll(async () => {
  const { data: teacher, error: teacherError } = await supabase
    .from('teachers').select('id').limit(1).single()
  if (teacherError) throw teacherError
  const { data: activity, error: activityError } = await supabase
    .from('activities').select('id').limit(1).single()
  if (activityError) throw activityError

  const code = randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()
  const { data: classroom, error: classError } = await supabase.from('classes')
    .insert({ teacher_id: teacher.id, name: 'Attempt schema test', section: code, class_code: code })
    .select('id').single()
  if (classError) throw classError
  classId = classroom.id

  const { data: assignment, error: assignmentError } = await supabase.from('class_activities')
    .insert({ class_id: classId, activity_id: activity.id }).select('id').single()
  if (assignmentError) throw assignmentError

  const ids: string[] = []
  for (const firstName of ['Alice', 'Bob']) {
    const { data: student, error: studentError } = await supabase.from('students')
      .insert({ class_id: classId, first_name: firstName, last_name: 'Test', student_id: `test-${randomUUID()}` })
      .select('id').single()
    if (studentError) throw studentError
    const { data: progress, error: progressError } = await supabase.from('student_progress')
      .insert({ student_id: student.id, class_activity_id: assignment.id }).select('id').single()
    if (progressError) throw progressError
    ids.push(progress.id)
  }
  ;[progressId, otherProgressId] = ids
})

afterAll(async () => {
  if (classId) {
    const { error } = await supabase.from('classes').delete().eq('id', classId)
    if (error) throw error
  }
})

function insertAttempt(overrides: Record<string, unknown> = {}) {
  return supabase.from('student_attempts')
    .insert({ progress_id: progressId, attempt_number: nextNumber++, ...overrides })
    .select('*').single()
}

describe('student_attempts table schema', () => {
  it('generates defaults and retrieves an attempt by progress record', async () => {
    const { data, error } = await insertAttempt()
    expect(error).toBeNull()
    expect(data.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(data.status).toBe('in_progress')
    expect(data.completed_at).toBeNull()
    for (const field of ['started_at', 'created_at', 'updated_at']) {
      expect(Number.isFinite(Date.parse(data[field]))).toBe(true)
    }
    const { data: rows, error: readError } = await supabase.from('student_attempts')
      .select('*').eq('progress_id', progressId).eq('id', data.id)
    expect(readError).toBeNull()
    expect(rows).toEqual([data])
  })

  it('allows multiple attempts but rejects duplicate numbers within a progress record', async () => {
    const number = nextNumber++
    expect((await insertAttempt({ attempt_number: number })).error).toBeNull()
    expect((await insertAttempt({ attempt_number: nextNumber++ })).error).toBeNull()
    expect((await insertAttempt({ attempt_number: number })).error?.code).toBe('23505')
    expect((await insertAttempt({ progress_id: otherProgressId, attempt_number: number })).error).toBeNull()
  })

  it.each(['progress_id', 'attempt_number', 'status', 'started_at', 'created_at', 'updated_at'])
    ('rejects null %s', async (field) => {
      expect((await insertAttempt({ [field]: null })).error?.code).toBe('23502')
    })

  it.each(['progress_id', 'attempt_number'])('rejects omitted %s', async (field) => {
    const values: Record<string, unknown> = { progress_id: progressId, attempt_number: nextNumber++ }
    delete values[field]
    const { error } = await supabase.from('student_attempts').insert(values)
    expect(error?.code).toBe('23502')
  })

  it('rejects orphaned attempts', async () => {
    expect((await insertAttempt({ progress_id: randomUUID() })).error?.code).toBe('23503')
  })

  it.each([
    { attempt_number: 0 },
    { attempt_number: -1 },
    { status: 'invalid' },
    { status: 'completed' },
    { completed_at: '2026-09-24T12:00:00Z' },
    { status: 'completed', started_at: '2026-09-24T12:00:00Z', completed_at: '2026-09-24T11:00:00Z' },
  ])('rejects invalid attempt state %j', async (values) => {
    expect((await insertAttempt(values)).error?.code).toBe('23514')
  })

  it('completes an attempt and refreshes updated_at without changing created_at', async () => {
    const { data: original, error } = await insertAttempt({
      started_at: '2026-01-01T12:00:00Z', updated_at: '2026-01-01T12:00:00Z',
    })
    expect(error).toBeNull()
    const { data: updated, error: updateError } = await supabase.from('student_attempts')
      .update({ status: 'completed', completed_at: '2026-01-01T12:05:00Z', updated_at: original.updated_at })
      .eq('id', original.id).select('*').single()
    expect(updateError).toBeNull()
    expect(updated.status).toBe('completed')
    expect(Date.parse(updated.completed_at)).toBe(Date.parse('2026-01-01T12:05:00Z'))
    expect(Date.parse(updated.updated_at)).toBeGreaterThan(Date.parse(original.updated_at))
    expect(updated.created_at).toBe(original.created_at)
  })

  it('cascades deletion from a progress record to its attempts', async () => {
    const { data, error } = await insertAttempt({ progress_id: otherProgressId })
    expect(error).toBeNull()
    const { error: deleteError } = await supabase.from('student_progress').delete().eq('id', otherProgressId)
    expect(deleteError).toBeNull()
    const { data: remaining, error: readError } = await supabase.from('student_attempts')
      .select('id').eq('id', data.id)
    expect(readError).toBeNull()
    expect(remaining).toEqual([])
  })
})
