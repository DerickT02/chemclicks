-- SCRUM-235: a teacher can assign work to a class regardless of pending
-- students, and a student gets access to the class's existing assignments
-- the moment they are approved, without any separate "grant access" step.
--
-- This holds structurally, not by new code: class_activities is scoped by
-- class_id alone (no per-student assignment list to populate or duplicate),
-- and approval only flips students.verified. This fixture proves that
-- behavior end-to-end rather than exercising new logic.
--
-- Transactional fixtures: no retained test data.
BEGIN;
DO $$
DECLARE
  teacher uuid; activity uuid; c uuid; other_class uuid;
  approved_before uuid; pending_before uuid; pending_after uuid; outsider uuid;
  assignment uuid;
  assignment_count int; progress_count int; attempt_count int;
  opens_before timestamptz; closes_before timestamptz;
  opens_after timestamptz; closes_after timestamptz; archived_after timestamptz;
BEGIN
  SELECT t.id INTO teacher FROM public.teachers t JOIN auth.users u ON u.id=t.id
    WHERE u.email_confirmed_at IS NOT NULL AND NOT COALESCE(u.is_anonymous,false) LIMIT 1;
  SELECT id INTO activity FROM public.activities WHERE type='lewis_diagram' LIMIT 1;
  IF teacher IS NULL OR activity IS NULL THEN
    RAISE EXCEPTION 'Verified teacher and lewis_diagram activity required';
  END IF;

  INSERT INTO public.classes(teacher_id,name,section,class_code) VALUES
    (teacher,'Assign while pending test','Test',upper(substr(md5(random()::text),1,6))) RETURNING id INTO c;
  INSERT INTO public.classes(teacher_id,name,section,class_code) VALUES
    (teacher,'Other assign while pending test','Test',upper(substr(md5(random()::text),1,6))) RETURNING id INTO other_class;

  -- Mixed roster registered before any assignment exists.
  INSERT INTO public.students(class_id,first_name,last_name,student_id,verified)
    VALUES(c,'Approved','Before',gen_random_uuid()::text,true) RETURNING id INTO approved_before;
  INSERT INTO public.students(class_id,first_name,last_name,student_id,verified)
    VALUES(c,'Pending','Before',gen_random_uuid()::text,false) RETURNING id INTO pending_before;

  -- The teacher assigns work to the class despite a pending student on the
  -- roster. Nothing in class_activities references students, so this is a
  -- plain insert, not a conditional one.
  INSERT INTO public.class_activities(class_id,activity_id,opens_at,closes_at)
    VALUES(c,activity,'2026-01-01T00:00:00Z','2026-12-31T00:00:00Z') RETURNING id INTO assignment;

  -- A second student registers after the assignment already exists.
  INSERT INTO public.students(class_id,first_name,last_name,student_id,verified)
    VALUES(c,'Pending','After',gen_random_uuid()::text,false) RETURNING id INTO pending_after;
  INSERT INTO public.students(class_id,first_name,last_name,student_id,verified)
    VALUES(other_class,'Outsider','Test',gen_random_uuid()::text,true) RETURNING id INTO outsider;

  -- Before any approval: no progress or attempts exist for anyone yet.
  SELECT count(*) INTO progress_count FROM public.student_progress
    WHERE student_id IN (approved_before, pending_before, pending_after);
  SELECT count(*) INTO attempt_count FROM public.student_attempts sa
    JOIN public.student_progress p ON p.id = sa.progress_id
    WHERE p.student_id IN (approved_before, pending_before, pending_after);
  IF progress_count<>0 OR attempt_count<>0 THEN
    RAISE EXCEPTION 'Enrollment or assignment creation must not fabricate progress/attempt rows';
  END IF;

  SELECT opens_at, closes_at INTO opens_before, closes_before
    FROM public.class_activities WHERE id = assignment;

  -- Approve both pending students the same way approveOwnedStudent /
  -- approveOwnedStudents do: flip verified only, touch nothing else.
  UPDATE public.students SET verified = true WHERE id IN (pending_before, pending_after);

  -- Approval must not create, duplicate, or alter the assignment, and must
  -- not fabricate progress for the newly approved students.
  SELECT count(*) INTO assignment_count FROM public.class_activities
    WHERE class_id = c AND activity_id = activity AND archived_at IS NULL;
  IF assignment_count<>1 THEN
    RAISE EXCEPTION 'Approval must not create or duplicate class assignments (got %)', assignment_count;
  END IF;

  SELECT opens_at, closes_at INTO opens_after, closes_after
    FROM public.class_activities WHERE id = assignment;
  IF opens_after IS DISTINCT FROM opens_before OR closes_after IS DISTINCT FROM closes_before THEN
    RAISE EXCEPTION 'Approval must not change the assignment schedule';
  END IF;

  SELECT count(*) INTO progress_count FROM public.student_progress
    WHERE student_id IN (pending_before, pending_after);
  IF progress_count<>0 THEN
    RAISE EXCEPTION 'A newly approved student must start with no progress, not a copy of another student''s';
  END IF;

  -- The assignment is visible to every student in the class purely by
  -- class_id, exactly as getStudentWorkQueue reads it — no per-student grant
  -- step exists or is needed.
  IF NOT EXISTS (
    SELECT 1 FROM public.class_activities
    WHERE id = assignment AND class_id IN (SELECT class_id FROM public.students WHERE id = approved_before)
  ) THEN
    RAISE EXCEPTION 'Assignment should already be visible to a student approved before it existed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.class_activities
    WHERE id = assignment AND class_id IN (SELECT class_id FROM public.students WHERE id = pending_before)
  ) THEN
    RAISE EXCEPTION 'Assignment should be visible to a student who registered before it and was approved after';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.class_activities
    WHERE id = assignment AND class_id IN (SELECT class_id FROM public.students WHERE id = pending_after)
  ) THEN
    RAISE EXCEPTION 'Assignment should be visible to a student who registered after it and was approved later';
  END IF;

  -- Cross-class: the outsider's class never sees this assignment.
  IF EXISTS (
    SELECT 1 FROM public.class_activities
    WHERE id = assignment AND class_id = (SELECT class_id FROM public.students WHERE id = outsider)
  ) THEN
    RAISE EXCEPTION 'Assignment must not be visible to a different class';
  END IF;

  -- A second, concurrent assignment of the same activity to the same class
  -- is rejected by the existing uniqueness guarantee rather than silently
  -- creating a duplicate.
  BEGIN
    INSERT INTO public.class_activities(class_id,activity_id) VALUES(c,activity);
    RAISE EXCEPTION 'A duplicate concurrent assignment should have been rejected';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Archiving still works normally after approval, and approval does not
  -- restore or otherwise touch archived work.
  UPDATE public.class_activities SET archived_at = now() WHERE id = assignment;
  UPDATE public.students SET verified = true WHERE id = pending_after;
  SELECT archived_at INTO archived_after FROM public.class_activities WHERE id = assignment;
  IF archived_after IS NULL THEN
    RAISE EXCEPTION 'A later approval must not un-archive an assignment';
  END IF;
END $$;
SELECT 'PASS: assignment creation while pending, approval granting access without duplication, and cross-class isolation' AS result;
ROLLBACK;
