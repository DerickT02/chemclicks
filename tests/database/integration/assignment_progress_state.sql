-- Transactional fixtures: no retained test data.
-- Walks one student through every assignment stage, then checks retries,
-- concurrent assignments, that quizzed work needs exploration and a passing
-- quiz to complete, ownership, and mixed legacy/split Bohr histories after
-- 20261104000300_fix_bohr_quiz_access_and_progress_history.sql.
-- Run only on a disposable test database; these fixtures write and roll back.
-- At every step the class progress view and the detailed results must agree.
BEGIN;

CREATE FUNCTION pg_temp.lesson(p_teacher uuid, p_class uuid, p_student uuid, p_assignment uuid)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT l FROM jsonb_array_elements(public.teacher_class_lesson_progress(p_teacher, p_class)->'students') s,
    jsonb_array_elements(s->'lessons') l
  WHERE s->>'studentId' = p_student::text AND l->>'assignmentId' = p_assignment::text
$$;

CREATE FUNCTION pg_temp.report_row(p_teacher uuid, p_class uuid, p_student uuid, p_assignment uuid)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT r FROM jsonb_array_elements(
    public.teacher_activity_attempt_summary(p_teacher, p_class, p_assignment)->'students') r
  WHERE r->>'studentId' = p_student::text
$$;

