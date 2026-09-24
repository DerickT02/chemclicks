import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getStudentSession } from '@/lib/auth/student-session'
import { getStudentAssignments } from '@/lib/server/student-assignments'
import { assignmentIsOpen, isSupportedExploration } from '@/lib/activities/availability'

export default async function StudentAssignmentsPage() {
  if (!await getStudentSession()) redirect('/login/student')
  const assignments = await getStudentAssignments()
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-semibold text-foreground">Your assignments</h1>
      {assignments.length === 0 && <p className="text-muted-foreground">Your teacher has not assigned any activities yet.</p>}
      {assignments.map(assignment => (
        <article key={assignment.id} className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">{assignment.activities.title}</h2>
          <p className="my-3 text-sm text-muted-foreground">
            {!isSupportedExploration(assignment.activities.type) ? 'This activity is not available yet.'
              : assignmentIsOpen(assignment.opens_at, assignment.closes_at) ? 'Ready to explore.' : 'This assignment is currently closed.'}
          </p>
          <Link href={`/student/assignments/${assignment.id}`} className="font-medium text-accent underline underline-offset-4">View assignment</Link>
        </article>
      ))}
    </main>
  )
}
