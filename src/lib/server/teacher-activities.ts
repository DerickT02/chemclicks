import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requireTeacherId } from '@/lib/server/teacher'

function assignmentLabel(
  title: string,
  archivedAt: string | null,
): string {
  if (!archivedAt) return title
  const date = new Date(archivedAt).toISOString().slice(0, 10)
  return `${title} (archived ${date})`
}

export async function getTeacherClassActivities(classId: string) {
  const teacherId = await requireTeacherId()
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(classId)) {
    throw new Error('Invalid class.')
  }
  const client = await createClient()
  const { data: classroom, error: classError } = await client.from('classes')
    .select('id, name').eq('id', classId).eq('teacher_id', teacherId).maybeSingle()
  if (classError || !classroom) throw new Error('Class access denied or unavailable.')
  const { data, error } = await client.from('class_activities')
    .select('id, archived_at, created_at, activities!inner(title)')
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
  if (error) throw new Error('Activities could not be loaded.')
  const assignments = (data ?? []).map(row => {
    const activity = Array.isArray(row.activities) ? row.activities[0] : row.activities
    const title = activity.title as string
    return {
      id: row.id as string,
      title: assignmentLabel(title, row.archived_at as string | null),
    }
  })
  return { id: classroom.id as string, name: classroom.name as string, assignments }
}
