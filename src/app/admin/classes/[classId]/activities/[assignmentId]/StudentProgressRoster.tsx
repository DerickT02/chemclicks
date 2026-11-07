import type { TeacherActivityAttemptSummary } from '@/lib/server/teacher-attempts'

import { AssignmentProgressDetails } from '@/components/assignments/AssignmentProgressDetails'
import { StageBar } from '@/components/assignments/StageBar'
import LocalizedTimestamp from '@/components/datetime/LocalizedTimestamp'
import { LEWIS_QUIZZES } from '@/lib/assignments/lewis-quizzes'
import { BOHR_INTRO_QUIZ_KEY, BOHR_QUIZ_KEY, BOHR_STABILITY_QUIZ_KEY } from '@/lib/db/quiz-questions'
import { measurementAttemptLabel } from '@/lib/measurement/modes'

// Names a teacher recognises; the stored key is an internal identifier.
const QUIZ_TITLES: Record<string, string> = {
  [BOHR_QUIZ_KEY]: 'Bohr Models Quiz',
  [BOHR_INTRO_QUIZ_KEY]: 'Bohr Model Introduction Quiz',
  [BOHR_STABILITY_QUIZ_KEY]: 'Bohr Model Stability Quiz',
  [LEWIS_QUIZZES.covalent.quizKey]: LEWIS_QUIZZES.covalent.title,
  [LEWIS_QUIZZES.ionic.quizKey]: LEWIS_QUIZZES.ionic.title,
}

/** Every enrolled student's progress on one activity, with their attempt history. */
export function StudentProgressRoster({ summary }: { summary: TeacherActivityAttemptSummary }) {
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