CREATE FUNCTION pg_temp.expect_stage(
  p_teacher uuid, p_class uuid, p_student uuid, p_assignment uuid, p_expected text, p_step text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE l jsonb; r jsonb;
BEGIN
  l := pg_temp.lesson(p_teacher, p_class, p_student, p_assignment);
  r := pg_temp.report_row(p_teacher, p_class, p_student, p_assignment);
  IF l->>'stage' IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION '%: class view stage %, expected %', p_step, l->>'stage', p_expected;
  END IF;
  IF r->>'progressStage' IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION '%: detailed results stage %, expected %', p_step, r->>'progressStage', p_expected;
  END IF;
  IF (l->>'status' = 'completed') <> (r->>'overallStatus' = 'completed')
     OR (l->>'status' = 'completed') <> (p_expected = 'completed') THEN
    RAISE EXCEPTION '%: views disagree on completion (status %, overallStatus %)',
      p_step, l->>'status', r->>'overallStatus';
  END IF;
  IF (l->'timeToFirstQuizSeconds') IS DISTINCT FROM (r->'explorationDurationSeconds')
     OR (r->'explorationDurationSeconds') IS DISTINCT FROM (r->'timeToFirstQuizSeconds') THEN
    RAISE EXCEPTION '%: contradictory exploration durations', p_step;
  END IF;
END;
$$;

DO $$
DECLARE
  teacher uuid; c uuid;
  covalent_activity uuid; diagram_activity uuid; bohr_intro_activity uuid; bohr_stability_activity uuid;
  ruler_tenths_activity uuid; ruler_hundredths_activity uuid;
  covalent uuid; diagram uuid; bohr_intro uuid; bohr_stability uuid; ruler_tenths uuid; ruler_hundredths uuid;
  walker uuid; diagram_student uuid; concurrent uuid; quiz_first uuid;
  progress uuid; batch_state record;
  exploration_time timestamptz := now() - interval '50 minutes';
  pass_time timestamptz := now() - interval '10 minutes';
  legacy_pass_time timestamptz := now() - interval '45 minutes';
  l jsonb; r jsonb;
BEGIN
  SELECT t.id INTO teacher FROM public.teachers t JOIN auth.users u ON u.id = t.id
    WHERE u.email_confirmed_at IS NOT NULL AND NOT COALESCE(u.is_anonymous, false) LIMIT 1;
  SELECT id INTO covalent_activity FROM public.activities WHERE type = 'lewis_structures_covalent' LIMIT 1;
  SELECT id INTO diagram_activity FROM public.activities WHERE type = 'lewis_diagram' LIMIT 1;
  SELECT id INTO bohr_intro_activity FROM public.activities WHERE type = 'bohr_model_intro' LIMIT 1;
  SELECT id INTO bohr_stability_activity FROM public.activities WHERE type = 'bohr_model_stability' LIMIT 1;
  SELECT id INTO ruler_tenths_activity FROM public.activities WHERE type = 'measurement_ruler_tenths' LIMIT 1;
  SELECT id INTO ruler_hundredths_activity FROM public.activities WHERE type = 'measurement_ruler_hundredths' LIMIT 1;
  IF teacher IS NULL OR covalent_activity IS NULL OR diagram_activity IS NULL OR bohr_intro_activity IS NULL OR bohr_stability_activity IS NULL
     OR ruler_tenths_activity IS NULL OR ruler_hundredths_activity IS NULL THEN
    RAISE EXCEPTION 'Verified teacher and covalent/Bohr intro/Bohr stability/ruler tenths/ruler hundredths activities required';
  END IF;

  INSERT INTO public.classes(teacher_id, name, section, class_code) VALUES
    (teacher, 'Stage test', 'Test', upper(substr(md5(random()::text), 1, 6))) RETURNING id INTO c;
  INSERT INTO public.class_activities(class_id, activity_id) VALUES (c, covalent_activity) RETURNING id INTO covalent;
  INSERT INTO public.class_activities(class_id, activity_id) VALUES (c, diagram_activity) RETURNING id INTO diagram;
  INSERT INTO public.class_activities(class_id, activity_id) VALUES (c, bohr_intro_activity) RETURNING id INTO bohr_intro;
  INSERT INTO public.class_activities(class_id, activity_id) VALUES (c, bohr_stability_activity) RETURNING id INTO bohr_stability;
  INSERT INTO public.class_activities(class_id, activity_id) VALUES (c, ruler_tenths_activity) RETURNING id INTO ruler_tenths;
  INSERT INTO public.class_activities(class_id, activity_id) VALUES (c, ruler_hundredths_activity) RETURNING id INTO ruler_hundredths;

  INSERT INTO public.students(class_id, first_name, last_name, student_id, verified)
    VALUES (c, 'Walker', 'Test', gen_random_uuid()::text, true) RETURNING id INTO walker;
  INSERT INTO public.students(class_id, first_name, last_name, student_id, verified)
    VALUES (c, 'Diagram', 'Test', gen_random_uuid()::text, true) RETURNING id INTO diagram_student;
  INSERT INTO public.students(class_id, first_name, last_name, student_id, verified)
    VALUES (c, 'Concurrent', 'Test', gen_random_uuid()::text, true) RETURNING id INTO concurrent;
  INSERT INTO public.students(class_id, first_name, last_name, student_id, verified)
    VALUES (c, 'QuizFirst', 'Test', gen_random_uuid()::text, true) RETURNING id INTO quiz_first;

  -- Full stage sequence on a Lewis covalent assignment, with two failed
  -- attempts before the pass.
  PERFORM pg_temp.expect_stage(teacher, c, walker, covalent, 'not_started', 'untouched');

  INSERT INTO public.student_progress(student_id, class_activity_id, status, started_at, exploration_started_at)
    VALUES (walker, covalent, 'in_progress', now() - interval '1 hour', now() - interval '1 hour')
    RETURNING id INTO progress;
  PERFORM pg_temp.expect_stage(teacher, c, walker, covalent, 'exploring', 'exploration started');

  UPDATE public.student_progress
    SET status = 'completed', completed_at = exploration_time,
        exploration_completed = true, exploration_completed_at = exploration_time
    WHERE id = progress;
  PERFORM pg_temp.expect_stage(teacher, c, walker, covalent, 'explored', 'exploration finished');

  UPDATE public.student_progress
    SET quiz_started_at = now() - interval '40 minutes', first_quiz_started_at = now() - interval '40 minutes',
        exploration_duration_seconds = 1200
    WHERE id = progress;
  PERFORM pg_temp.expect_stage(teacher, c, walker, covalent, 'quiz_in_progress', 'quiz started, nothing submitted');
  l := pg_temp.lesson(teacher, c, walker, covalent);
  IF (l->>'timeToFirstQuizSeconds')::bigint <> 1200 THEN RAISE EXCEPTION 'Saved exploration interval not reported'; END IF;
  IF l->'passingQuizScore' <> 'null'::jsonb THEN RAISE EXCEPTION 'Unsubmitted quiz reported a score'; END IF;

  INSERT INTO public.student_attempts(progress_id, attempt_number, quiz_key, question_total, score, percentage, passed, status, started_at, completed_at)
    VALUES (progress, 1, 'lewis_covalent', 12, 6, 50.00, false, 'completed', now() - interval '40 minutes', now() - interval '35 minutes');
  PERFORM pg_temp.expect_stage(teacher, c, walker, covalent, 'needs_retry', 'first attempt failed');

  UPDATE public.student_progress SET quiz_started_at = now() - interval '30 minutes' WHERE id = progress;
  PERFORM pg_temp.expect_stage(teacher, c, walker, covalent, 'quiz_in_progress', 'retry started');

  INSERT INTO public.student_attempts(progress_id, attempt_number, quiz_key, question_total, score, percentage, passed, status, started_at, completed_at)
    VALUES (progress, 2, 'lewis_covalent', 12, 7, 58.33, false, 'completed', now() - interval '30 minutes', now() - interval '25 minutes');
  PERFORM pg_temp.expect_stage(teacher, c, walker, covalent, 'needs_retry', 'second attempt failed');
  l := pg_temp.lesson(teacher, c, walker, covalent);
  IF (l->>'failedQuizAttemptCount')::int <> 2 THEN RAISE EXCEPTION 'Expected 2 failed attempts, got %', l->>'failedQuizAttemptCount'; END IF;

  UPDATE public.student_progress SET quiz_started_at = now() - interval '20 minutes' WHERE id = progress;
  INSERT INTO public.student_attempts(progress_id, attempt_number, quiz_key, question_total, score, percentage, passed, status, started_at, completed_at)
    VALUES (progress, 3, 'lewis_covalent', 12, 11, 91.67, true, 'completed', now() - interval '20 minutes', pass_time);
  PERFORM pg_temp.expect_stage(teacher, c, walker, covalent, 'completed', 'third attempt passed');
  l := pg_temp.lesson(teacher, c, walker, covalent);
  r := pg_temp.report_row(teacher, c, walker, covalent);
  IF (l->>'passingQuizAttemptNumber')::int <> 3 OR (l->>'passingQuizScore')::int <> 11
     OR (l->>'passingQuizTotal')::int <> 12 OR (l->>'passingQuizPercentage')::numeric <> 91.67 THEN
    RAISE EXCEPTION 'Passing attempt not reported: %', l;
  END IF;
  IF (l->>'failedQuizAttemptCount')::int <> 2 OR (r->>'failedQuizAttemptCount')::int <> 2 THEN
    RAISE EXCEPTION 'Failed attempts before the pass miscounted';
  END IF;
  IF r->>'explorationStatus' <> 'completed' THEN
    RAISE EXCEPTION 'Completed exploration marker missing from teacher report: %', r;
  END IF;
  IF (l->>'completedAt')::timestamptz <> pass_time OR (r->>'completedAt')::timestamptz <> pass_time THEN
    RAISE EXCEPTION 'Lewis completion time should be the later half (the pass), got % / %', l->>'completedAt', r->>'completedAt';
  END IF;
  IF (l->>'timeToFirstQuizSeconds')::bigint <> 1200 THEN RAISE EXCEPTION 'Retries rewrote the exploration interval'; END IF;

  -- Later retries and practice attempts cannot erase the first completion pass.
  INSERT INTO public.student_attempts(progress_id, attempt_number, quiz_key, question_total, score, percentage, passed, status, started_at, completed_at)
    VALUES (progress, 4, 'lewis_covalent', 12, 3, 25.00, false, 'completed', now() - interval '2 minutes', now() - interval '1 minute');
  PERFORM pg_temp.expect_stage(teacher, c, walker, covalent, 'completed', 'failed retry after pass');
  l := pg_temp.lesson(teacher, c, walker, covalent);
  IF (l->>'passingQuizAttemptNumber')::int <> 3
     OR (l->>'passingQuizScore')::int <> 11
     OR (l->>'failedQuizAttemptCount')::int <> 2
     OR (l->>'completedAt')::timestamptz <> pass_time THEN
    RAISE EXCEPTION 'Later retry changed the first passing completion evidence: %', l;
  END IF;

  -- A no-quiz Lewis diagram completes on the durable exploration marker alone.
  INSERT INTO public.student_progress(
    student_id, class_activity_id, status, completed_at,
    exploration_completed, exploration_completed_at
  ) VALUES (diagram_student, diagram, 'completed', exploration_time, true, exploration_time);
  PERFORM pg_temp.expect_stage(teacher, c, diagram_student, diagram, 'completed', 'Lewis diagram exploration completed');
  l := pg_temp.lesson(teacher, c, diagram_student, diagram);
  IF (l->>'completedAt')::timestamptz <> exploration_time THEN
    RAISE EXCEPTION 'No-quiz completion timestamp should come from exploration: %', l;
  END IF;

  -- Two concurrent Bohr assignments and two ruler precisions stay independent.
  INSERT INTO public.student_progress(student_id, class_activity_id, status, started_at, completed_at, quiz_started_at)
    VALUES (concurrent, bohr_intro, 'completed', now() - interval '5 minutes', now() - interval '2 minutes', now() - interval '1 minute')
    RETURNING id INTO progress;
  PERFORM pg_temp.expect_stage(teacher, c, concurrent, bohr_intro, 'quiz_in_progress', 'Bohr intro quiz started');
  PERFORM pg_temp.expect_stage(teacher, c, concurrent, bohr_stability, 'not_started', 'Bohr stability untouched');
  INSERT INTO public.student_attempts(progress_id, attempt_number, quiz_key, question_total, score, percentage, passed, status, started_at, completed_at)
    VALUES (progress, 1, 'bohr_models', 12, 11, 91.67, true, 'completed', now() - interval '1 minute', now());
  PERFORM pg_temp.expect_stage(teacher, c, concurrent, bohr_intro, 'exploring', 'Bohr quiz passed before exploration');
  PERFORM pg_temp.expect_stage(teacher, c, concurrent, bohr_stability, 'not_started', 'Bohr intro pass must not complete stability');
  r := pg_temp.report_row(teacher, c, concurrent, bohr_intro);
  IF r->>'explorationStatus' <> 'not_started' THEN
    RAISE EXCEPTION 'A quiz-only Bohr pass was reported as exploration completion';
  END IF;

  INSERT INTO public.student_progress(
    student_id, class_activity_id, status, started_at,
    exploration_completed, exploration_completed_at
  ) VALUES (
    concurrent, ruler_tenths, 'in_progress', now() - interval '5 minutes', true, exploration_time
  ) RETURNING id INTO progress;
  INSERT INTO public.measurement_quiz_sessions(progress_id, mode, attempt_number) VALUES (progress, 'ruler_tenths', 1);
  INSERT INTO public.student_progress(
    student_id, class_activity_id, status, started_at, completed_at,
    exploration_completed, exploration_completed_at
  ) VALUES (
    concurrent, ruler_hundredths, 'completed', now() - interval '5 minutes', exploration_time,
    true, exploration_time
  )
    RETURNING id INTO progress;
  PERFORM pg_temp.expect_stage(teacher, c, concurrent, ruler_tenths, 'quiz_in_progress', 'open ruler tenths session');
  -- A finished exploration alone is not completion: the quiz still has to pass.
  PERFORM pg_temp.expect_stage(teacher, c, concurrent, ruler_hundredths, 'explored', 'ruler hundredths explored, quiz not taken');
  INSERT INTO public.student_attempts(progress_id, attempt_number, quiz_key, question_total, score, percentage, passed, status, started_at, completed_at, instrument, precision_mode)
    VALUES (progress, 1, 'measurement_ruler_hundredths', 5, 5, 100.00, true, 'completed', now() - interval '3 minutes', now(), 'ruler', 'hundredths');
  PERFORM pg_temp.expect_stage(teacher, c, concurrent, ruler_hundredths, 'completed', 'ruler hundredths quiz passed');
  PERFORM pg_temp.expect_stage(teacher, c, concurrent, ruler_tenths, 'quiz_in_progress', 'hundredths pass must not complete tenths');

  -- Passing the quiz alone keeps the assignment unfinished until exploration.
  INSERT INTO public.student_progress(student_id, class_activity_id, status, started_at)
    VALUES (quiz_first, covalent, 'in_progress', now() - interval '5 minutes') RETURNING id INTO progress;
  INSERT INTO public.student_attempts(progress_id, attempt_number, quiz_key, question_total, score, percentage, passed, status, started_at, completed_at)
    VALUES (progress, 1, 'lewis_covalent', 12, 12, 100.00, true, 'completed', now() - interval '2 minutes', now());
  PERFORM pg_temp.expect_stage(teacher, c, quiz_first, covalent, 'exploring', 'Lewis quiz passed, exploration unfinished');
  r := pg_temp.report_row(teacher, c, quiz_first, covalent);
  IF r->>'explorationStatus' <> 'not_started' OR (r->>'completedAt') IS NOT NULL THEN
    RAISE EXCEPTION 'Quiz-only Lewis pass reported completion: %', r;
  END IF;

  UPDATE public.student_progress
  SET status = 'completed', completed_at = now() - interval '1 hour',
      exploration_completed = true, exploration_completed_at = now() - interval '1 hour'
  WHERE id = progress;
  PERFORM pg_temp.expect_stage(teacher, c, quiz_first, covalent, 'completed', 'exploration finished after the quiz pass');
  r := pg_temp.report_row(teacher, c, quiz_first, covalent);
  IF (r->>'completedAt')::timestamptz <> (r->>'passingQuizCompletedAt')::timestamptz THEN
    RAISE EXCEPTION 'Completion timestamp should be the later of exploration and pass: %', r;
  END IF;

  -- Bohr numbering restarts under the split key. A legacy attempt numbered 8
  -- must not outrank a newer split attempt numbered 1 when finding the latest
  -- result, and failures numbered 7/8 still precede a split pass numbered 2.
  INSERT INTO public.student_progress(student_id, class_activity_id, status, started_at, quiz_started_at)
    VALUES (quiz_first, bohr_intro, 'in_progress', now() - interval '90 minutes', now() - interval '35 minutes')
    RETURNING id INTO progress;
  INSERT INTO public.student_attempts(progress_id, attempt_number, quiz_key, question_total, score, percentage, passed, status, started_at, completed_at)
    VALUES
      (progress, 7, 'bohr_models', 12, 6, 50.00, false, 'completed', now() - interval '80 minutes', now() - interval '70 minutes'),
      (progress, 8, 'bohr_models', 12, 6, 50.00, false, 'completed', now() - interval '65 minutes', now() - interval '60 minutes'),
      (progress, 1, 'bohr_model_intro', 12, 6, 50.00, false, 'completed', now() - interval '35 minutes', now() - interval '30 minutes');
  PERFORM pg_temp.expect_stage(teacher, c, quiz_first, bohr_intro, 'needs_retry', 'new split failure after higher-numbered legacy failures');
  l := pg_temp.lesson(teacher, c, quiz_first, bohr_intro);
  r := pg_temp.report_row(teacher, c, quiz_first, bohr_intro);
  IF (l->>'failedQuizAttemptCount')::int IS DISTINCT FROM 3
     OR (r->>'failedQuizAttemptCount')::int IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'All mixed-key failures must count before a pass';
  END IF;
  IF r->'attempts'->0->>'quizKey' IS DISTINCT FROM 'bohr_model_intro'
     OR (r->'attempts'->0->>'attemptNumber')::int IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'History must be newest first across per-key number sequences';
  END IF;

  UPDATE public.student_progress SET quiz_started_at = now() - interval '25 minutes' WHERE id = progress;
  PERFORM pg_temp.expect_stage(teacher, c, quiz_first, bohr_intro, 'quiz_in_progress', 'mixed-key retry actually open');
  pass_time := now() - interval '15 minutes';
  INSERT INTO public.student_attempts(progress_id, attempt_number, quiz_key, question_total, score, percentage, passed, status, started_at, completed_at)
    VALUES (progress, 2, 'bohr_model_intro', 12, 11, 91.67, true, 'completed', now() - interval '25 minutes', pass_time);
  PERFORM pg_temp.expect_stage(teacher, c, quiz_first, bohr_intro, 'completed', 'mixed-key retry passed');
  l := pg_temp.lesson(teacher, c, quiz_first, bohr_intro);
  r := pg_temp.report_row(teacher, c, quiz_first, bohr_intro);
  IF (l->>'failedQuizAttemptCount')::int IS DISTINCT FROM 3
     OR (r->>'failedQuizAttemptCount')::int IS DISTINCT FROM 3
     OR (l->>'passingQuizAttemptNumber')::int IS DISTINCT FROM 2
     OR (l->>'completedAt')::timestamptz IS DISTINCT FROM pass_time THEN
    RAISE EXCEPTION 'Legacy failures must precede split pass 2 regardless of their larger attempt numbers';
  END IF;

  -- Later failures/passes must not replace the first pass or inflate its
  -- failed-attempt count. A backfilled, earlier legacy pass takes precedence
  -- by its actual completion time, not its larger per-key attempt number.
  INSERT INTO public.student_attempts(progress_id, attempt_number, quiz_key, question_total, score, percentage, passed, status, started_at, completed_at)
    VALUES
      (progress, 3, 'bohr_model_intro', 12, 6, 50.00, false, 'completed', now() - interval '12 minutes', now() - interval '10 minutes'),
      (progress, 4, 'bohr_model_intro', 12, 12, 100.00, true, 'completed', now() - interval '8 minutes', now() - interval '5 minutes');
  l := pg_temp.lesson(teacher, c, quiz_first, bohr_intro);
  IF (l->>'passingQuizAttemptNumber')::int IS DISTINCT FROM 2
     OR (l->>'failedQuizAttemptCount')::int IS DISTINCT FROM 3
     OR (l->>'completedAt')::timestamptz IS DISTINCT FROM pass_time THEN
    RAISE EXCEPTION 'Attempts after the first pass changed the passing summary';
  END IF;

  INSERT INTO public.student_attempts(progress_id, attempt_number, quiz_key, question_total, score, percentage, passed, status, started_at, completed_at)
    VALUES (progress, 9, 'bohr_models', 12, 10, 83.33, true, 'completed', now() - interval '50 minutes', legacy_pass_time);
  PERFORM pg_temp.expect_stage(teacher, c, quiz_first, bohr_intro, 'completed', 'earlier legacy pass discovered');
  l := pg_temp.lesson(teacher, c, quiz_first, bohr_intro);
  r := pg_temp.report_row(teacher, c, quiz_first, bohr_intro);
  IF (l->>'passingQuizAttemptNumber')::int IS DISTINCT FROM 9
     OR (r->>'passingQuizAttemptNumber')::int IS DISTINCT FROM 9
     OR (l->>'passingQuizScore')::int IS DISTINCT FROM 10
     OR (l->>'failedQuizAttemptCount')::int IS DISTINCT FROM 2
     OR (r->>'failedQuizAttemptCount')::int IS DISTINCT FROM 2
     OR (l->>'completedAt')::timestamptz IS DISTINCT FROM legacy_pass_time
     OR (r->>'completedAt')::timestamptz IS DISTINCT FROM legacy_pass_time THEN
    RAISE EXCEPTION 'The earliest chronological pass and failures before it must agree in both views';
  END IF;
  PERFORM pg_temp.expect_stage(teacher, c, quiz_first, bohr_stability, 'not_started', 'mixed intro history must not complete stability');
  PERFORM pg_temp.expect_stage(teacher, c, walker, bohr_intro, 'not_started', 'mixed history must not complete another student');

  -- Another teacher is refused both views.
  BEGIN PERFORM public.teacher_class_lesson_progress(gen_random_uuid(), c); RAISE EXCEPTION 'Foreign teacher read class progress'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.teacher_activity_attempt_summary(gen_random_uuid(), c, covalent); RAISE EXCEPTION 'Foreign teacher read detailed results'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  SET LOCAL ROLE service_role;
  PERFORM public.assignment_progress_state(NULL, 'bohr_model_intro');
  SELECT * INTO batch_state
  FROM public.student_assignment_progress_states(quiz_first, c, ARRAY[covalent]::uuid[]);
  IF batch_state.status <> 'completed' OR NOT batch_state.exploration_completed
     OR batch_state.passing_attempt_number <> 1 THEN
    RAISE EXCEPTION 'Batch student state did not return the completed conjunction: %', batch_state;
  END IF;
  BEGIN
    PERFORM public.student_assignment_progress_states(quiz_first, c, ARRAY[gen_random_uuid()]::uuid[]);
    RAISE EXCEPTION 'Batch student state accepted an unassigned ID';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;

  SET LOCAL ROLE anon;
  BEGIN PERFORM public.assignment_progress_state(NULL, 'bohr_model_intro'); RAISE EXCEPTION 'Anonymous helper call allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;

  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.assignment_progress_state(NULL, 'bohr_model_intro'); RAISE EXCEPTION 'Browser helper call allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.student_assignment_progress_states(quiz_first, c, ARRAY[covalent]::uuid[]);
    RAISE EXCEPTION 'Browser batch state call allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
END $$;
SELECT 'PASS: stages, mixed legacy/split history, chronological passing results, assignment isolation, view agreement, ownership and grants' AS result;
ROLLBACK;
