import type { TeacherActivityAttemptSummary } from '@/lib/server/teacher-attempts'

import { AttemptHistorySummary } from '@/app/admin/classes/[classId]/activities/[assignmentId]/AttemptHistorySummary'
import { AttemptHistoryTable } from '@/app/admin/classes/[classId]/activities/[assignmentId]/AttemptHistoryTable'
import { LazyAttemptHistory } from '@/app/admin/classes/[classId]/activities/[assignmentId]/LazyAttemptHistory'
import { AssignmentProgressDetails } from '@/components/assignments/AssignmentProgressDetails'
import { AssignmentProgressHeader } from '@/components/assignments/AssignmentProgressHeader'
import { QuizScore } from '@/components/assignments/QuizScore'
import LocalizedTimestamp from '@/components/datetime/LocalizedTimestamp'
type Props = {
  summary: TeacherActivityAttemptSummary
  searchQuery?: string
  /** The summary has no histories; read each one only when it is expanded. */
  lazyHistory?: boolean
}

/** Every enrolled student's progress on one activity, with their attempt history. */
export function StudentProgressRoster({ summary, searchQuery = '', lazyHistory = false }: Props) {
  const searchTerms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const students = summary.students.filter(student => {
    const name = `${student.firstName} ${student.lastName}`.toLowerCase()
    return searchTerms.every(term => name.includes(term))
  })

  return (
    <section aria-label={`Student progress for ${summary.activityTitle}`}>
      {summary.students.length === 0 && <p>No students enrolled in this class yet.</p>}
      {summary.students.length > 0 && searchTerms.length > 0 && (
        <p role="status" className="mb-3 text-sm text-muted-foreground">
          {students.length === 0 ? 'No students match your search.' : `Showing ${students.length} of ${summary.students.length} students`}
        </p>
      )}
      {students.length > 0 && (
        <ul className="space-y-4">
          {students.map(student => {
            const { progress } = student
            const name = `${student.firstName} ${student.lastName}`
            return (
            <li key={student.studentId} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <AssignmentProgressHeader
                stage={progress.stage}
                label={`${name}, ${summary.activityTitle}`}
                title={<h3 className="text-base font-semibold">{name}</h3>}
                quizResult={<QuizScore facts={progress} />}
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
              {student.attemptCount === 0 ? <p className="mt-1 text-sm text-muted-foreground">
                {progress.stage === 'quiz_in_progress' ? 'Quiz started; no result submitted yet.' : 'No attempts yet.'}
              </p> : (
                lazyHistory
                  ? <LazyAttemptHistory classId={summary.classId} assignmentId={summary.assignmentId} student={student} />
                  : (
                    <details className="group/history mt-3">
                      <AttemptHistorySummary firstName={student.firstName} lastName={student.lastName} attemptCount={student.attemptCount} />
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
