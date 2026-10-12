import 'server-only'
import { getStudentSession } from '@/lib/auth/student-session'
import { createServiceClient } from '@/lib/server/database'
import { getStudentAssignments } from '@/lib/db/student-assignments'
import type { StudentAttempt } from '@/lib/db/student_attempts'

export async function getAssignmentAttempts(assignmentId: string): Promise<StudentAttempt[]> {
  const session = await getStudentSession()
  if (!session) throw new Error('Please sign in as a student.')
  const assignments = await getStudentAssignments()
  if (assignments.status !== 'ok' || !assignments.assignments.some(a => a.id === assignmentId)) throw new Error('Assignment unavailable.')
  const client = createServiceClient()
  const { data: progress, error } = await client.from('student_progress').select('id')
    .eq('student_id', session.studentId).eq('class_activity_id', assignmentId).maybeSingle()
  if (error) throw new Error('Progress could not be loaded.')
  if (!progress) return []
  // Quiz attempts share this progress row; only exploration rows drive the attempt controls.
  const { data, error: attemptError } = await client.from('student_attempts').select('*')
    .eq('progress_id', progress.id).is('quiz_key', null).order('attempt_number', { ascending: false })
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
