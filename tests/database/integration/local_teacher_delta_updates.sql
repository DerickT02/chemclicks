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
SELECT 'PASS: combined full/delta/idle reads, student-only calculations, missed notifications, tombstones, transfers, assignment/catalog resets, future cursors and grants' AS result;
