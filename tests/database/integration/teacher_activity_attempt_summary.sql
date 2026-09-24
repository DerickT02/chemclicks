-- Transactional fixtures: no retained test data.
BEGIN;
DO $$
DECLARE
  teacher uuid; activity uuid; c uuid; other_class uuid; assignment uuid; other_assignment uuid;
  zero_student uuid; empty_student uuid; one_student uuid; many_student uuid; outsider uuid;
  progress uuid; result jsonb; row_data jsonb; second_assignment uuid; second_activity uuid;
BEGIN
  SELECT t.id INTO teacher FROM public.teachers t JOIN auth.users u ON u.id=t.id
    WHERE u.email_confirmed_at IS NOT NULL AND NOT COALESCE(u.is_anonymous,false) LIMIT 1;
  SELECT id INTO activity FROM public.activities LIMIT 1;
  IF teacher IS NULL OR activity IS NULL THEN RAISE EXCEPTION 'Verified teacher and activity anchors required'; END IF;
  INSERT INTO public.classes(teacher_id,name,section,class_code) VALUES
    (teacher,'Summary test','Test',upper(substr(md5(random()::text),1,6))) RETURNING id INTO c;
  INSERT INTO public.classes(teacher_id,name,section,class_code) VALUES
    (teacher,'Other summary test','Test',upper(substr(md5(random()::text),1,6))) RETURNING id INTO other_class;
  INSERT INTO public.class_activities(class_id,activity_id) VALUES(c,activity) RETURNING id INTO assignment;
  INSERT INTO public.class_activities(class_id,activity_id) VALUES(other_class,activity) RETURNING id INTO other_assignment;
  INSERT INTO public.students(class_id,first_name,last_name,student_id) VALUES(c,'Zero','Test',gen_random_uuid()::text) RETURNING id INTO zero_student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id) VALUES(c,'Empty','Test',gen_random_uuid()::text) RETURNING id INTO empty_student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id) VALUES(c,'One','Test',gen_random_uuid()::text) RETURNING id INTO one_student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id) VALUES(c,'Many','Test',gen_random_uuid()::text) RETURNING id INTO many_student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id) VALUES(other_class,'Outsider','Test',gen_random_uuid()::text) RETURNING id INTO outsider;
  INSERT INTO public.student_progress(student_id,class_activity_id) VALUES(empty_student,assignment);
  INSERT INTO public.student_progress(student_id,class_activity_id) VALUES(one_student,assignment) RETURNING id INTO progress;
  INSERT INTO public.student_attempts(progress_id,attempt_number) VALUES(progress,1);
  INSERT INTO public.student_progress(student_id,class_activity_id) VALUES(many_student,assignment) RETURNING id INTO progress;
  INSERT INTO public.student_attempts(progress_id,attempt_number,status,started_at,completed_at) VALUES
    (progress,1,'completed','2026-01-01T10:00:00Z','2026-01-01T10:05:00Z'),
    (progress,2,'in_progress','2026-01-02T10:00:00Z',NULL);
  -- Malformed cross-class progress must neither enter the roster nor inflate totals.
  INSERT INTO public.student_progress(student_id,class_activity_id) VALUES(outsider,assignment) RETURNING id INTO progress;
  INSERT INTO public.student_attempts(progress_id,attempt_number) VALUES(progress,1);
  INSERT INTO public.student_progress(student_id,class_activity_id) VALUES(zero_student,other_assignment) RETURNING id INTO progress;
  INSERT INTO public.student_attempts(progress_id,attempt_number) VALUES(progress,1);
  SELECT id INTO second_activity FROM public.activities WHERE id<>activity LIMIT 1;
  INSERT INTO public.class_activities(class_id,activity_id) VALUES(c,second_activity) RETURNING id INTO second_assignment;
  INSERT INTO public.student_progress(student_id,class_activity_id) VALUES(zero_student,second_assignment) RETURNING id INTO progress;
  INSERT INTO public.student_attempts(progress_id,attempt_number) VALUES(progress,1);
  SET LOCAL ROLE service_role;
  result := public.teacher_activity_attempt_summary(teacher,c,assignment);
  IF jsonb_array_length(result->'students')<>4 THEN RAISE EXCEPTION 'Roster not scoped correctly'; END IF;
  FOR row_data IN SELECT value FROM jsonb_array_elements(result->'students') LOOP
    IF row_data->>'studentId' IN (zero_student::text,empty_student::text) THEN
      IF row_data->>'attemptCount'<>'0' OR row_data->'attempts'<>'[]'::jsonb THEN RAISE EXCEPTION 'Zero attempts missing'; END IF;
    ELSIF row_data->>'studentId'=one_student::text THEN
      IF row_data->>'attemptCount'<>'1' OR row_data->>'inProgressCount'<>'1' THEN RAISE EXCEPTION 'One attempt wrong'; END IF;
    ELSIF row_data->>'studentId'=many_student::text THEN
      IF row_data->>'attemptCount'<>'2' OR row_data->>'completedCount'<>'1' OR row_data->>'inProgressCount'<>'1'
        OR row_data#>>'{attempts,0,attemptNumber}'<>'2'
        OR row_data#>>'{attempts,0,status}'<>'in_progress'
        OR row_data#>'{attempts,0,completedAt}'<>'null'::jsonb
        OR (row_data#>>'{attempts,1,completedAt}')::timestamptz<>'2026-01-01T10:05:00Z'::timestamptz
        THEN RAISE EXCEPTION 'History counts, ordering or timestamps wrong'; END IF;
    ELSE RAISE EXCEPTION 'Foreign student included'; END IF;
  END LOOP;
  BEGIN PERFORM public.teacher_activity_attempt_summary(gen_random_uuid(),c,assignment); RAISE EXCEPTION 'Foreign teacher allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.teacher_activity_attempt_summary(teacher,c,other_assignment); RAISE EXCEPTION 'Foreign assignment allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  DELETE FROM public.students WHERE class_id=other_class;
  SET LOCAL ROLE service_role;
  result := public.teacher_activity_attempt_summary(teacher,other_class,other_assignment);
  IF result->'students'<>'[]'::jsonb THEN RAISE EXCEPTION 'Empty roster failed'; END IF;
  RESET ROLE;
  INSERT INTO public.students(class_id,first_name,last_name,student_id)
    SELECT other_class,'Roster',n::text,gen_random_uuid()::text FROM generate_series(1,1001) n;
  SET LOCAL ROLE service_role;
  result := public.teacher_activity_attempt_summary(teacher,other_class,other_assignment);
  IF jsonb_array_length(result->'students')<>1001 THEN RAISE EXCEPTION 'Large roster truncated'; END IF;
  RESET ROLE;
  SET LOCAL ROLE anon;
  BEGIN PERFORM public.teacher_activity_attempt_summary(teacher,c,assignment); RAISE EXCEPTION 'Anonymous RPC allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.teacher_activity_attempt_summary(teacher,c,assignment); RAISE EXCEPTION 'Browser RPC allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
END $$;
SELECT 'PASS: zero/one/many, timestamps, roster and assignment isolation, teacher authorization and RPC grants' AS result;
ROLLBACK;
