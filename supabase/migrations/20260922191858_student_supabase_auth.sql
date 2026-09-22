-- Link existing student rows to Supabase Auth identities created on first login.
-- Student IDs, classrooms, progress, attempts, and teacher records are unchanged.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS students_auth_user_id_key
  ON public.students (auth_user_id)
  WHERE auth_user_id IS NOT NULL;
