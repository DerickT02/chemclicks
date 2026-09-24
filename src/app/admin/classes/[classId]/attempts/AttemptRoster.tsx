import type { TeacherActivityAttemptSummary } from '@/lib/server/teacher-attempts'

const dateFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
})
function Timestamp({ value }: { value: string }) {
  return <time dateTime={value}>{dateFormat.format(new Date(value))} UTC</time>
}

export function AttemptRoster({ summary }: { summary: TeacherActivityAttemptSummary }) {
  return (
    <section aria-labelledby="activity-title" className="rounded-xl border border-border bg-card p-5">
      <h2 id="activity-title" className="text-xl font-semibold">{summary.activityTitle}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{summary.students.length} students enrolled. Counts include completed and in-progress attempts. All times are UTC.</p>
      {summary.students.length === 0 ? <p className="mt-5">No students enrolled in this class yet.</p> : (
        <ul className="mt-5 divide-y divide-border">
          {summary.students.map(student => (
            <li key={student.studentId} className="py-4">
              <h3 className="font-semibold">{student.firstName} {student.lastName}</h3>
              {!student.verified && <p className="text-sm text-muted-foreground">Awaiting verification</p>}
              <p className="mt-1">{student.attemptCount} {student.attemptCount === 1 ? 'attempt' : 'attempts'} · {student.completedCount} completed · {student.inProgressCount} in progress</p>
              {student.attemptCount === 0 ? <p className="mt-2 text-sm text-muted-foreground">No attempts yet.</p> : (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm underline">View attempt history for {student.firstName} {student.lastName}</summary>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">Attempt history for {student.firstName} {student.lastName}, newest first</caption>
                      <thead><tr>{['Attempt', 'Status', 'Started', 'Completed'].map(title => <th key={title} scope="col" className="border-b border-border p-2">{title}</th>)}</tr></thead>
                      <tbody>{student.attempts.map(attempt => (
                        <tr key={attempt.id}>
                          <th scope="row" className="p-2">{attempt.attemptNumber}</th>
                          <td className="p-2">{attempt.status === 'completed' ? 'Completed' : 'In progress'}</td>
                          <td className="whitespace-nowrap p-2"><Timestamp value={attempt.startedAt} /></td>
                          <td className="whitespace-nowrap p-2">{attempt.completedAt ? <Timestamp value={attempt.completedAt} /> : 'Not completed'}</td>
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
