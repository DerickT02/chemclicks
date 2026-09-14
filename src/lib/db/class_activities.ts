import type { SupabaseClient } from '@supabase/supabase-js'

// Logic and types regarding the CLASS_ACTIVITIES table.
export type ClassActivity = {
  id: string                  // UUID, auto-generated
  class_id: string            // UUID, FK → classes.id
  activity_id: string         // UUID, FK → activities.id
  opens_at: string | null     // ISO 8601 timestamp, optional
  closes_at: string | null    // ISO 8601 timestamp, optional
  passing_threshold: number   // 1–100, defaults to 70
  created_at: string          // ISO 8601 timestamp, auto-set
}

export type InsertClassActivity = Pick<ClassActivity, 'class_id' | 'activity_id'> &
Partial<Pick<ClassActivity, 'opens_at' | 'closes_at'>>

export type UpdateClassActivity = Partial<Pick<ClassActivity, 'opens_at' | 'closes_at'>>


const assignmentFields = 'id, class_id, activity_id, opens_at, closes_at, passing_threshold, created_at'

type AssignmentError = {
  code: string
  message: string
}

type AssignmentResult<T> = {
  data: T | null
  error: AssignmentError | null
}

function failure<T>(code: string, message: string): AssignmentResult<T> {
  return { data: null, error: { code, message } }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function validateDates(opensAt: string | null, closesAt: string | null): AssignmentError | null {
  for (const value of [opensAt, closesAt]) {
    if (value === null) continue
    if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value) || !Number.isFinite(Date.parse(value))) {
      return {
        code: 'VALIDATION_ERROR',
        message: 'Dates must be valid timestamps with a timezone.',
      }
    }
  }
  if (opensAt !== null && closesAt !== null && Date.parse(opensAt) >= Date.parse(closesAt)) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'The opening date must be earlier than the closing date.',
    }
  }
  return null
}

export async function getClassActivities(supabase: SupabaseClient,classId: string): Promise<AssignmentResult<ClassActivity[]>> {
  if (!isUuid(classId)) { return failure('VALIDATION_ERROR', 'Select a valid class.') }

  const { data, error } = await supabase
    .from('class_activities')
    .select(assignmentFields)
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
    .order('id')

  if (error) return { data: null, error }
  return { data: data as ClassActivity[], error: null}
}

export async function insertClassActivity(supabase: SupabaseClient, input: InsertClassActivity): Promise<AssignmentResult<ClassActivity>> {
  if (!isUuid(input.class_id) || !isUuid(input.activity_id)) {
    return failure('VALIDATION_ERROR', 'Select a valid class and activity.')
  }

  const opensAt = input.opens_at ?? null
  const closesAt = input.closes_at ?? null
  const dateError = validateDates(opensAt, closesAt)

  if (dateError) return { data: null, error: dateError }

  const { data, error } = await supabase
      .from('class_activities')
      .insert({
        class_id: input.class_id,
        activity_id: input.activity_id,
        opens_at: opensAt,
        closes_at: closesAt,
      })
      .select(assignmentFields)
      .single()

    if (error) return { data: null, error }

    return { data: data as ClassActivity, error: null}
}

export async function updateClassActivity(
  supabase: SupabaseClient,
  assignmentId: string,
  input: UpdateClassActivity,
): Promise<AssignmentResult<ClassActivity>> {
  if (!isUuid(assignmentId)) {
    return failure('VALIDATION_ERROR', 'Select a valid assignment.')
  }

  const patch: UpdateClassActivity = {}

    if (input.opens_at !== undefined) {
      patch.opens_at = input.opens_at
    }

    if (input.closes_at !== undefined) {
      patch.closes_at = input.closes_at
    }

    if (Object.keys(patch).length === 0) {
      return failure('VALIDATION_ERROR', 'Provide dates to update.')
    }

    const { data: existing, error: readError } = await supabase
      .from('class_activities')
      .select(assignmentFields)
      .eq('id', assignmentId)
      .maybeSingle()

    if (readError) return { data: null, error: readError }

    if (!existing) {
      return failure('NOT_FOUND', 'Assignment not found or you do not have access.')
    }

    const current = existing as ClassActivity
    const opensAt = patch.opens_at === undefined ? current.opens_at : patch.opens_at
    const closesAt = patch.closes_at === undefined ? current.closes_at : patch.closes_at
    const dateError = validateDates(opensAt, closesAt)

    if (dateError) return { data: null, error: dateError }

    const { data, error } = await supabase
      .from('class_activities')
      .update(patch)
      .eq('id', assignmentId)
      .select(assignmentFields)
      .maybeSingle()

    if (error) return { data: null, error }

    if (!data) {
      return failure('NOT_FOUND', 'Assignment not found or you do not have access.')
    }

    return {
      data: data as ClassActivity,
      error: null,
    }
  }
