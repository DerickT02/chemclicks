import 'server-only'
import { requireTeacherId } from '@/lib/server/teacher'
import { createServiceClient } from '@/lib/server/database'

export async function deleteOwnedClass(id: string): Promise<void> {
  const teacherId = await requireTeacherId()
  const { data, error } = await createServiceClient().from('classes')
    .delete().eq('id', id).eq('teacher_id', teacherId).select('id')
  if (error || data?.length !== 1) throw new Error('Class could not be removed.')
}
