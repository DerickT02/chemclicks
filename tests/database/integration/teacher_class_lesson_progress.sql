-- Transactional fixtures: no retained test data.
BEGIN;
DO $$
DECLARE
  teacher uuid; c uuid; other_class uuid;
  bohr_activity uuid; covalent_activity uuid; diagram_activity uuid;
  bohr_assignment uuid; covalent_assignment uuid; diagram_assignment uuid;
  not_started_student uuid; bohr_in_progress_student uuid; bohr_completed_student uuid;
  covalent_explorer_only_student uuid; covalent_both_done_student uuid;
  diagram_in_progress_student uuid; outsider uuid;
  progress uuid; result jsonb; row_data jsonb; lesson jsonb;
BEGIN
  SELECT t.id INTO teacher FROM public.teachers t JOIN auth.users u ON u.id=t.id
    WHERE u.email_confirmed_at IS NOT NULL AND NOT COALESCE(u.is_anonymous,false) LIMIT 1;
  SELECT id INTO bohr_activity FROM public.activities WHERE type='bohr_model_intro' LIMIT 1;
  SELECT id INTO covalent_activity FROM public.activities WHERE type='lewis_structures_covalent' LIMIT 1;
  SELECT id INTO diagram_activity FROM public.activities WHERE type='lewis_diagram' LIMIT 1;
  IF teacher IS NULL OR bohr_activity IS NULL OR covalent_activity IS NULL OR diagram_activity IS NULL THEN
    RAISE EXCEPTION 'Verified teacher and bohr_model_intro/lewis_structures_covalent/lewis_diagram activities required';
  END IF;

  INSERT INTO public.classes(teacher_id,name,section,class_code) VALUES
    (teacher,'Lesson progress test','Test',upper(substr(md5(random()::text),1,6))) RETURNING id INTO c;
  INSERT INTO public.classes(teacher_id,name,section,class_code) VALUES
    (teacher,'Other lesson progress test','Test',upper(substr(md5(random()::text),1,6))) RETURNING id INTO other_class;

  INSERT INTO public.class_activities(class_id,activity_id) VALUES(c,bohr_activity) RETURNING id INTO bohr_assignment;
  INSERT INTO public.class_activities(class_id,activity_id) VALUES(c,covalent_activity) RETURNING id INTO covalent_assignment;
  INSERT INTO public.class_activities(class_id,activity_id) VALUES(c,diagram_activity) RETURNING id INTO diagram_assignment;

  INSERT INTO public.students(class_id,first_name,last_name,student_id)
    VALUES(c,'Not','Started',gen_random_uuid()::text) RETURNING id INTO not_started_student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id)
    VALUES(c,'BohrInProgress','Test',gen_random_uuid()::text) RETURNING id INTO bohr_in_progress_student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id)
    VALUES(c,'BohrCompleted','Test',gen_random_uuid()::text) RETURNING id INTO bohr_completed_student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id)
    VALUES(c,'CovalentExplorerOnly','Test',gen_random_uuid()::text) RETURNING id INTO covalent_explorer_only_student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id)
    VALUES(c,'CovalentBothDone','Test',gen_random_uuid()::text) RETURNING id INTO covalent_both_done_student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id)
    VALUES(c,'DiagramInProgress','Test',gen_random_uuid()::text) RETURNING id INTO diagram_in_progress_student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id)
    VALUES(other_class,'Outsider','Test',gen_random_uuid()::text) RETURNING id INTO outsider;

  -- Bohr (quiz-only): an attempt that failed to pass still counts as in_progress, not completed.
  INSERT INTO public.student_progress(student_id,class_activity_id) VALUES(bohr_in_progress_student,bohr_assignment) RETURNING id INTO progress;
  INSERT INTO public.student_attempts(progress_id,attempt_number,quiz_key,question_total,score,percentage,passed,status,completed_at)
    VALUES(progress,1,'bohr_models',10,5,50.00,false,'completed',now());

  -- Bohr (quiz-only): a passing attempt means completed, even though student_progress.status is still 'not_started'.
  INSERT INTO public.student_progress(student_id,class_activity_id) VALUES(bohr_completed_student,bohr_assignment) RETURNING id INTO progress;
  INSERT INTO public.student_attempts(progress_id,attempt_number,quiz_key,question_total,score,percentage,passed,status,completed_at)
    VALUES(progress,1,'bohr_models',10,9,90.00,true,'completed',now());

  -- Covalent (dual): explorer completed, quiz never attempted -> in_progress, not completed.
  INSERT INTO public.student_progress(student_id,class_activity_id,status) VALUES(covalent_explorer_only_student,covalent_assignment,'completed') RETURNING id INTO progress;

  -- Covalent (dual): explorer completed AND quiz passed -> completed.
  INSERT INTO public.student_progress(student_id,class_activity_id,status) VALUES(covalent_both_done_student,covalent_assignment,'completed') RETURNING id INTO progress;
  INSERT INTO public.student_attempts(progress_id,attempt_number,quiz_key,question_total,score,percentage,passed,status,completed_at)
    VALUES(progress,1,'lewis_covalent',12,11,91.67,true,'completed',now());

  -- Lewis diagram (exploration-only): status is read straight off student_progress.
  INSERT INTO public.student_progress(student_id,class_activity_id,status) VALUES(diagram_in_progress_student,diagram_assignment,'in_progress');

  -- Malformed cross-class progress must neither enter the roster nor leak into it.
  INSERT INTO public.student_progress(student_id,class_activity_id,status) VALUES(outsider,bohr_assignment,'completed');

  SET LOCAL ROLE service_role;
  result := public.teacher_class_lesson_progress(teacher,c);

  IF jsonb_array_length(result->'students')<>6 THEN RAISE EXCEPTION 'Roster not scoped correctly (got %)', jsonb_array_length(result->'students'); END IF;

  FOR row_data IN SELECT value FROM jsonb_array_elements(result->'students') LOOP
    IF row_data->>'studentId'=not_started_student::text THEN
      IF row_data->>'overallPercent'<>'0' THEN RAISE EXCEPTION 'Not-started student should be 0%%'; END IF;
      FOR lesson IN SELECT value FROM jsonb_array_elements(row_data->'lessons') LOOP
        IF lesson->>'status'<>'not_started' THEN RAISE EXCEPTION 'Untouched lesson should be not_started, got %', lesson->>'status'; END IF;
      END LOOP;

    ELSIF row_data->>'studentId'=bohr_in_progress_student::text THEN
      SELECT value INTO lesson FROM jsonb_array_elements(row_data->'lessons') WHERE value->>'activityId'=bohr_activity::text;
      IF lesson->>'status'<>'in_progress' THEN RAISE EXCEPTION 'Failed bohr attempt should read in_progress, got %', lesson->>'status'; END IF;

    ELSIF row_data->>'studentId'=bohr_completed_student::text THEN
      SELECT value INTO lesson FROM jsonb_array_elements(row_data->'lessons') WHERE value->>'activityId'=bohr_activity::text;
      IF lesson->>'status'<>'completed' THEN RAISE EXCEPTION 'Passed bohr quiz should read completed even though student_progress.status is untouched, got %', lesson->>'status'; END IF;
      IF lesson->>'activityTitle' IS NULL OR lesson->>'activityTitle'='' THEN RAISE EXCEPTION 'Lesson must carry a name, not just an id'; END IF;

    ELSIF row_data->>'studentId'=covalent_explorer_only_student::text THEN
      SELECT value INTO lesson FROM jsonb_array_elements(row_data->'lessons') WHERE value->>'activityId'=covalent_activity::text;
      IF lesson->>'status'<>'in_progress' THEN RAISE EXCEPTION 'Explorer-only covalent lesson should read in_progress, not completed, got %', lesson->>'status'; END IF;

    ELSIF row_data->>'studentId'=covalent_both_done_student::text THEN
      SELECT value INTO lesson FROM jsonb_array_elements(row_data->'lessons') WHERE value->>'activityId'=covalent_activity::text;
      IF lesson->>'status'<>'completed' THEN RAISE EXCEPTION 'Covalent lesson with both halves done should read completed, got %', lesson->>'status'; END IF;

    ELSIF row_data->>'studentId'=diagram_in_progress_student::text THEN
      SELECT value INTO lesson FROM jsonb_array_elements(row_data->'lessons') WHERE value->>'activityId'=diagram_activity::text;
      IF lesson->>'status'<>'in_progress' THEN RAISE EXCEPTION 'Exploration-only lesson should read student_progress.status directly, got %', lesson->>'status'; END IF;

    ELSE RAISE EXCEPTION 'Foreign or unexpected student included: %', row_data->>'studentId';
    END IF;
  END LOOP;

  -- Ownership and grant checks, mirroring teacher_activity_attempt_summary.
  BEGIN PERFORM public.teacher_class_lesson_progress(gen_random_uuid(),c); RAISE EXCEPTION 'Foreign teacher allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.teacher_class_lesson_progress(teacher,other_class); RAISE EXCEPTION 'Foreign class allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;

  SET LOCAL ROLE service_role;
  result := public.teacher_class_lesson_progress(teacher,other_class);
  IF result->'students'<>'[]'::jsonb THEN RAISE EXCEPTION 'Empty roster failed'; END IF;
  RESET ROLE;

  SET LOCAL ROLE anon;
  BEGIN PERFORM public.teacher_class_lesson_progress(teacher,c); RAISE EXCEPTION 'Anonymous RPC allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;

  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.teacher_class_lesson_progress(teacher,c); RAISE EXCEPTION 'Browser RPC allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
END $$;
SELECT 'PASS: per-activity-type status derivation, lesson names, roster scoping, teacher authorization and RPC grants' AS result;
ROLLBACK;
