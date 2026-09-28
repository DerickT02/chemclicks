-- Automated assertions; all fixture rows are rolled back.
BEGIN;
DO $$
DECLARE
  c uuid; assignment uuid; student uuid; other_student uuid; teacher uuid;
  activity uuid; first_attempt public.student_attempts%ROWTYPE;
  finished public.student_attempts%ROWTYPE; second_attempt public.student_attempts%ROWTYPE;
  result public.student_attempts%ROWTYPE; n integer; progress uuid;
BEGIN
  SELECT id INTO teacher FROM public.teachers LIMIT 1;
  SELECT id INTO activity FROM public.activities WHERE type::text='lewis_diagram' LIMIT 1;
  IF teacher IS NULL OR activity IS NULL THEN RAISE EXCEPTION 'Teacher and Lewis activity anchors required'; END IF;
  INSERT INTO public.classes(teacher_id,name,section,class_code)
    VALUES(teacher,'Lifecycle test','Test',upper(substr(md5(random()::text),1,6))) RETURNING id INTO c;
  INSERT INTO public.class_activities(class_id,activity_id) VALUES(c,activity) RETURNING id INTO assignment;
  INSERT INTO public.students(class_id,first_name,last_name,student_id,verified)
    VALUES(c,'Lifecycle','Test',gen_random_uuid()::text,true) RETURNING id INTO student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id,verified)
    VALUES(c,'Other','Test',gen_random_uuid()::text,true) RETURNING id INTO other_student;
  SET LOCAL ROLE service_role;
  SELECT * INTO first_attempt FROM public.student_attempt_transition(student,c,assignment,'start',NULL);
  SELECT * INTO result FROM public.student_attempt_transition(student,c,assignment,'start',NULL);
  IF result.id<>first_attempt.id OR result.attempt_number<>1 OR result.status<>'in_progress' THEN RAISE EXCEPTION 'Repeated start inflated attempts'; END IF;
  progress := first_attempt.progress_id;
  IF NOT EXISTS(SELECT 1 FROM public.student_progress WHERE id=progress AND status='in_progress' AND started_at=first_attempt.started_at) THEN RAISE EXCEPTION 'Start progress not synchronized'; END IF;
  BEGIN PERFORM public.student_attempt_transition(student,c,assignment,'retry',first_attempt.id); RAISE EXCEPTION 'Retry unfinished allowed'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM public.student_attempt_transition(other_student,c,assignment,'complete',first_attempt.id); RAISE EXCEPTION 'Other student completion allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  SELECT * INTO finished FROM public.student_attempt_transition(student,c,assignment,'complete',first_attempt.id);
  IF finished.status<>'completed' OR finished.completed_at<finished.started_at OR finished.score IS NOT NULL OR finished.passed IS NOT NULL THEN RAISE EXCEPTION 'Completion incorrect'; END IF;
  SELECT * INTO result FROM public.student_attempt_transition(student,c,assignment,'complete',first_attempt.id);
  IF result.completed_at<>finished.completed_at OR result.updated_at<>finished.updated_at THEN RAISE EXCEPTION 'Replayed completion changed timestamps'; END IF;
  SELECT * INTO result FROM public.student_attempt_transition(student,c,assignment,'start',NULL);
  IF result.id<>finished.id THEN RAISE EXCEPTION 'Start after complete inflated attempts'; END IF;
  SELECT * INTO second_attempt FROM public.student_attempt_transition(student,c,assignment,'retry',finished.id);
  IF second_attempt.id=finished.id OR second_attempt.attempt_number<>2 OR second_attempt.status<>'in_progress' THEN RAISE EXCEPTION 'Retry failed'; END IF;
  SELECT * INTO result FROM public.student_attempt_transition(student,c,assignment,'retry',finished.id);
  IF result.id<>second_attempt.id THEN RAISE EXCEPTION 'Duplicate retry inflated attempts'; END IF;
  PERFORM public.student_attempt_transition(student,c,assignment,'complete',finished.id);
  IF NOT EXISTS(SELECT 1 FROM public.student_progress WHERE id=progress AND status='in_progress' AND completed_at IS NULL) THEN RAISE EXCEPTION 'Stale completion overwrote retry progress'; END IF;
  PERFORM public.student_attempt_transition(student,c,assignment,'complete',second_attempt.id);
  IF NOT EXISTS(SELECT 1 FROM public.student_progress WHERE id=progress AND status='completed' AND completed_at IS NOT NULL) THEN RAISE EXCEPTION 'Completion progress incorrect'; END IF;
  PERFORM public.student_attempt_transition(student,c,assignment,'retry',finished.id);
  SELECT count(*) INTO n FROM public.student_attempts WHERE progress_id=progress;
  IF n<>2 THEN RAISE EXCEPTION 'Stale retry inflated attempts'; END IF;
  BEGIN PERFORM public.student_attempt_transition(student,gen_random_uuid(),assignment,'start',NULL); RAISE EXCEPTION 'Cross-class start allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.student_attempt_transition(student,c,assignment,'complete',gen_random_uuid()); RAISE EXCEPTION 'Forged attempt allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.student_attempt_transition(student,c,assignment,'invalid',NULL); RAISE EXCEPTION 'Invalid action allowed'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  RESET ROLE;
  UPDATE public.class_activities SET closes_at=now()-interval '1 second' WHERE id=assignment;
  SET LOCAL ROLE service_role;
  BEGIN PERFORM public.student_attempt_transition(student,c,assignment,'retry',second_attempt.id); RAISE EXCEPTION 'Closed retry allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  UPDATE public.class_activities SET closes_at=NULL,opens_at=now()+interval '1 day' WHERE id=assignment;
  SET LOCAL ROLE service_role;
  BEGIN PERFORM public.student_attempt_transition(student,c,assignment,'start',NULL); RAISE EXCEPTION 'Future assignment allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  SET LOCAL ROLE anon;
  BEGIN PERFORM public.student_attempt_transition(student,c,assignment,'start',NULL); RAISE EXCEPTION 'Anonymous RPC allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.student_attempt_transition(student,c,assignment,'start',NULL); RAISE EXCEPTION 'Authenticated browser RPC allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
END $$;
SELECT 'PASS: start/resume, completion, retry replay, stale requests, synchronized progress, ownership, schedule and RPC permissions' AS result;
ROLLBACK;
