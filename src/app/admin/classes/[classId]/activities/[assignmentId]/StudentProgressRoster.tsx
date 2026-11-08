import type { TeacherActivityAttemptSummary } from '@/lib/server/teacher-attempts'

import { AttemptHistoryTable } from '@/app/admin/classes/[classId]/activities/[assignmentId]/AttemptHistoryTable'
import { LazyAttemptHistory } from '@/app/admin/classes/[classId]/activities/[assignmentId]/LazyAttemptHistory'
import { AssignmentProgressDetails } from '@/components/assignments/AssignmentProgressDetails'
import { StageBar } from '@/components/assignments/StageBar'
import LocalizedTimestamp from '@/components/datetime/LocalizedTimestamp'
type Props = {
  summary: TeacherActivityAttemptSummary
  /** The summary has no histories; read each one only when it is expanded. */
  lazyHistory?: boolean
}

/** Every enrolled student's progress on one activity, with their attempt history. */
export function StudentProgressRoster({ summary, lazyHistory = false }: Props) {
  return (
    <section aria-label={`Student progress for ${summary.activityTitle}`} className="rounded-xl border border-border bg-card p-5">
      {summary.students.length === 0 ? <p>No students enrolled in this class yet.</p> : (
        <ul className="divide-y divide-border">
          {summary.students.map(student => {
            const { progress } = student
            const name = `${student.firstName} ${student.lastName}`
            return (
            <li key={student.studentId} className="py-4 first:pt-0 last:pb-0">
              <StageBar
                stage={progress.stage}
                label={`${name}, ${summary.activityTitle}`}
                title={<h3 className="text-base font-semibold">{name}</h3>}
              />
              <AssignmentProgressDetails
                className="mt-2 space-y-1 text-sm text-muted-foreground"
                facts={progress}
              />
              <dl className="mt-1 space-y-1 text-sm text-muted-foreground">
                {progress.firstQuizStartedAt && (
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-medium text-foreground/80">First quiz started:</dt>
                    <dd><LocalizedTimestamp value={progress.firstQuizStartedAt} /></dd>
                  </div>
                )}
                {student.quizStartedAt && student.quizStartedAt !== progress.firstQuizStartedAt && (
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-medium text-foreground/80">Latest quiz started:</dt>
                    <dd><LocalizedTimestamp value={student.quizStartedAt} /></dd>
                  </div>
                )}
              </dl>
              <p className="mt-1 text-sm text-muted-foreground">
                {student.attemptCount} {student.attemptCount === 1 ? 'attempt' : 'attempts'} · {student.explorationAttemptCount} exploration {student.explorationAttemptCount === 1 ? 'attempt' : 'attempts'} · {student.quizAttemptCount} quiz {student.quizAttemptCount === 1 ? 'attempt' : 'attempts'} · {student.completedCount} completed · {student.inProgressCount} in progress
              </p>
              {student.attemptCount === 0 ? <p className="mt-2 text-sm text-muted-foreground">
                {progress.stage === 'quiz_in_progress' ? 'Quiz started; no result submitted yet.' : 'No attempts yet.'}
              </p> : (
                lazyHistory
                  ? <LazyAttemptHistory classId={summary.classId} assignmentId={summary.assignmentId} student={student} />
                  : (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm underline">View attempt history for {student.firstName} {student.lastName}</summary>
                      <AttemptHistoryTable firstName={student.firstName} lastName={student.lastName} attempts={student.attempts} />
                    </details>
                  )
              )}
            </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
