-- Quiz attempt replay/retry assertions. All fixtures roll back.
-- Requires the quiz-attempt migrations and seeded bohr_models questions.
BEGIN;

DO $$
DECLARE
  teacher uuid;
  activity uuid;
  classroom uuid;
  assignment uuid;
  student uuid;
  first_attempt public.student_attempts%ROWTYPE;
  replayed_attempt public.student_attempts%ROWTYPE;
  failed_attempt public.student_attempts%ROWTYPE;
  failed_replay public.student_attempts%ROWTYPE;
  pass_answers jsonb;
  fail_answers jsonb;
  attempt_count integer;
BEGIN
  SELECT id INTO teacher FROM public.teachers LIMIT 1;
  SELECT id INTO activity
    FROM public.activities
    WHERE type::text = 'bohr_model_intro'
    LIMIT 1;
  IF teacher IS NULL OR activity IS NULL THEN
    RAISE EXCEPTION 'Teacher and Bohr activity anchors required';
  END IF;

  IF (SELECT count(*) FROM public.quiz_questions
      WHERE quiz_key = 'bohr_models' AND is_active) < 12 THEN
    RAISE EXCEPTION 'At least 12 active Bohr questions are required';
  END IF;

  INSERT INTO public.classes(teacher_id, name, section, class_code)
    VALUES (teacher, 'Quiz attempt test', 'Test', upper(substr(md5(random()::text), 1, 6)))
    RETURNING id INTO classroom;
  INSERT INTO public.class_activities(class_id, activity_id)
    VALUES (classroom, activity)
    RETURNING id INTO assignment;
  INSERT INTO public.students(class_id, first_name, last_name, student_id, verified)
    VALUES (classroom, 'Quiz', 'Attempt', gen_random_uuid()::text, true)
    RETURNING id INTO student;

  SELECT jsonb_agg(
    jsonb_build_object('questionId', question_key, 'selectedIndex', correct_index)
    ORDER BY order_index, question_key
  ) INTO pass_answers
    FROM (
      SELECT question_key, correct_index, order_index
        FROM public.quiz_questions
        WHERE quiz_key = 'bohr_models' AND is_active
        ORDER BY order_index, question_key
        LIMIT 12
    ) questions;

  SELECT jsonb_agg(
    jsonb_build_object(
      'questionId', question_key,
      'selectedIndex', (correct_index + 1) % jsonb_array_length(options)
    )
    ORDER BY order_index, question_key
  ) INTO fail_answers
    FROM (
      SELECT question_key, correct_index, options, order_index
        FROM public.quiz_questions
        WHERE quiz_key = 'bohr_models' AND is_active
        ORDER BY order_index, question_key
        LIMIT 12
    ) questions;

  SET LOCAL ROLE service_role;

  SELECT * INTO first_attempt
    FROM public.student_quiz_submit(
      student, classroom, assignment, 'bohr_models', 'quiz-submit-1', pass_answers
    );
  IF first_attempt.attempt_number <> 1
     OR first_attempt.score <> 12
     OR first_attempt.question_total <> 12
     OR first_attempt.percentage <> 100
     OR first_attempt.passed IS NOT TRUE
     OR first_attempt.status <> 'completed' THEN
    RAISE EXCEPTION 'Passing quiz attempt was not persisted correctly';
  END IF;

  SELECT * INTO replayed_attempt
    FROM public.student_quiz_submit(
      student, classroom, assignment, 'bohr_models', 'quiz-submit-1', pass_answers
    );
  IF replayed_attempt.id <> first_attempt.id
     OR replayed_attempt.completed_at <> first_attempt.completed_at
     OR replayed_attempt.updated_at <> first_attempt.updated_at THEN
    RAISE EXCEPTION 'Replayed passing submission changed its result';
  END IF;

  SELECT * INTO failed_attempt
    FROM public.student_quiz_submit(
      student, classroom, assignment, 'bohr_models', 'quiz-submit-2', fail_answers
    );
  IF failed_attempt.id = first_attempt.id
     OR failed_attempt.attempt_number <> 2
     OR failed_attempt.score <> 0
     OR failed_attempt.passed IS NOT FALSE
     OR failed_attempt.status <> 'completed' THEN
    RAISE EXCEPTION 'Failed retry was not persisted as a new attempt';
  END IF;

  SELECT * INTO failed_replay
    FROM public.student_quiz_submit(
      student, classroom, assignment, 'bohr_models', 'quiz-submit-2', fail_answers
    );
  IF failed_replay.id <> failed_attempt.id
     OR failed_replay.completed_at <> failed_attempt.completed_at THEN
    RAISE EXCEPTION 'Replayed failed submission changed its result';
  END IF;

  SELECT count(*) INTO attempt_count
    FROM public.student_attempts
    WHERE progress_id = first_attempt.progress_id
      AND quiz_key = 'bohr_models';
  IF attempt_count <> 2 THEN
    RAISE EXCEPTION 'Replay created an extra quiz attempt';
  END IF;

  RESET ROLE;
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.student_quiz_submit(
      student, classroom, assignment, 'bohr_models', 'browser-submit', pass_answers
    );
    RAISE EXCEPTION 'Authenticated browser invoked the quiz RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RESET ROLE;
END $$;

SELECT 'PASS: quiz pass/fail persistence, replay idempotency, retry numbering and browser RPC denial' AS result;
ROLLBACK;
