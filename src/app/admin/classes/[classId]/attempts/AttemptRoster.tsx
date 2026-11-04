import type { TeacherActivityAttemptSummary } from '@/lib/server/teacher-attempts'

import LocalizedTimestamp from '@/components/datetime/LocalizedTimestamp'
import { AttemptHistoryTable } from '@/app/admin/classes/[classId]/attempts/AttemptHistoryTable'
import { LazyAttemptHistory } from '@/app/admin/classes/[classId]/attempts/LazyAttemptHistory'

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.trunc(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remainder = total % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${remainder}s`
  return `${remainder}s`
}

type Student = TeacherActivityAttemptSummary['students'][number]

const STATUS_LABEL: Record<Student['overallStatus'], string> = {
  not_started: 'Not started',
  exploring: 'Exploring',
  taking_quiz: 'Taking quiz',
  needs_retry: 'Needs retry',
  completed: 'Completed',
}

const STATUS_CLASS: Record<Student['overallStatus'], string> = {
  not_started: 'border-border bg-muted text-muted-foreground',
  exploring: 'border-ring bg-muted text-foreground',
  taking_quiz: 'border-ring bg-muted text-foreground',
  needs_retry: 'border-destructive bg-destructive/10 text-destructive',
  completed: 'border-accent bg-accent/15 text-accent',
}

function ExplorationDuration({ student }: { student: Student }) {
  if (student.explorationStatus === 'not_started') return <>Not started</>
  if (student.explorationStatus === 'in_progress') return <>In progress</>
  return <>{student.explorationDurationSeconds !== null ? formatDuration(student.explorationDurationSeconds) : 'Completed'}</>
}

function QuizPassSummary({ student }: { student: Student }) {
  if (student.passingQuizAttemptNumber !== null) {
    return (
      <>
        Passed on attempt {student.passingQuizAttemptNumber}: {student.passingQuizScore}/{student.passingQuizTotal}
        {student.passingQuizPercentage !== null ? ` (${student.passingQuizPercentage}%)` : ''}
        {student.passingQuizCompletedAt ? <> · <LocalizedTimestamp value={student.passingQuizCompletedAt} /></> : ''}
      </>
    )
  }
  return (
    <>
      Not yet passed
      {student.failedQuizAttemptCount > 0 ? ` · ${student.failedQuizAttemptCount} failed ${student.failedQuizAttemptCount === 1 ? 'attempt' : 'attempts'}` : ''}
    </>
  )
}

export function AttemptRoster({ summary, lazyHistory = false }: { summary: TeacherActivityAttemptSummary; lazyHistory?: boolean }) {
  return (
    <section aria-labelledby="activity-title" className="rounded-xl border border-border bg-card p-5">
      <h2 id="activity-title" className="text-xl font-semibold">{summary.activityTitle}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{summary.students.length} students enrolled.</p>
      {summary.students.length === 0 ? <p className="mt-5">No students enrolled in this class yet.</p> : (
        <ul className="mt-5 divide-y divide-border">
          {summary.students.map(student => (
            <li key={student.studentId} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{student.firstName} {student.lastName}</h3>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[student.overallStatus]}`}>
                  {STATUS_LABEL[student.overallStatus]}
                </span>
              </div>
              <dl className="mt-2 space-y-1 text-sm text-muted-foreground">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-foreground/80">Exploration:</dt>
                  <dd><ExplorationDuration student={student} /></dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-foreground/80">Quiz:</dt>
                  <dd><QuizPassSummary student={student} /></dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-foreground/80">Assignment stage:</dt>
                  <dd>{student.stage ?? STATUS_LABEL[student.overallStatus]}</dd>
                </div>
                {student.explorationStartedAt && (
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-medium text-foreground/80">Exploration started:</dt>
                    <dd><LocalizedTimestamp value={student.explorationStartedAt} /></dd>
                  </div>
                )}
                {student.firstQuizStartedAt && (
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-medium text-foreground/80">First quiz started:</dt>
                    <dd><LocalizedTimestamp value={student.firstQuizStartedAt} /></dd>
                  </div>
                )}
                {student.quizStartedAt && student.quizStartedAt !== student.firstQuizStartedAt && (
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-medium text-foreground/80">Latest quiz started:</dt>
                    <dd><LocalizedTimestamp value={student.quizStartedAt} /></dd>
                  </div>
                )}
                {student.timeToFirstQuizSeconds != null && (
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-medium text-foreground/80">Exploration to first quiz:</dt>
                    <dd>{formatDuration(student.timeToFirstQuizSeconds)}</dd>
                  </div>
                )}
              </dl>
              {(() => {
                const explorationCount = student.explorationAttemptCount
                  ?? student.attempts.filter((attempt) => attempt.kind === 'exploration' || (attempt.kind === undefined && attempt.quizKey == null)).length
                const quizCount = student.quizAttemptCount
                  ?? student.attempts.filter((attempt) => attempt.kind === 'quiz' || (attempt.kind === undefined && attempt.quizKey != null)).length
                return (
                  <p className="mt-1">
                    {student.attemptCount} {student.attemptCount === 1 ? 'attempt' : 'attempts'} · {explorationCount} exploration {explorationCount === 1 ? 'attempt' : 'attempts'} · {quizCount} quiz {quizCount === 1 ? 'attempt' : 'attempts'} · {student.completedCount} completed · {student.inProgressCount} in progress
                  </p>
                )
              })()}
              {student.attemptCount === 0 ? <p className="mt-2 text-sm text-muted-foreground">
                {student.stage === 'Taking quiz' || student.overallStatus === 'taking_quiz' ? 'Quiz started; no result submitted yet.' : 'No attempts yet.'}
              </p> : lazyHistory ? (
                <LazyAttemptHistory classId={summary.classId} assignmentId={summary.assignmentId} student={student} />
              ) : (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm underline">View attempt history for {student.firstName} {student.lastName}</summary>
                  <AttemptHistoryTable firstName={student.firstName} lastName={student.lastName} attempts={student.attempts} />
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
