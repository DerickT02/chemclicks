import 'server-only'
import { createServiceClient } from '@/lib/server/database'
import { requireTeacherId } from '@/lib/server/teacher'

export type LessonStatus = 'not_started' | 'in_progress' | 'completed'

export type TeacherClassLessonProgress = {
  classId: string
  className: string
  students: {
    studentId: string
    firstName: string
    lastName: string
    verified: boolean
    overallPercent: number
    lessons: {
      assignmentId: string
      activityId: string
      activityTitle: string
      status: LessonStatus
    }[]
  }[]
}

const UUID_PATTERN = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

// Named, per-lesson progress for every enrolled student in a teacher-owned
// class. The server verifies the Auth session and supplies its teacher
// identity; the database function independently re-checks class ownership.
export async function getTeacherClassLessonProgress(
  classId: string,
): Promise<TeacherClassLessonProgress> {
  const teacherId = await requireTeacherId()
  if (!UUID_PATTERN.test(classId)) {
    throw new Error('Invalid class.')
  }
  const { data, error } = await createServiceClient().rpc('teacher_class_lesson_progress', {
    p_teacher_id: teacherId,
    p_class_id: classId,
  })
  if (error || !data) throw new Error('Class progress access denied or unavailable.')
  return data as TeacherClassLessonProgress
}
