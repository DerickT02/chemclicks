import 'server-only'
import { requireTeacherId } from '@/lib/server/teacher'
import { createServiceClient } from '@/lib/server/database'

export async function disableOwnedClass(id: string): Promise<void> {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('Invalid class.')
  }
  const teacherId = await requireTeacherId()
  const { data, error } = await createServiceClient().from('classes')
    .update({ is_active: false }).eq('id', id).eq('teacher_id', teacherId)
    .eq('is_active', true).select('id')
  if (error || data?.length !== 1) throw new Error('Class could not be disabled.')
}
