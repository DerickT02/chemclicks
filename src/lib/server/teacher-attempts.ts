import 'server-only'
import { createServiceClient } from '@/lib/server/database'
import { requireTeacherId } from '@/lib/server/teacher'

export type TeacherActivityAttemptSummary = {
  classId: string
  className: string
  assignmentId: string
  activityId: string
  activityTitle: string
  students: {
    studentId: string
    firstName: string
    lastName: string
    verified: boolean
    attemptCount: number
    completedCount: number
    inProgressCount: number
    attempts: {
      id: string
      attemptNumber: number
      status: 'in_progress' | 'completed'
      startedAt: string
      completedAt: string | null
    }[]
  }[]
}

// Includes the entire enrolled roster, even students awaiting verification or progress.
// Timestamps retain their timezone for formatting at the presentation boundary.
export async function getTeacherActivityAttemptSummary(
  classId: string,
  assignmentId: string,
): Promise<TeacherActivityAttemptSummary> {
  const teacherId = await requireTeacherId()
  const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
  if (!uuid.test(classId) || !uuid.test(assignmentId)) {
    throw new Error('Invalid class or assignment.')
  }
  const { data, error } = await createServiceClient().rpc('teacher_activity_attempt_summary', {
    p_teacher_id: teacherId,
    p_class_id: classId,
    p_assignment_id: assignmentId,
  })
  if (error || !data) throw new Error('Activity summary access denied or unavailable.')
  return data as TeacherActivityAttemptSummary
}
