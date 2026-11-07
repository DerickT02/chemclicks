import 'server-only'
import { createServiceClient } from '@/lib/server/database'
import { requireTeacherId } from '@/lib/server/teacher'
import type { AssignmentStage } from '@/lib/assignments/stages'
import { normalizeAssignmentProgress, type AssignmentProgressFacts } from '@/lib/assignments/progress'

type AttemptSummaryResponse = {
  classId: string
  className: string
  assignmentId: string
  activityId: string
  activityTitle: string
  students: ({
    studentId: string
    firstName: string
    lastName: string
    verified: boolean
    attemptCount: number
    explorationAttemptCount?: number
    quizAttemptCount?: number
    completedCount: number
    inProgressCount: number
    overallStatus: 'not_started' | 'exploring' | 'taking_quiz' | 'needs_retry' | 'completed'
    // Shared stage from assignment_progress_state (20261104000200); absent on
    // databases without that migration.
    progressStage?: AssignmentStage
    passingQuizCompletedAt?: string | null
    quizStartedAt?: string | null
    attempts: {
      id: string
      attemptNumber: number
      status: 'in_progress' | 'completed'
      startedAt: string
      completedAt: string | null
      kind?: 'exploration' | 'quiz'
      quizKey?: string | null
      instrument?: 'ruler' | 'cylinder' | null
      precisionMode?: 'whole' | 'tenths' | 'hundredths' | null
      score?: number | null
      questionTotal?: number | null
      percentage?: number | null
      passed?: boolean | null
    }[]
  } & Partial<Omit<AssignmentProgressFacts, 'stage'>>)[]
}

type Student = AttemptSummaryResponse['students'][number]
type Attempt = Student['attempts'][number]

// An attempt without a readable start time sorts last, matching the report's
// NULLS LAST ordering, instead of making the comparison inconsistent.
function newestStartFirst(a: Attempt, b: Attempt): number {
  const aMs = Date.parse(a.startedAt)
  const bMs = Date.parse(b.startedAt)
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) return Number(Number.isNaN(aMs)) - Number(Number.isNaN(bMs))
  return bMs - aMs
}

export type TeacherActivityAttemptSummary = Omit<AttemptSummaryResponse, 'students'> & {
  students: (Pick<Student,
    'studentId' | 'firstName' | 'lastName' | 'verified' | 'attemptCount'
    | 'completedCount' | 'inProgressCount' | 'attempts'
  > & {
    explorationAttemptCount: number
    quizAttemptCount: number
    quizStartedAt: string | null
    progress: AssignmentProgressFacts
  })[]
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
  const client = createServiceClient()
  const { data: classroom, error: classError } = await client.from('classes')
    .select('id').eq('id', classId).eq('teacher_id', teacherId)
    .eq('is_active', true).maybeSingle()
  if (classError || !classroom) throw new Error('Class access denied or unavailable.')
  const { data, error } = await client.rpc('teacher_activity_attempt_summary', {
    p_teacher_id: teacherId,
    p_class_id: classId,
    p_assignment_id: assignmentId,
  })
  if (error || !data) throw new Error('Activity summary access denied or unavailable.')
  const response = data as AttemptSummaryResponse
  return {
    ...response,
    students: response.students.map(student => ({
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      verified: student.verified,
      attemptCount: student.attemptCount,
      completedCount: student.completedCount,
      inProgressCount: student.inProgressCount,
      // Attempt numbers restart for each quiz key (and for exploration).
      attempts: [...student.attempts].sort(newestStartFirst),
      explorationAttemptCount: student.explorationAttemptCount
        ?? student.attempts.filter(attempt => attempt.kind === 'exploration'
          || (attempt.kind === undefined && attempt.quizKey == null)).length,
      quizAttemptCount: student.quizAttemptCount
        ?? student.attempts.filter(attempt => attempt.kind === 'quiz'
          || (attempt.kind === undefined && attempt.quizKey != null)).length,
      quizStartedAt: student.quizStartedAt ?? null,
      progress: normalizeAssignmentProgress({
        ...student,
        stage: student.progressStage,
        // Older RPCs expose the passing timestamp under a different key.
        completedAt: student.completedAt === undefined
          ? student.passingQuizCompletedAt : student.completedAt,
      }, student.overallStatus),
    })),
  }
}
