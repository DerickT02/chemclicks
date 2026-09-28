import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requireTeacherId } from '@/lib/server/teacher'

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
    .select('id, activities!inner(title)').eq('class_id', classId).order('created_at')
  if (error) throw new Error('Activities could not be loaded.')
  const assignments = (data ?? []).map(row => {
    const activity = Array.isArray(row.activities) ? row.activities[0] : row.activities
    return { id: row.id as string, title: activity.title as string }
  })
  return { id: classroom.id as string, name: classroom.name as string, assignments }
}
