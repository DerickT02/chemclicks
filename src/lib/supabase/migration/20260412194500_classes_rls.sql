-- Classes RLS: authenticated teachers may read/insert/update/delete only rows where
-- teacher_id matches their auth user id (same pattern as integration tests).
--
-- Apply in Supabase: SQL Editor → New query → paste → Run.
-- If policies with these names already exist, DROP statements are safe to re-run.

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chemclicks_classes_select_own" ON public.classes;
DROP POLICY IF EXISTS "chemclicks_classes_insert_own" ON public.classes;
DROP POLICY IF EXISTS "chemclicks_classes_update_own" ON public.classes;
DROP POLICY IF EXISTS "chemclicks_classes_delete_own" ON public.classes;

CREATE POLICY "chemclicks_classes_select_own"
  ON public.classes
  FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "chemclicks_classes_insert_own"
  ON public.classes
  FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "chemclicks_classes_update_own"
  ON public.classes
  FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "chemclicks_classes_delete_own"
  ON public.classes
  FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());
