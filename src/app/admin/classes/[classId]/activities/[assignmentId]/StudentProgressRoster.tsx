import type { TeacherActivityAttemptSummary } from '@/lib/server/teacher-attempts'

import { AssignmentProgressDetails } from '@/components/assignments/AssignmentProgressDetails'
import { StageBar } from '@/components/assignments/StageBar'
import LocalizedTimestamp from '@/components/datetime/LocalizedTimestamp'
import { LEWIS_QUIZZES } from '@/lib/assignments/lewis-quizzes'
import type { AssignmentStage } from '@/lib/assignments/stages'
import { BOHR_INTRO_QUIZ_KEY, BOHR_QUIZ_KEY, BOHR_STABILITY_QUIZ_KEY } from '@/lib/db/quiz-questions'
import { measurementAttemptLabel } from '@/lib/measurement/modes'

// Names a teacher recognises; the stored key is an internal identifier.
const QUIZ_TITLES: Record<string, string> = {
  [BOHR_QUIZ_KEY]: 'Bohr Models Quiz',
  [BOHR_INTRO_QUIZ_KEY]: 'Bohr Model Introduction Quiz',
  [BOHR_STABILITY_QUIZ_KEY]: 'Bohr Model Stability Quiz',
  [LEWIS_QUIZZES.covalent.quizKey]: LEWIS_QUIZZES.covalent.title,
  [LEWIS_QUIZZES.ionic.quizKey]: LEWIS_QUIZZES.ionic.title,
  [LEWIS_QUIZZES.diagram.quizKey]: LEWIS_QUIZZES.diagram.title,
}

type Student = TeacherActivityAttemptSummary['students'][number]

// Used when the database has not been migrated to return progressStage yet.
const STAGE_FROM_STATUS: Record<Student['overallStatus'], AssignmentStage> = {
  not_started: 'not_started',
  exploring: 'exploring',
  taking_quiz: 'quiz_in_progress',
  needs_retry: 'needs_retry',
  completed: 'completed',
}

export function studentStage(student: Student): AssignmentStage {
  return student.progressStage ?? STAGE_FROM_STATUS[student.overallStatus]
}

/** Every enrolled student's progress on one activity, with their attempt history. */
export function StudentProgressRoster({ summary }: { summary: TeacherActivityAttemptSummary }) {
  return (
    <section aria-label={`Student progress for ${summary.activityTitle}`} className="rounded-xl border border-border bg-card p-5">
      {summary.students.length === 0 ? <p>No students enrolled in this class yet.</p> : (
        <ul className="divide-y divide-border">
          {summary.students.map(student => {
            const stageKey = studentStage(student)
            const name = `${student.firstName} ${student.lastName}`
            return (
            <li key={student.studentId} className="py-4 first:pt-0 last:pb-0">
              <StageBar
                stage={stageKey}
                label={`${name}, ${summary.activityTitle}`}
                title={<h3 className="text-base font-semibold">{name}</h3>}
              />
              <AssignmentProgressDetails
                className="mt-2 space-y-1 text-sm text-muted-foreground"
                facts={{
                  stage: stageKey,
                  explorationStartedAt: student.explorationStartedAt ?? null,
                  firstQuizStartedAt: student.firstQuizStartedAt ?? null,
                  timeToFirstQuizSeconds: student.timeToFirstQuizSeconds ?? null,
                  passingQuizAttemptNumber: student.passingQuizAttemptNumber,
                  passingQuizScore: student.passingQuizScore,
                  passingQuizTotal: student.passingQuizTotal,
                  passingQuizPercentage: student.passingQuizPercentage,
                  failedQuizAttemptCount: student.failedQuizAttemptCount,
                  completedAt: student.completedAt ?? null,
                }}
              />
              <dl className="mt-1 space-y-1 text-sm text-muted-foreground">
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
              </dl>
              {(() => {
                const explorationCount = student.explorationAttemptCount
                  ?? student.attempts.filter((attempt) => attempt.kind === 'exploration' || (attempt.kind === undefined && attempt.quizKey == null)).length
                const quizCount = student.quizAttemptCount
                  ?? student.attempts.filter((attempt) => attempt.kind === 'quiz' || (attempt.kind === undefined && attempt.quizKey != null)).length
                return (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {student.attemptCount} {student.attemptCount === 1 ? 'attempt' : 'attempts'} · {explorationCount} exploration {explorationCount === 1 ? 'attempt' : 'attempts'} · {quizCount} quiz {quizCount === 1 ? 'attempt' : 'attempts'} · {student.completedCount} completed · {student.inProgressCount} in progress
                  </p>
                )
              })()}
              {student.attemptCount === 0 ? <p className="mt-2 text-sm text-muted-foreground">
                {stageKey === 'quiz_in_progress' ? 'Quiz started; no result submitted yet.' : 'No attempts yet.'}
              </p> : (
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
            )
          })}
        </ul>
      )}
    </section>
  )
}
