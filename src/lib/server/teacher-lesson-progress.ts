import 'server-only'
import { createServiceClient } from '@/lib/server/database'
import { requireTeacherId } from '@/lib/server/teacher'
import { normalizeAssignmentProgress, type AssignmentProgressFacts } from '@/lib/assignments/progress'
import type { AssignmentStage } from '@/lib/assignments/stages'

type LessonStatus = 'not_started' | 'in_progress' | 'completed'

export type LessonProgressResponse = {
  classId: string
  className: string
  students: {
    studentId: string
    firstName: string
    lastName: string
    verified: boolean
    overallPercent: number
    // stage and the timing/result facts are absent until the stage
    // migration (20261104000200) reaches the database.
    lessons: ({
      assignmentId: string
      activityId: string
      activityTitle: string
      status: LessonStatus
      stage?: AssignmentStage
      quizStartedAt?: string | null
    } & Partial<Omit<AssignmentProgressFacts, 'stage'>>)[]
  }[]
}

type Student = LessonProgressResponse['students'][number]
type Lesson = Student['lessons'][number]

export type TeacherClassLessonProgress = Omit<LessonProgressResponse, 'students'> & {
  students: (Omit<Student, 'lessons'> & {
    lessons: (Pick<Lesson, 'assignmentId' | 'activityId' | 'activityTitle'> & {
      progress: AssignmentProgressFacts
    })[]
  })[]
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
  if (error || !data) {
    throw new Error('Class progress access denied or unavailable.')
  }
  return normalizeTeacherClassLessonProgress(data as LessonProgressResponse)
}

/** Shared with the live class updates, which read the same rows through another RPC. */
export function normalizeTeacherClassLessonProgress(response: LessonProgressResponse): TeacherClassLessonProgress {
  return {
    ...response,
    students: response.students.map(student => ({
      ...student,
      lessons: student.lessons.map(lesson => ({
        assignmentId: lesson.assignmentId,
        activityId: lesson.activityId,
        activityTitle: lesson.activityTitle,
        progress: normalizeAssignmentProgress(lesson, lesson.status),
      })),
    })),
  }
}
