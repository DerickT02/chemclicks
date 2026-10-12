-- Bohr exploration attempt assertions. All fixtures roll back.
-- Requires 20261010190000_bohr_exploration_attempts.sql and the seeded Bohr activities.
BEGIN;
DO $$
DECLARE
  teacher uuid; intro uuid; stability uuid;
  c uuid; other_c uuid; assignment uuid; stability_assignment uuid;
  student uuid; classmate uuid; outsider uuid; progress uuid;
  first_attempt public.student_attempts%ROWTYPE; finished public.student_attempts%ROWTYPE;
  second_attempt public.student_attempts%ROWTYPE; result public.student_attempts%ROWTYPE;
  quiz_attempt public.student_attempts%ROWTYPE; quiz_after public.student_attempts%ROWTYPE;
  n integer;
BEGIN
  SELECT id INTO teacher FROM public.teachers LIMIT 1;
  SELECT id INTO intro FROM public.activities WHERE type::text='bohr_model_intro' LIMIT 1;
  SELECT id INTO stability FROM public.activities WHERE type::text='bohr_model_stability' LIMIT 1;
  IF teacher IS NULL OR intro IS NULL OR stability IS NULL THEN RAISE EXCEPTION 'Teacher and Bohr activity anchors required'; END IF;
  INSERT INTO public.classes(teacher_id,name,section,class_code)
    VALUES(teacher,'Bohr attempt test','Test',upper(substr(md5(random()::text),1,6))) RETURNING id INTO c;
  INSERT INTO public.classes(teacher_id,name,section,class_code)
    VALUES(teacher,'Bohr attempt other','Test',upper(substr(md5(random()::text),1,6))) RETURNING id INTO other_c;
  INSERT INTO public.class_activities(class_id,activity_id) VALUES(c,intro) RETURNING id INTO assignment;
  INSERT INTO public.class_activities(class_id,activity_id) VALUES(c,stability) RETURNING id INTO stability_assignment;
  INSERT INTO public.students(class_id,first_name,last_name,student_id,verified)
    VALUES(c,'Bohr','Test',gen_random_uuid()::text,true) RETURNING id INTO student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id,verified)
    VALUES(c,'Classmate','Test',gen_random_uuid()::text,true) RETURNING id INTO classmate;
  INSERT INTO public.students(class_id,first_name,last_name,student_id,verified)
    VALUES(other_c,'Outsider','Test',gen_random_uuid()::text,true) RETURNING id INTO outsider;

  SET LOCAL ROLE service_role;
  -- Both Bohr types are supported explorations.
  SELECT * INTO first_attempt FROM public.student_attempt_transition(student,c,assignment,'start',NULL);
  IF first_attempt.attempt_number<>1 OR first_attempt.status<>'in_progress' OR first_attempt.quiz_key IS NOT NULL THEN RAISE EXCEPTION 'Bohr intro start incorrect'; END IF;
  SELECT * INTO result FROM public.student_attempt_transition(student,c,stability_assignment,'start',NULL);
  IF result.attempt_number<>1 OR result.status<>'in_progress' OR result.quiz_key IS NOT NULL THEN RAISE EXCEPTION 'Bohr stability start incorrect'; END IF;
  progress := first_attempt.progress_id;

  -- Another class's student, a forged class and a classmate are all refused.
  BEGIN PERFORM public.student_attempt_transition(outsider,other_c,assignment,'start',NULL); RAISE EXCEPTION 'Other class start allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.student_attempt_transition(outsider,c,assignment,'start',NULL); RAISE EXCEPTION 'Forged class start allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.student_attempt_transition(student,other_c,assignment,'start',NULL); RAISE EXCEPTION 'Cross-class start allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.student_attempt_transition(classmate,c,assignment,'complete',first_attempt.id); RAISE EXCEPTION 'Classmate completion allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- Finishing the exploration records participation only: no score, no pass, no quiz row.
  SELECT * INTO finished FROM public.student_attempt_transition(student,c,assignment,'complete',first_attempt.id);
  IF finished.status<>'completed' OR finished.score IS NOT NULL OR finished.passed IS NOT NULL
     OR finished.percentage IS NOT NULL OR finished.quiz_key IS NOT NULL THEN RAISE EXCEPTION 'Exploration completion was graded'; END IF;
  SELECT count(*) INTO n FROM public.student_attempts WHERE progress_id=progress AND (quiz_key IS NOT NULL OR passed IS NOT NULL);
  IF n<>0 THEN RAISE EXCEPTION 'Exploration completion created a quiz result'; END IF;
  RESET ROLE;

  -- A quiz attempt sharing the progress row is invisible to the exploration lifecycle.
  INSERT INTO public.student_attempts(progress_id,attempt_number,quiz_key,question_total,score,percentage,passed,submission_key,status,started_at,completed_at)
    VALUES(progress,5,'bohr_models',12,6,50,false,gen_random_uuid()::text,'completed',clock_timestamp(),clock_timestamp())
    RETURNING * INTO quiz_attempt;
  SET LOCAL ROLE service_role;
  BEGIN PERFORM public.student_attempt_transition(student,c,assignment,'complete',quiz_attempt.id); RAISE EXCEPTION 'Quiz attempt completed as exploration'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.student_attempt_transition(student,c,assignment,'retry',quiz_attempt.id); RAISE EXCEPTION 'Quiz attempt retried as exploration'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  SELECT * INTO result FROM public.student_attempt_transition(student,c,assignment,'start',NULL);
  IF result.id<>finished.id THEN RAISE EXCEPTION 'Start resumed a quiz attempt'; END IF;
  SELECT * INTO second_attempt FROM public.student_attempt_transition(student,c,assignment,'retry',finished.id);
  IF second_attempt.attempt_number<>2 OR second_attempt.quiz_key IS NOT NULL OR second_attempt.status<>'in_progress' THEN RAISE EXCEPTION 'Exploration retry numbered from quiz attempts'; END IF;
  PERFORM public.student_attempt_transition(student,c,assignment,'complete',second_attempt.id);
  SELECT * INTO quiz_after FROM public.student_attempts WHERE id=quiz_attempt.id;
  IF quiz_after.passed IS DISTINCT FROM false OR quiz_after.score<>6 OR quiz_after.updated_at<>quiz_attempt.updated_at THEN RAISE EXCEPTION 'Exploration changed the quiz result'; END IF;
  SELECT count(*) INTO n FROM public.student_attempts WHERE progress_id=progress AND quiz_key='bohr_models' AND passed;
  IF n<>0 THEN RAISE EXCEPTION 'Exploration participation counted as a quiz pass'; END IF;
  RESET ROLE;

  -- Archived (unassigned), closed and not-yet-open Bohr assignments are refused.
  UPDATE public.class_activities SET archived_at=now() WHERE id=assignment;
  SET LOCAL ROLE service_role;
  BEGIN PERFORM public.student_attempt_transition(student,c,assignment,'retry',second_attempt.id); RAISE EXCEPTION 'Archived retry allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  UPDATE public.class_activities SET archived_at=NULL,closes_at=now()-interval '1 second' WHERE id=assignment;
  SET LOCAL ROLE service_role;
  BEGIN PERFORM public.student_attempt_transition(student,c,assignment,'retry',second_attempt.id); RAISE EXCEPTION 'Closed retry allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  UPDATE public.class_activities SET closes_at=NULL,opens_at=now()+interval '1 day' WHERE id=assignment;
  SET LOCAL ROLE service_role;
  BEGIN PERFORM public.student_attempt_transition(student,c,assignment,'start',NULL); RAISE EXCEPTION 'Future assignment allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  UPDATE public.class_activities SET opens_at=NULL WHERE id=assignment;

  -- Browser roles still cannot call the RPC.
  SET LOCAL ROLE anon;
  BEGIN PERFORM public.student_attempt_transition(student,c,assignment,'start',NULL); RAISE EXCEPTION 'Anonymous RPC allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.student_attempt_transition(student,c,assignment,'start',NULL); RAISE EXCEPTION 'Authenticated browser RPC allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
END $$;
SELECT 'PASS: Bohr intro/stability exploration, class ownership, quiz separation, archive/schedule refusal and RPC permissions' AS result;
ROLLBACK;
