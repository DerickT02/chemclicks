import { redirect } from 'next/navigation'
import { getTeacherClassActivities } from '@/lib/server/teacher-activities'

// Replaced by one student progress page per activity
// (/admin/classes/[classId]/activities/[assignmentId]); old links still work.
export default async function ActivityAttemptsPage({ params, searchParams }: {
  params: Promise<{ classId: string }>
  searchParams: Promise<{ assignmentId?: string | string[] }>
}) {
  const { classId } = await params
  const { assignmentId: requested } = await searchParams
  const assignmentId = Array.isArray(requested) ? requested[0] : requested
  // The activity page checks ownership and shows 404 for a foreign assignment.
  if (assignmentId) {
    redirect(`/admin/classes/${encodeURIComponent(classId)}/activities/${encodeURIComponent(assignmentId)}`)
  }
  const classroom = await getTeacherClassActivities(classId)
  const first = classroom.assignments[0]
  redirect(first
    ? `/admin/classes/${classroom.id}/activities/${first.id}`
    : `/admin?classId=${classroom.id}`)
}
