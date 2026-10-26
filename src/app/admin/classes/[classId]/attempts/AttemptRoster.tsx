import type { TeacherActivityAttemptSummary } from '@/lib/server/teacher-attempts'

import LocalizedTimestamp from '@/components/datetime/LocalizedTimestamp'
import { LEWIS_QUIZZES } from '@/lib/assignments/lewis-quizzes'
import { BOHR_QUIZ_KEY } from '@/lib/db/quiz-questions'
import { measurementAttemptLabel } from '@/lib/measurement/modes'

// Names a teacher recognises; the stored key is an internal identifier.
const QUIZ_TITLES: Record<string, string> = {
  [BOHR_QUIZ_KEY]: 'Bohr Models Quiz',
  [LEWIS_QUIZZES.covalent.quizKey]: LEWIS_QUIZZES.covalent.title,
  [LEWIS_QUIZZES.ionic.quizKey]: LEWIS_QUIZZES.ionic.title,
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

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes === 0) return `${remainingSeconds}s`
  return `${minutes}m ${remainingSeconds}s`
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

export function AttemptRoster({ summary }: { summary: TeacherActivityAttemptSummary }) {
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
              {student.attemptCount === 0 ? <p className="mt-2 text-sm text-muted-foreground">No attempts yet.</p> : (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm underline">View attempt history for {student.firstName} {student.lastName}</summary>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">Attempt history for {student.firstName} {student.lastName}, newest first</caption>
                      <thead><tr>{['Attempt', 'Activity', 'Status', 'Started', 'Completed'].map(title => <th key={title} scope="col" className="border-b border-border p-2">{title}</th>)}</tr></thead>
                      <tbody>{student.attempts.map(attempt => (
                        <tr key={attempt.id}>
                          <th scope="row" className="p-2">{attempt.attemptNumber}</th>
                          <td className="p-2">
                            {attempt.instrument ? measurementAttemptLabel(attempt.instrument, attempt.precisionMode) : attempt.quizKey ? (Object.hasOwn(QUIZ_TITLES, attempt.quizKey) ? QUIZ_TITLES[attempt.quizKey] : 'Quiz') : 'Exploration'}
                            {attempt.score !== null && attempt.score !== undefined && attempt.questionTotal !== null && attempt.questionTotal !== undefined && (
                              <span className="block">
                                {`${attempt.score}/${attempt.questionTotal} · ${attempt.passed ? 'Passed' : 'Not passed'}`}
                              </span>
                            )}
                          </td>
                          <td className="p-2">{attempt.status === 'completed' ? 'Completed' : 'In progress'}</td>
                          <td className="whitespace-nowrap p-2"><LocalizedTimestamp value={attempt.startedAt} /></td>
                          <td className="whitespace-nowrap p-2">{attempt.completedAt ? <LocalizedTimestamp value={attempt.completedAt} /> : 'Not completed'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
