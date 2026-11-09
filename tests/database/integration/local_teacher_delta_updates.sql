-- Included only by the disposable local fixture, after its schema and anchors.
INSERT INTO public.students(id, class_id, first_name, last_name, student_id)
VALUES('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Unchanged', 'Student', 'STABLE');

DO $$
DECLARE baseline jsonb; delta jsonb; attempts jsonb; cursor bigint;
BEGIN
  baseline := public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
  IF NOT (baseline->>'reset')::boolean OR jsonb_array_length(baseline#>'{progress,students}') <> 2 THEN RAISE EXCEPTION 'Initial full snapshot incomplete'; END IF;
  cursor := (baseline->>'revision')::bigint;
  delta := public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', cursor);
  IF delta->'roster' <> 'null'::jsonb OR delta->'progress' <> 'null'::jsonb OR delta->>'revision' <> cursor::text THEN RAISE EXCEPTION 'Idle read returned full data'; END IF;
  UPDATE public.students SET verified = false WHERE student_id = 'TEST1';
  UPDATE public.student_progress SET status = 'in_progress', completed_at = NULL WHERE id = '50000000-0000-4000-8000-000000000001';
  delta := public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', cursor);
  IF (delta->>'reset')::boolean OR jsonb_array_length(delta#>'{progress,students}') <> 1
    OR delta#>>'{progress,students,0,studentId}' <> '40000000-0000-4000-8000-000000000001'
    OR jsonb_array_length(delta#>'{roster,pending}') <> 1 THEN RAISE EXCEPTION 'Delta did not limit roster/progress to changed student'; END IF;
  IF (delta->>'revision')::bigint <> cursor + 1 THEN RAISE EXCEPTION 'More than one class revision per transaction'; END IF;
  attempts := public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', cursor, '30000000-0000-4000-8000-000000000001');
  IF jsonb_array_length(attempts#>'{attempts,students}') <> 1
    OR attempts#>>'{attempts,students,0,studentId}' <> '40000000-0000-4000-8000-000000000001'
    OR attempts#>>'{attempts,students,0,attemptCount}' <> '2'
    OR attempts#>'{attempts,students,0,attempts}' <> '[]'::jsonb
    OR attempts->'roster' <> 'null'::jsonb THEN RAISE EXCEPTION 'Attempt delta included unchanged students/history or roster'; END IF;
END $$;

-- Multiple committed changes, with no notification delivery between them, must
-- still be recovered using the older cursor.
SELECT set_config('chemclicks.test_cursor', (public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001')->>'revision'), false);
UPDATE public.students SET first_name = 'Updated' WHERE student_id = 'TEST1';
UPDATE public.students SET first_name = 'Also updated' WHERE student_id = 'STABLE';
DO $$
DECLARE delta jsonb;
BEGIN
  delta := public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', current_setting('chemclicks.test_cursor')::bigint);
  IF jsonb_array_length(delta#>'{progress,students}') <> 2 THEN RAISE EXCEPTION 'Missed notifications lost committed changes'; END IF;
END $$;

DO $$
DECLARE baseline jsonb; delta jsonb;
BEGIN
  baseline := public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
  UPDATE public.students SET class_id = '10000000-0000-4000-8000-000000000002' WHERE student_id = 'TEST1';
  delta := public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', (baseline->>'revision')::bigint);
  IF NOT (delta->'removedStudentIds' ? '40000000-0000-4000-8000-000000000001')
    OR delta#>'{progress,students}' <> '[]'::jsonb THEN RAISE EXCEPTION 'Transfer did not produce old-class tombstone'; END IF;
END $$;
DO $$
DECLARE baseline jsonb; delta jsonb;
BEGIN
  baseline := public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
  UPDATE public.students SET class_id = '10000000-0000-4000-8000-000000000001' WHERE student_id = 'TEST1';
  delta := public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', (baseline->>'revision')::bigint);
  IF jsonb_array_length(delta#>'{progress,students}') <> 1 THEN RAISE EXCEPTION 'Transfer did not add student to new class'; END IF;
END $$;
DO $$
DECLARE baseline jsonb; delta jsonb;
BEGIN
  baseline := public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
  DELETE FROM public.students WHERE student_id = 'STABLE';
  delta := public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', (baseline->>'revision')::bigint);
  IF NOT (delta->'removedStudentIds' ? '40000000-0000-4000-8000-000000000003') THEN RAISE EXCEPTION 'Deleted student lost without tombstone'; END IF;
END $$;
DO $$
DECLARE baseline jsonb; delta jsonb;
BEGIN
  baseline := public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
  UPDATE public.class_activities SET archived_at = now() WHERE id = '30000000-0000-4000-8000-000000000001';
  delta := public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', (baseline->>'revision')::bigint);
  IF NOT (delta->>'reset')::boolean OR delta#>'{progress,students,0,lessons}' <> '[]'::jsonb THEN RAISE EXCEPTION 'Assignment-wide reset failed'; END IF;
  BEGIN
    PERFORM public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', NULL, '30000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Archived assignment allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE public.class_activities SET archived_at = NULL WHERE id = '30000000-0000-4000-8000-000000000001';
DO $$
DECLARE baseline jsonb; delta jsonb;
BEGIN
  baseline := public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
  UPDATE public.activities SET title = 'Renamed covalent lesson' WHERE id = '20000000-0000-4000-8000-000000000001';
  delta := public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', (baseline->>'revision')::bigint);
  IF NOT (delta->>'reset')::boolean OR delta#>>'{progress,students,0,lessons,0,activityTitle}' <> 'Renamed covalent lesson' THEN RAISE EXCEPTION 'Catalog reset did not update labels'; END IF;
  delta := public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', (delta->>'revision')::bigint + 100);
  IF NOT (delta->>'reset')::boolean THEN RAISE EXCEPTION 'Invalid future cursor did not reset'; END IF;
END $$;

SET ROLE service_role;
DO $$
DECLARE result jsonb;
BEGIN
  result := public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
  IF result->'roster' = 'null'::jsonb OR result->'progress' = 'null'::jsonb THEN RAISE EXCEPTION 'Combined RPC not usable by server'; END IF;
  BEGIN
    PERFORM public.teacher_class_updates('00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Foreign teacher delta allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003');
    RAISE EXCEPTION 'Disabled class delta allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', NULL, '30000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'Foreign assignment delta allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.teacher_class_updates('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Browser delta RPC allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM * FROM private.teacher_changed_students;
    RAISE EXCEPTION 'Private journal exposed to browser';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
  DELETE FROM public.classes WHERE id = '10000000-0000-4000-8000-000000000002';
  IF EXISTS (SELECT 1 FROM private.teacher_class_versions WHERE class_id = '10000000-0000-4000-8000-000000000002')
    OR EXISTS (SELECT 1 FROM private.teacher_changed_students WHERE class_id = '10000000-0000-4000-8000-000000000002')
    THEN RAISE EXCEPTION 'Class cascade left tracking rows'; END IF;
END $$;
-- Live reads use the shared assignment state: a pass on a split Bohr quiz key
-- completes the lesson, and live and full reports agree row for row.
DO $$
DECLARE
  teacher uuid := '00000000-0000-4000-8000-000000000001';
  class uuid := '10000000-0000-4000-8000-000000000001';
  intro uuid := '30000000-0000-4000-8000-000000000003';
  student uuid := '40000000-0000-4000-8000-000000000009';
  updates jsonb; lesson jsonb; live jsonb; legacy jsonb;
BEGIN
  INSERT INTO public.activities(id, title, type, order_index) VALUES ('20000000-0000-4000-8000-000000000003', 'Bohr intro', 'bohr_model_intro', 1);
  INSERT INTO public.class_activities(id, class_id, activity_id) VALUES (intro, class, '20000000-0000-4000-8000-000000000003');
  INSERT INTO public.students(id, class_id, first_name, last_name, student_id, verified) VALUES (student, class, 'Split', 'Bohr', 'SPLIT', true);
  INSERT INTO public.student_progress(id, student_id, class_activity_id, status, started_at, completed_at, exploration_started_at)
  -- Exploration is unfinished, so only the quiz pass can complete the lesson.
  VALUES ('50000000-0000-4000-8000-000000000009', student, intro, 'in_progress', now() - interval '9 minutes', NULL, now() - interval '9 minutes');
  INSERT INTO public.student_attempts(id, progress_id, attempt_number, status, quiz_key, score, question_total, percentage, passed, started_at, completed_at) VALUES
  ('60000000-0000-4000-8000-000000000009', '50000000-0000-4000-8000-000000000009', 1, 'completed', 'bohr_model_intro', 9, 10, 90, true, now() - interval '4 minutes', now());

  updates := public.teacher_class_updates(teacher, class);
  SELECT l INTO lesson FROM jsonb_array_elements(updates#>'{progress,students}') st, jsonb_array_elements(st->'lessons') l
    WHERE st->>'studentId' = student::text AND l->>'assignmentId' = intro::text;
  IF lesson->>'status' <> 'completed' OR lesson->>'stage' <> 'completed' OR lesson->>'passingQuizAttemptNumber' <> '1'
    THEN RAISE EXCEPTION 'Live progress ignored a split Bohr quiz pass: %', lesson; END IF;
  IF updates#>'{progress,students}' <> public.teacher_class_lesson_progress(teacher, class)->'students'
    THEN RAISE EXCEPTION 'Live and full class progress disagree'; END IF;

  live := public.teacher_class_updates(teacher, class, NULL, intro)->'attempts';
  legacy := public.teacher_activity_attempt_summary(teacher, class, intro);
  IF (SELECT x->>'progressStage' FROM jsonb_array_elements(live->'students') x WHERE x->>'studentId' = student::text) <> 'completed'
    THEN RAISE EXCEPTION 'Live attempts ignored a split Bohr quiz pass'; END IF;
  IF jsonb_array_length(legacy#>'{students,0,attempts}') + jsonb_array_length(legacy#>'{students,1,attempts}') = 0
    THEN RAISE EXCEPTION 'Full summary lost histories'; END IF;
  IF (SELECT jsonb_agg(x - 'attempts' ORDER BY n) FROM jsonb_array_elements(live->'students') WITH ORDINALITY e(x, n))
    <> (SELECT jsonb_agg(x - 'attempts' ORDER BY n) FROM jsonb_array_elements(legacy->'students') WITH ORDINALITY e(x, n))
    OR live - 'students' <> legacy - 'students'
    THEN RAISE EXCEPTION 'Live and full attempt summaries disagree'; END IF;
END $$;
SELECT 'PASS: combined full/delta/idle reads, student-only calculations, missed notifications, tombstones, transfers, assignment/catalog resets, future cursors, grants, and shared-state agreement' AS result;
