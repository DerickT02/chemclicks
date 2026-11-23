import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { ActivityProgressView } from '@/app/admin/classes/[classId]/activities/[assignmentId]/ActivityProgressView'
import { getTeacherClassActivities } from '@/lib/server/teacher-activities'
import { getTeacherActivityAttemptSummary } from '@/lib/server/teacher-attempts'

type Props = { params: Promise<{ classId: string; assignmentId: string }> }

// generateMetadata and the page share one ownership-checked read per request.
const loadClassroom = cache(getTeacherClassActivities)

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
  // The lightweight summary omits histories; each one is read when expanded.
  const summary = await getTeacherActivityAttemptSummary(classId, assignmentId, { live: true })

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 text-foreground">
      <ActivityProgressView
        key={classroom.id}
        initialSummary={summary}
        assignments={classroom.assignments}
      />
    </main>
  )
}
