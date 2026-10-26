import 'server-only'
import { createServiceClient } from '@/lib/server/database'
import { requireTeacherId } from '@/lib/server/teacher'

export type RosterStudent = {
  id: string
  first_name: string
  last_name: string
  student_id: string
  verified: boolean
}

export type StudentRoster = { pending: RosterStudent[]; active: RosterStudent[] }

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

async function ownedClass(classId: string) {
  const teacherId = await requireTeacherId()
  if (typeof classId !== 'string' || !UUID.test(classId)) throw new Error('Invalid class.')
  const client = createServiceClient()
  const { data, error } = await client.from('classes').select('id')
    .eq('id', classId).eq('teacher_id', teacherId).eq('is_active', true).maybeSingle()
  if (error || !data) throw new Error('Class access denied or unavailable.')
  return client
}

export async function getOwnedStudentRoster(classId: string): Promise<StudentRoster> {
  const client = await ownedClass(classId)
  // Fetch the full roster: counts are derived from the displayed rows, not a separate query.
  // Range pagination avoids silently truncating classes at the API's row limit.
  const students: RosterStudent[] = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from('students')
      .select('id, first_name, last_name, student_id, verified').eq('class_id', classId)
      .order('last_name').order('first_name').order('id').range(offset, offset + pageSize - 1)
    if (error || !data) throw new Error('Student roster could not be loaded. Please try again.')
    students.push(...data as RosterStudent[])
    if (data.length < pageSize) break
  }
  return {
    pending: students.filter(student => student.verified !== true),
    active: students.filter(student => student.verified === true),
  }
}

export async function approveOwnedStudent(classId: string, studentId: string): Promise<void> {
  if (typeof studentId !== 'string' || !UUID.test(studentId)) throw new Error('Invalid student.')
  const client = await ownedClass(classId)
  // Updating the same row to true is idempotent, including concurrent retries.
  // Never insert an account or create an Auth identity during approval.
  const { data, error } = await client.from('students').update({ verified: true })
    .eq('id', studentId).eq('class_id', classId).select('id, verified').maybeSingle()
  if (error || !data || data.verified !== true) {
    throw new Error('Approval could not be confirmed. Refresh the roster and try again.')
  }
}

// Keeps each `id=in.(...)` filter well under PostgREST's URL length limits.
const APPROVAL_BATCH_SIZE = 100

/**
 * Approves the pending students the teacher was shown, not whatever is pending
 * now, so a signup that arrives after the roster loaded stays pending.
 * Returns how many students were approved.
 */
export async function approveOwnedStudents(classId: string, studentIds: string[]): Promise<number> {
  const ids = [...new Set(studentIds)]
  if (ids.length === 0 || ids.some(id => typeof id !== 'string' || !UUID.test(id))) throw new Error('Invalid student.')
  const client = await ownedClass(classId)
  let approved = 0
  for (let offset = 0; offset < ids.length; offset += APPROVAL_BATCH_SIZE) {
    const batch = ids.slice(offset, offset + APPROVAL_BATCH_SIZE)
    const { data, error } = await client.from('students').update({ verified: true })
      .in('id', batch).eq('class_id', classId).select('id, verified')
    // Fewer rows than requested means an ID outside this class; report it rather than a partial success.
    if (error || !data || data.length !== batch.length || data.some(row => row.verified !== true)) {
      throw new Error('Approval could not be confirmed. Refresh the roster and try again.')
    }
    approved += data.length
  }
  return approved
}
