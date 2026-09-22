-- Passwordless student Supabase Auth and RLS.
--
-- DEVELOPMENT RESET: existing student rows and all rows in tables that depend
-- on them are intentionally removed. Teacher accounts and classrooms remain.
-- New students use one UUID for both auth.users.id and public.students.id.

BEGIN;

-- Remove hidden student Auth identities created during testing. Teacher Auth
-- users are preserved because only student provisioning sets this metadata.
DELETE FROM auth.users
WHERE raw_app_meta_data ->> 'account_type' = 'student'
   OR raw_user_meta_data ->> 'account_type' = 'student';

-- TRUNCATE CASCADE clears student progress/attempt data that references students.
TRUNCATE TABLE public.students CASCADE;

-- public.students is now the application profile for the Auth identity.
ALTER TABLE public.students
  ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_id_fkey;
ALTER TABLE public.students
  ADD CONSTRAINT students_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Security-definer lookup avoids recursive RLS between students and classes.
-- Authorization still comes exclusively from the verified JWT's auth.uid().
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.current_active_student_class_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.class_id
  FROM public.students AS s
  JOIN public.classes AS c ON c.id = s.class_id
  WHERE s.id = (SELECT auth.uid())
    AND c.is_active = true
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION private.current_active_student_class_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_active_student_class_id() TO authenticated;

-- The linked project currently has no students SELECT policies. Preserve
-- teacher access to students in their own classes as well as student self-read.
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chemclicks_students_select_teacher_class" ON public.students;
CREATE POLICY "chemclicks_students_select_teacher_class"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.classes AS c
      WHERE c.id = students.class_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "chemclicks_students_select_self" ON public.students;
CREATE POLICY "chemclicks_students_select_self"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chemclicks_classes_select_student_class" ON public.classes;
CREATE POLICY "chemclicks_classes_select_student_class"
  ON public.classes
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT private.current_active_student_class_id())
  );

ALTER TABLE public.class_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chemclicks_class_activities_select_student_class" ON public.class_activities;
CREATE POLICY "chemclicks_class_activities_select_student_class"
  ON public.class_activities
  FOR SELECT
  TO authenticated
  USING (
    class_id = (SELECT private.current_active_student_class_id())
  );

-- Activities are shared catalog entries, not class-specific data. The linked
-- project's activities table has RLS enabled without a SELECT policy, which
-- hides rows in the student assignment reader's activities!inner join (and in
-- the teacher activity picker). Anonymous access remains denied.
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chemclicks_activities_select_authenticated" ON public.activities;
CREATE POLICY "chemclicks_activities_select_authenticated"
  ON public.activities
  FOR SELECT
  TO authenticated
  USING (true);

-- Student progress was previously isolated only by service-role server queries.
-- These policies move isolation to Postgres while retaining teacher visibility.
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.student_progress FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.student_progress TO authenticated;

DROP POLICY IF EXISTS "chemclicks_student_progress_select_teacher_class" ON public.student_progress;
CREATE POLICY "chemclicks_student_progress_select_teacher_class"
  ON public.student_progress
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.students AS s
      JOIN public.classes AS c ON c.id = s.class_id
      WHERE s.id = student_progress.student_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "chemclicks_student_progress_select_self" ON public.student_progress;
CREATE POLICY "chemclicks_student_progress_select_self"
  ON public.student_progress
  FOR SELECT
  TO authenticated
  USING (
    student_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "chemclicks_student_progress_insert_self" ON public.student_progress;
CREATE POLICY "chemclicks_student_progress_insert_self"
  ON public.student_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.class_activities AS ca
      WHERE ca.id = student_progress.class_activity_id
        AND ca.class_id = (SELECT private.current_active_student_class_id())
    )
  );

DROP POLICY IF EXISTS "chemclicks_student_progress_update_self" ON public.student_progress;
CREATE POLICY "chemclicks_student_progress_update_self"
  ON public.student_progress
  FOR UPDATE
  TO authenticated
  USING (
    student_id = (SELECT auth.uid())
  )
  WITH CHECK (
    student_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.class_activities AS ca
      WHERE ca.id = student_progress.class_activity_id
        AND ca.class_id = (SELECT private.current_active_student_class_id())
    )
  );

COMMIT;
