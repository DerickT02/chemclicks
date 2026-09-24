import Link from 'next/link'
import { getTeacherClassActivities } from '@/lib/server/teacher-activities'
import { getTeacherActivityAttemptSummary } from '@/lib/server/teacher-attempts'
import { AttemptRoster } from './AttemptRoster'

export default async function ActivityAttemptsPage({ params, searchParams }: {
  params: Promise<{ classId: string }>
  searchParams: Promise<{ assignmentId?: string }>
}) {
  const { classId } = await params
  const { assignmentId } = await searchParams
  const classroom = await getTeacherClassActivities(classId)
  const selectedId = assignmentId ?? classroom.assignments[0]?.id
  // Never fall back to another assignment when an explicit selection is invalid.
  if (selectedId && !classroom.assignments.some(item => item.id === selectedId)) {
    throw new Error('Activity access denied or unavailable.')
  }
  const summary = selectedId ? await getTeacherActivityAttemptSummary(classId, selectedId) : null
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-foreground">
      <Link href={`/admin?classId=${classId}`} className="text-sm underline">Back to classroom</Link>
      <h1 className="mt-5 text-3xl font-semibold">Activity attempts</h1>
      <p className="mt-2 text-muted-foreground">{classroom.name}</p>
      {classroom.assignments.length === 0 ? (
        <p className="mt-6 rounded-lg border border-border bg-card p-5">No activities assigned to this class yet.</p>
      ) : (
        <>
          <form className="my-6 flex flex-wrap items-end gap-3" action={`/admin/classes/${classId}/attempts`}>
            <div>
              <label htmlFor="assignment" className="mb-2 block text-sm font-medium">Activity</label>
              <select key={selectedId} id="assignment" name="assignmentId" defaultValue={selectedId}
                className="max-w-full rounded-md border border-border bg-card p-2 text-foreground">
                {classroom.assignments.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </div>
            <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground" type="submit">View attempts</button>
          </form>
          {summary && <AttemptRoster summary={summary} />}
        </>
      )}
    </main>
  )
}
