import 'server-only'
import { createClient } from '@/lib/supabase/server'

export async function requireTeacherId(): Promise<string> {
  const client = await createClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user || !user.email_confirmed_at || user.is_anonymous) {
    throw new Error('A verified teacher session is required.')
  }
  const { data: teacher, error: teacherError } = await client
    .from('teachers').select('id').eq('id', user.id).maybeSingle()
  if (teacherError || !teacher) throw new Error('An approved teacher account is required.')
  return user.id
}
