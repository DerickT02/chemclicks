-- Teachers INSERT RLS: allows the signup flow to insert the teacher row into public.teachers.
--
-- Apply in Supabase: SQL Editor → New query → paste → Run.
-- Safe to re-run.

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chemclicks_teachers_insert" ON public.teachers;

CREATE POLICY "chemclicks_teachers_insert"
  ON public.teachers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
