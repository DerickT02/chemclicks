import 'server-only'
import { getStudentSession } from '@/lib/auth/student-session'
import { createServiceClient } from '@/lib/server/database'
import type { StudentAttempt } from '@/lib/db/student_attempts'

// Session identity is never accepted as an argument from the browser.
async function accessAttempts(progressId: string, create: boolean): Promise<StudentAttempt[]> {
  const session = await getStudentSession()
  if (!session) throw new Error('A student session is required.')
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(progressId)) {
    throw new Error('Invalid progress record.')
  }
  const { data, error } = await createServiceClient().rpc('student_attempt_access', {
    p_student_id: session.studentId,
    p_class_id: session.classId,
    p_progress_id: progressId,
    p_create: create,
  })
  if (error) throw new Error('Attempt access denied or unavailable.')
  return data as StudentAttempt[]
}

export async function readStudentAttempts(progressId: string): Promise<StudentAttempt[]> {
  return accessAttempts(progressId, false)
}

export async function createStudentAttempt(progressId: string): Promise<StudentAttempt> {
  const attempts = await accessAttempts(progressId, true)
  if (attempts.length !== 1) throw new Error('Attempt could not be created.')
  return attempts[0]
}
