import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import RefreshAssignments from '@/components/assignments/RefreshAssignments'
import { ASSIGNMENT_STAGES, type AssignmentStage } from '@/lib/assignments/stages'
import { getTeacherClassActivities } from '@/lib/server/teacher-activities'
import { getTeacherActivityAttemptSummary } from '@/lib/server/teacher-attempts'
import { StudentProgressRoster, studentStage } from './StudentProgressRoster'

type Props = { params: Promise<{ classId: string; assignmentId: string }> }

// generateMetadata and the page share one ownership-checked read per request.
const loadClassroom = cache(getTeacherClassActivities)

// Furthest along first, matching the bar.
const STAGE_ORDER: AssignmentStage[] = [
  'completed', 'needs_retry', 'quiz_in_progress', 'explored', 'exploring', 'not_started',
]

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { classId, assignmentId } = await params
  try {
    const assignment = (await loadClassroom(classId)).assignments.find(item => item.id === assignmentId)
    if (assignment) return { title: `${assignment.title} · Student progress | ChemClicks` }
  } catch {
    // The page itself reports the failure.
  }
  return { title: 'Student progress | ChemClicks' }
}

export default async function ActivityProgressPage({ params }: Props) {
  const { classId, assignmentId } = await params
  const classroom = await loadClassroom(classId)
  const assignment = classroom.assignments.find(item => item.id === assignmentId)
  if (!assignment) notFound()
  const summary = await getTeacherActivityAttemptSummary(classId, assignmentId)

  const stages = summary.students.map(studentStage)
  const counts = STAGE_ORDER
    .map(stage => ({ stage, count: stages.filter(item => item === stage).length }))
    .filter(item => item.count > 0)
  const completed = stages.filter(stage => stage === 'completed').length

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 text-foreground">
      <Link href={`/admin?classId=${classroom.id}`} className="text-sm text-accent underline-offset-4 hover:underline">
        ← Back to {classroom.name}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">{assignment.title}</h1>
      <p className="mt-1 text-muted-foreground">Student progress · {classroom.name}</p>

      {classroom.assignments.length > 1 && (
        <nav aria-label="Other activities in this class" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {classroom.assignments.map(item => (
              <li key={item.id}>
                <Link
                  href={`/admin/classes/${classroom.id}/activities/${item.id}`}
                  aria-current={item.id === assignment.id ? 'page' : undefined}
                  prefetch={false}
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    item.id === assignment.id
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-border text-muted-foreground hover:border-ring hover:text-foreground'
                  }`}
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" role="status">
          {summary.students.length === 0
            ? 'No students enrolled yet.'
            : <>
              <span className="font-semibold text-foreground">{completed} of {summary.students.length}</span> completed
              {counts.filter(item => item.stage !== 'completed')
                .map(item => ` · ${item.count} ${ASSIGNMENT_STAGES[item.stage].label.toLowerCase()}`).join('')}
            </>}
        </p>
        <RefreshAssignments label="Refresh progress" />
      </div>

      <div className="mt-4">
        <StudentProgressRoster summary={summary} />
      </div>
    </main>
  )
}
