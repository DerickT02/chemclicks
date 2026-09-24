import 'server-only'
import { getStudentSession } from '@/lib/auth/student-session'
import { createServiceClient } from '@/lib/server/database'
import type { Activity } from '@/lib/db/activities'
import type { StudentAttempt } from '@/lib/db/student_attempts'

export type StudentAssignment = {
  id: string
  opens_at: string | null
  closes_at: string | null
  activities: Pick<Activity, 'title' | 'type'>
}

export async function getStudentAssignments(): Promise<StudentAssignment[]> {
  const session = await getStudentSession()
  if (!session) throw new Error('Please sign in as a student.')
  const client = createServiceClient()
  const { data: student, error } = await client.from('students')
    .select('id, classes!inner(is_active)').eq('id', session.studentId)
    .eq('class_id', session.classId).eq('verified', true).eq('classes.is_active', true).maybeSingle()
  if (error || !student) throw new Error('Your classroom is unavailable. Please contact your teacher.')
  const { data, error: assignmentError } = await client.from('class_activities')
    .select('id, opens_at, closes_at, activities!inner(title, type)').eq('class_id', session.classId)
    .order('created_at')
  if (assignmentError) throw new Error('Assignments could not be loaded. Please try again.')
  return data as unknown as StudentAssignment[]
}

export async function getAssignmentAttempts(assignmentId: string): Promise<StudentAttempt[]> {
  const session = await getStudentSession()
  if (!session) throw new Error('Please sign in as a student.')
  const assignments = await getStudentAssignments()
  if (!assignments.some(a => a.id === assignmentId)) throw new Error('Assignment unavailable.')
  const client = createServiceClient()
  const { data: progress, error } = await client.from('student_progress').select('id')
    .eq('student_id', session.studentId).eq('class_activity_id', assignmentId).maybeSingle()
  if (error) throw new Error('Progress could not be loaded.')
  if (!progress) return []
  const { data, error: attemptError } = await client.from('student_attempts').select('*')
    .eq('progress_id', progress.id).order('attempt_number', { ascending: false })
  if (attemptError) throw new Error('Attempts could not be loaded.')
  return data as StudentAttempt[]
}

export type AttemptAction = 'start' | 'complete' | 'retry'

export async function transitionStudentAttempt(
  assignmentId: string, action: AttemptAction, attemptId?: string,
): Promise<StudentAttempt> {
  const session = await getStudentSession()
  if (!session) throw new Error('Please sign in as a student.')
  const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
  if (!uuid.test(assignmentId) || !['start', 'complete', 'retry'].includes(action)
    || (action !== 'start' && (!attemptId || !uuid.test(attemptId)))) {
    throw new Error('Invalid attempt request.')
  }
  const { data, error } = await createServiceClient().rpc('student_attempt_transition', {
    p_student_id: session.studentId, p_class_id: session.classId,
    p_assignment_id: assignmentId, p_action: action, p_attempt_id: attemptId ?? null,
  })
  if (error || !data || data.length !== 1) {
    throw new Error('Could not save. The assignment may have closed or your access may have changed. Refresh and try again.')
  }
  return data[0] as StudentAttempt
}
