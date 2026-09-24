import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getStudentSession } from '@/lib/auth/student-session'
import { getAssignmentAttempts, getStudentAssignments } from '@/lib/server/student-assignments'
import { assignmentIsOpen, isSupportedExploration } from '@/lib/activities/availability'
import LewisDotExplorer from '@/components/lewis/LewisDotExplorer'
import PrecisionRuler from '@/components/measurement/PrecisionRuler'
import GraduatedCylinder from '@/components/measurement/GraduatedCylinder'
import AttemptControls from './AttemptControls'

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value)) + ' UTC'
}

export default async function AssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  if (!await getStudentSession()) redirect('/login/student')
  const { assignmentId } = await params
  const assignment = (await getStudentAssignments()).find(a => a.id === assignmentId)
  if (!assignment) notFound()
  const attempts = await getAssignmentAttempts(assignmentId)
  const latest = attempts[0]
  const open = assignmentIsOpen(assignment.opens_at, assignment.closes_at)
  const supported = isSupportedExploration(assignment.activities.type)
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <Link href="/student" className="text-accent underline underline-offset-4">Your assignments</Link>
      <h1 className="text-3xl font-semibold">{assignment.activities.title}</h1>
      <p className="text-muted-foreground">
        {latest ? `Attempt ${latest.attempt_number} · ${latest.status === 'completed' ? 'Completed' : 'In progress'}` : 'No attempts yet.'}
      </p>
      {assignment.opens_at && <p className="text-sm">Opens: {formatTime(assignment.opens_at)}</p>}
      {assignment.closes_at && <p className="text-sm">Closes: {formatTime(assignment.closes_at)}</p>}
      {!supported && <p>This activity is not available yet.</p>}
      {!open && <p>This assignment is currently closed. Your saved attempts are still shown below.</p>}
      {supported && open && <>
        <p className="text-sm text-muted-foreground">Finish when you are done exploring. Completion records your participation; this exploration is not scored.</p>
        {latest?.status === 'in_progress' && <section key={`exploration-${latest.id}`} className="rounded-xl border border-border bg-card p-6" aria-label="Exploration">
          {assignment.activities.type === 'lewis_diagram' && <LewisDotExplorer />}
          {assignment.activities.type === 'measurement_ruler_hundredths' && <PrecisionRuler />}
          {assignment.activities.type === 'measurement_graduated_cylinder' && <GraduatedCylinder />}
        </section>}
        <AttemptControls key={`controls-${latest?.id ?? 'new'}`} assignmentId={assignment.id} attemptId={latest?.id} completed={latest?.status === 'completed'} />
      </>}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">Attempt history</h2>
        {attempts.length === 0 ? <p>No attempts yet.</p> : <ul className="space-y-3">{attempts.map(attempt => (
          <li key={attempt.id}>
            <p>Attempt {attempt.attempt_number} · {attempt.status === 'completed' ? 'Completed' : 'In progress'}</p>
            <p className="text-sm text-muted-foreground">Started {formatTime(attempt.started_at)}{attempt.completed_at ? ` · Finished ${formatTime(attempt.completed_at)}` : ''}</p>
          </li>
        ))}</ul>}
      </section>
    </main>
  )
}
