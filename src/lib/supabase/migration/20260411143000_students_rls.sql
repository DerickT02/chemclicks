-- Students RLS: authenticated teachers may read/insert/update/delete only student
-- rows that belong to classes they own.
--
-- Apply in Supabase: SQL Editor -> New query -> paste -> Run.
-- These drops are safe to rerun.

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chemclicks_students_select_teacher_class" ON public.students;
DROP POLICY IF EXISTS "chemclicks_students_insert_teacher_class" ON public.students;
DROP POLICY IF EXISTS "chemclicks_students_update_teacher_class" ON public.students;
DROP POLICY IF EXISTS "chemclicks_students_delete_teacher_class" ON public.students;

CREATE POLICY "chemclicks_students_select_teacher_class"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.classes c
      WHERE c.id = students.class_id
        AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "chemclicks_students_insert_teacher_class"
  ON public.students
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.classes c
      WHERE c.id = students.class_id
        AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "chemclicks_students_update_teacher_class"
  ON public.students
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.classes c
      WHERE c.id = students.class_id
        AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.classes c
      WHERE c.id = students.class_id
        AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "chemclicks_students_delete_teacher_class"
  ON public.students
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.classes c
      WHERE c.id = students.class_id
        AND c.teacher_id = auth.uid()
    )
  );
