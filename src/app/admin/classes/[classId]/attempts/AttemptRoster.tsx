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

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.trunc(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remainder = total % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${remainder}s`
  return `${remainder}s`
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
              <h3 className="font-semibold">{student.firstName} {student.lastName}</h3>
              <p className="mt-1 text-sm">
                Assignment stage: <span className="font-medium">{student.stage ?? 'Not started'}</span>
              </p>
              <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                {student.explorationStartedAt && (
                  <p>Exploration started <LocalizedTimestamp value={student.explorationStartedAt} />.</p>
                )}
                {student.firstQuizStartedAt && (
                  <p>First quiz started <LocalizedTimestamp value={student.firstQuizStartedAt} />.</p>
                )}
                {student.quizStartedAt && student.quizStartedAt !== student.firstQuizStartedAt && (
                  <p>Latest quiz started <LocalizedTimestamp value={student.quizStartedAt} />.</p>
                )}
                {student.explorationDurationSeconds != null && (
                  <p>Exploration duration: {formatDuration(student.explorationDurationSeconds)}.</p>
                )}
              </div>
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
                {student.stage === 'Taking quiz' ? 'Quiz started; no result submitted yet.' : 'No attempts yet.'}
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
          ))}
        </ul>
      )}
    </section>
  )
}
