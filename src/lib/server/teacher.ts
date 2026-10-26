import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/server/database'

// Several server readers on one page each require the teacher. React's
// request-scoped cache lets them share a single check instead of repeating the
// Auth and teacher lookups; nothing is reused across requests.
export const requireTeacherId = cache(async (): Promise<string> => {
  const client = await createClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user || !user.email_confirmed_at || user.is_anonymous) {
    throw new Error('A verified teacher session is required.')
  }
  // Older signup triggers also created teacher profiles for student Auth users.
  // A student link takes precedence; user-editable metadata cannot establish a role.
  const { data: student, error: studentError } = await createServiceClient()
    .from('students').select('id').eq('auth_user_id', user.id).maybeSingle()
  if (studentError || student) throw new Error('An approved teacher account is required.')
  const { data: teacher, error: teacherError } = await client
    .from('teachers').select('id').eq('id', user.id).maybeSingle()
  if (teacherError || !teacher) throw new Error('An approved teacher account is required.')
  return user.id
})
