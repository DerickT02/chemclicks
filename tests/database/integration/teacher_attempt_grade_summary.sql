-- SCRUM-94: the new per-student fields on teacher_activity_attempt_summary
-- (overallStatus, explorationDurationSeconds, the passing quiz attempt, and
-- failedQuizAttemptCount). Ownership/authorization and the base roster
-- shape are already covered by tests/database/integration/
-- teacher_activity_attempt_summary.sql; this fixture only exercises the new
-- fields and the states/edge cases that did not exist before this ticket.
--
-- Transactional fixtures: no retained test data.
BEGIN;
DO $$
DECLARE
  teacher uuid; c uuid;
  covalent_activity uuid; covalent_assignment uuid;
  not_started_student uuid; exploring_student uuid; completed_exploration_student uuid;
  taking_quiz_student uuid; needs_retry_student uuid;
  pass_after_retry_student uuid; retry_after_pass_student uuid;
  progress uuid; result jsonb; row_data jsonb;
BEGIN
  SELECT t.id INTO teacher FROM public.teachers t JOIN auth.users u ON u.id=t.id
    WHERE u.email_confirmed_at IS NOT NULL AND NOT COALESCE(u.is_anonymous,false) LIMIT 1;
  SELECT id INTO covalent_activity FROM public.activities WHERE type='lewis_structures_covalent' LIMIT 1;
  IF teacher IS NULL OR covalent_activity IS NULL THEN
    RAISE EXCEPTION 'Verified teacher and lewis_structures_covalent activity required';
  END IF;

  INSERT INTO public.classes(teacher_id,name,section,class_code) VALUES
    (teacher,'Attempt grade summary test','Test',upper(substr(md5(random()::text),1,6))) RETURNING id INTO c;
  INSERT INTO public.class_activities(class_id,activity_id) VALUES(c,covalent_activity) RETURNING id INTO covalent_assignment;

  INSERT INTO public.students(class_id,first_name,last_name,student_id)
    VALUES(c,'NotStarted','Test',gen_random_uuid()::text) RETURNING id INTO not_started_student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id)
    VALUES(c,'Exploring','Test',gen_random_uuid()::text) RETURNING id INTO exploring_student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id)
    VALUES(c,'CompletedExploration','Test',gen_random_uuid()::text) RETURNING id INTO completed_exploration_student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id)
    VALUES(c,'TakingQuiz','Test',gen_random_uuid()::text) RETURNING id INTO taking_quiz_student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id)
    VALUES(c,'NeedsRetry','Test',gen_random_uuid()::text) RETURNING id INTO needs_retry_student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id)
    VALUES(c,'PassAfterRetry','Test',gen_random_uuid()::text) RETURNING id INTO pass_after_retry_student;
  INSERT INTO public.students(class_id,first_name,last_name,student_id)
    VALUES(c,'RetryAfterPass','Test',gen_random_uuid()::text) RETURNING id INTO retry_after_pass_student;

  -- NotStarted: no student_progress row at all.

  -- Exploring: exploration started, never finished, no quiz touched.
  INSERT INTO public.student_progress(student_id,class_activity_id,status,started_at)
    VALUES(exploring_student,covalent_assignment,'in_progress','2026-01-01T10:00:00Z');

  -- CompletedExploration: finished exploration, still no quiz attempt, so the
  -- dual-requirement policy keeps this at 'exploring' overall, but
  -- explorationStatus/explorationDurationSeconds should read as completed.
  INSERT INTO public.student_progress(student_id,class_activity_id,status,started_at,completed_at)
    VALUES(completed_exploration_student,covalent_assignment,'completed','2026-01-01T10:00:00Z','2026-01-01T10:12:30Z');

  -- TakingQuiz: an open (in_progress) quiz attempt, explorer untouched.
  -- overallStatus must read 'taking_quiz' even though exploration never started.
  INSERT INTO public.student_progress(student_id,class_activity_id) VALUES(taking_quiz_student,covalent_assignment) RETURNING id INTO progress;
  INSERT INTO public.student_attempts(progress_id,attempt_number,quiz_key,status,started_at)
    VALUES(progress,1,'lewis_covalent','in_progress','2026-01-01T10:00:00Z');

  -- NeedsRetry: one completed, failed quiz attempt and no open attempt.
  INSERT INTO public.student_progress(student_id,class_activity_id) VALUES(needs_retry_student,covalent_assignment) RETURNING id INTO progress;
  INSERT INTO public.student_attempts(progress_id,attempt_number,quiz_key,question_total,score,percentage,passed,status,started_at,completed_at)
    VALUES(progress,1,'lewis_covalent',12,5,41.67,false,'completed','2026-01-01T10:00:00Z','2026-01-01T10:05:00Z');

  -- PassAfterRetry: explorer completed, quiz failed once then passed on the
  -- second attempt. Must report attempt 2 as the passing attempt and count
  -- exactly 1 failed attempt (the one before the pass).
  INSERT INTO public.student_progress(student_id,class_activity_id,status) VALUES(pass_after_retry_student,covalent_assignment,'completed') RETURNING id INTO progress;
  INSERT INTO public.student_attempts(progress_id,attempt_number,quiz_key,question_total,score,percentage,passed,status,started_at,completed_at)
    VALUES(progress,1,'lewis_covalent',12,5,41.67,false,'completed','2026-01-01T10:00:00Z','2026-01-01T10:05:00Z');
  INSERT INTO public.student_attempts(progress_id,attempt_number,quiz_key,question_total,score,percentage,passed,status,started_at,completed_at)
    VALUES(progress,2,'lewis_covalent',12,10,83.33,true,'completed','2026-01-01T11:00:00Z','2026-01-01T11:05:00Z');

  -- RetryAfterPass: explorer completed, quiz passed on attempt 1, then
  -- retried and failed on attempt 2. The post-completion failure must not
  -- count toward failedQuizAttemptCount or displace the passing attempt.
  INSERT INTO public.student_progress(student_id,class_activity_id,status) VALUES(retry_after_pass_student,covalent_assignment,'completed') RETURNING id INTO progress;
  INSERT INTO public.student_attempts(progress_id,attempt_number,quiz_key,question_total,score,percentage,passed,status,started_at,completed_at)
    VALUES(progress,1,'lewis_covalent',12,10,83.33,true,'completed','2026-01-01T10:00:00Z','2026-01-01T10:05:00Z');
  INSERT INTO public.student_attempts(progress_id,attempt_number,quiz_key,question_total,score,percentage,passed,status,started_at,completed_at)
    VALUES(progress,2,'lewis_covalent',12,3,25.00,false,'completed','2026-01-01T11:00:00Z','2026-01-01T11:05:00Z');

  SET LOCAL ROLE service_role;
  result := public.teacher_activity_attempt_summary(teacher,c,covalent_assignment);
  RESET ROLE;

  IF jsonb_array_length(result->'students')<>7 THEN RAISE EXCEPTION 'Roster not scoped correctly (got %)', jsonb_array_length(result->'students'); END IF;

  FOR row_data IN SELECT value FROM jsonb_array_elements(result->'students') LOOP
    IF row_data->>'studentId'=not_started_student::text THEN
      IF row_data->>'overallStatus'<>'not_started' THEN RAISE EXCEPTION 'Untouched student should be not_started, got %', row_data->>'overallStatus'; END IF;
      IF row_data->>'explorationStatus'<>'not_started' THEN RAISE EXCEPTION 'Untouched exploration should be not_started'; END IF;
      IF row_data->'explorationDurationSeconds'<>'null'::jsonb THEN RAISE EXCEPTION 'Untouched exploration must not report a duration'; END IF;
      IF row_data->'passingQuizAttemptNumber'<>'null'::jsonb THEN RAISE EXCEPTION 'Untouched student must not report a passing attempt'; END IF;
      IF (row_data->>'failedQuizAttemptCount')::int<>0 THEN RAISE EXCEPTION 'Untouched student must report zero failed attempts'; END IF;

    ELSIF row_data->>'studentId'=exploring_student::text THEN
      IF row_data->>'overallStatus'<>'exploring' THEN RAISE EXCEPTION 'In-progress exploration should read exploring, got %', row_data->>'overallStatus'; END IF;
      IF row_data->>'explorationStatus'<>'in_progress' THEN RAISE EXCEPTION 'Exploration status should be in_progress'; END IF;
      IF row_data->'explorationDurationSeconds'<>'null'::jsonb THEN RAISE EXCEPTION 'An in-progress exploration must not report a fabricated duration'; END IF;

    ELSIF row_data->>'studentId'=completed_exploration_student::text THEN
      IF row_data->>'explorationStatus'<>'completed' THEN RAISE EXCEPTION 'Finished exploration should read completed'; END IF;
      IF (row_data->>'explorationDurationSeconds')::int<>750 THEN RAISE EXCEPTION 'Exploration duration should be 750 seconds, got %', row_data->>'explorationDurationSeconds'; END IF;
      IF row_data->>'overallStatus'<>'exploring' THEN RAISE EXCEPTION 'A covalent lesson needs the quiz too, so it should still read exploring overall, got %', row_data->>'overallStatus'; END IF;

    ELSIF row_data->>'studentId'=taking_quiz_student::text THEN
      IF row_data->>'overallStatus'<>'taking_quiz' THEN RAISE EXCEPTION 'An open quiz attempt should read taking_quiz even with no exploration, got %', row_data->>'overallStatus'; END IF;

    ELSIF row_data->>'studentId'=needs_retry_student::text THEN
      IF row_data->>'overallStatus'<>'needs_retry' THEN RAISE EXCEPTION 'A failed, closed quiz attempt should read needs_retry, got %', row_data->>'overallStatus'; END IF;
      IF (row_data->>'failedQuizAttemptCount')::int<>1 THEN RAISE EXCEPTION 'Should report exactly 1 failed attempt, got %', row_data->>'failedQuizAttemptCount'; END IF;
      IF row_data->'passingQuizAttemptNumber'<>'null'::jsonb THEN RAISE EXCEPTION 'A never-passed student must not report a passing attempt'; END IF;

    ELSIF row_data->>'studentId'=pass_after_retry_student::text THEN
      IF row_data->>'overallStatus'<>'completed' THEN RAISE EXCEPTION 'Explorer done and quiz eventually passed should read completed, got %', row_data->>'overallStatus'; END IF;
      IF (row_data->>'passingQuizAttemptNumber')::int<>2 THEN RAISE EXCEPTION 'Should report attempt 2 as the passing attempt, got %', row_data->>'passingQuizAttemptNumber'; END IF;
      IF (row_data->>'failedQuizAttemptCount')::int<>1 THEN RAISE EXCEPTION 'Should count exactly the 1 failed attempt before the pass, got %', row_data->>'failedQuizAttemptCount'; END IF;
      IF (row_data->>'passingQuizScore')::int<>10 THEN RAISE EXCEPTION 'Should report the passing attempt score, got %', row_data->>'passingQuizScore'; END IF;

    ELSIF row_data->>'studentId'=retry_after_pass_student::text THEN
      IF row_data->>'overallStatus'<>'completed' THEN RAISE EXCEPTION 'A later failed retry must not undo a completed lab, got %', row_data->>'overallStatus'; END IF;
      IF (row_data->>'passingQuizAttemptNumber')::int<>1 THEN RAISE EXCEPTION 'Should still report attempt 1 as the passing attempt, got %', row_data->>'passingQuizAttemptNumber'; END IF;
      IF (row_data->>'failedQuizAttemptCount')::int<>0 THEN RAISE EXCEPTION 'A retry taken after completion must not count as a failed attempt, got %', row_data->>'failedQuizAttemptCount'; END IF;

    ELSE RAISE EXCEPTION 'Foreign or unexpected student included: %', row_data->>'studentId';
    END IF;
  END LOOP;
END $$;
SELECT 'PASS: unified status, exploration duration, and passing-attempt isolation for the teacher attempt grade summary' AS result;
ROLLBACK;
