-- Transactional SCRUM-152 integration test. Run against the local Supabase DB.
BEGIN;
DO $$
DECLARE
  v_teacher uuid;
  v_class uuid;
  v_student uuid;
  v_activity uuid;
  v_assignment uuid;
  v_progress uuid;
  v_mode text;
  v_modes text[] := ARRAY['ruler_tenths', 'ruler_hundredths', 'cylinder_tenths'];
  v_start jsonb;
  v_question jsonb;
  v_receipt jsonb;
  v_attempt public.student_attempts%ROWTYPE;
  v_replayed public.student_attempts%ROWTYPE;
  v_attempt_id uuid;
  v_number integer;
  v_answer text;
  v_index integer;
BEGIN
  SELECT t.id INTO v_teacher FROM public.teachers t
    JOIN auth.users u ON u.id = t.id
    WHERE u.email_confirmed_at IS NOT NULL AND NOT COALESCE(u.is_anonymous, false)
    LIMIT 1;
  IF v_teacher IS NULL THEN RAISE EXCEPTION 'Verified teacher fixture required'; END IF;

  INSERT INTO public.classes(teacher_id, name, section, class_code)
    VALUES (v_teacher, 'Measurement quiz test', 'Test',
      upper(substr(md5(random()::text), 1, 6)))
    RETURNING id INTO v_class;
  INSERT INTO public.students(class_id, first_name, last_name, student_id, verified)
    VALUES (v_class, 'Measurement', 'Test', gen_random_uuid()::text, true)
    RETURNING id INTO v_student;

  SET LOCAL ROLE service_role;
  FOREACH v_mode IN ARRAY v_modes LOOP
    SELECT id INTO v_activity FROM public.activities WHERE type::text = CASE v_mode
      WHEN 'ruler_tenths' THEN 'measurement_ruler_tenths'
      WHEN 'ruler_hundredths' THEN 'measurement_ruler_hundredths'
      ELSE 'measurement_graduated_cylinder'
    END LIMIT 1;
    IF v_activity IS NULL THEN RAISE EXCEPTION 'Missing activity for %', v_mode; END IF;
    INSERT INTO public.class_activities(class_id, activity_id)
      VALUES (v_class, v_activity) RETURNING id INTO v_assignment;

    v_start := public.student_measurement_quiz_start(
      v_student, v_class, v_assignment, v_mode
    );
    v_attempt_id := (v_start->>'attempt_id')::uuid;
    v_number := (v_start->>'attempt_number')::integer;
    IF v_number <> 1 OR jsonb_array_length(v_start->'questions') <> 5 THEN
      RAISE EXCEPTION 'Attempt start contract failed for %', v_mode;
    END IF;

    FOR v_question IN SELECT value FROM jsonb_array_elements(v_start->'questions') LOOP
      v_index := (v_question->>'question_index')::integer;
      IF v_index = 0 THEN
        -- A valid but wrong first answer must remain the scored answer.
        v_answer := CASE WHEN v_mode = 'ruler_hundredths' THEN '0.00' ELSE '0.0' END;
      ELSE
        v_answer := to_char((v_question->>'reading')::numeric,
          CASE WHEN v_mode = 'ruler_hundredths' THEN 'FM999999990.00' ELSE 'FM999999990.0' END);
      END IF;
      v_receipt := public.student_measurement_quiz_record_answer(
        v_student, v_class, v_assignment, v_attempt_id, v_index, v_answer
      );
      IF (v_receipt->>'counted')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'First answer was not recorded for % question %', v_mode, v_index;
      END IF;
      IF v_index = 0 THEN
        v_answer := to_char((v_question->>'reading')::numeric,
          CASE WHEN v_mode = 'ruler_hundredths' THEN 'FM999999990.00' ELSE 'FM999999990.0' END);
        v_receipt := public.student_measurement_quiz_record_answer(
          v_student, v_class, v_assignment, v_attempt_id, v_index, v_answer
        );
        IF (v_receipt->>'counted')::boolean IS NOT FALSE
           OR (v_receipt->>'first_try_correct')::boolean IS NOT FALSE THEN
          RAISE EXCEPTION 'A retry changed the first answer for %', v_mode;
        END IF;
      END IF;
    END LOOP;

    SELECT * INTO v_attempt FROM public.student_measurement_quiz_complete(
      v_student, v_class, v_assignment, v_attempt_id
    );
    IF v_attempt.attempt_number <> 1 OR v_attempt.question_total <> 5
       OR v_attempt.score <> 4 OR v_attempt.passed IS NOT TRUE
       OR v_attempt.instrument <> CASE WHEN v_mode LIKE 'ruler_%' THEN 'ruler' ELSE 'cylinder' END
       OR v_attempt.precision_mode <> CASE WHEN v_mode = 'ruler_hundredths' THEN 'hundredths' ELSE 'tenths' END THEN
      RAISE EXCEPTION 'Completed result metadata or score is wrong for %', v_mode;
    END IF;

    SELECT * INTO v_replayed FROM public.student_measurement_quiz_complete(
      v_student, v_class, v_assignment, v_attempt_id
    );
    IF v_replayed.id <> v_attempt.id OR v_replayed.score <> v_attempt.score THEN
      RAISE EXCEPTION 'Completion replay changed the result for %', v_mode;
    END IF;

    IF v_mode = 'ruler_tenths' THEN
      SELECT id INTO v_progress FROM public.student_progress
        WHERE student_id = v_student AND class_activity_id = v_assignment;
      INSERT INTO public.student_attempts(progress_id, attempt_number, status)
        VALUES (v_progress, 1, 'in_progress');
      IF NOT EXISTS (
        SELECT 1 FROM public.student_attempts
        WHERE progress_id = v_progress AND quiz_key = 'measurement_ruler_tenths'
      ) OR NOT EXISTS (
        SELECT 1 FROM public.student_attempts
        WHERE progress_id = v_progress AND quiz_key IS NULL AND status = 'in_progress'
      ) THEN RAISE EXCEPTION 'Quiz and exploration attempts did not remain distinct'; END IF;
    END IF;

    v_start := public.student_measurement_quiz_start(
      v_student, v_class, v_assignment, v_mode
    );
    IF (v_start->>'attempt_number')::integer <> 2 THEN
      RAISE EXCEPTION 'Retry did not create the next attempt for %', v_mode;
    END IF;
    v_attempt_id := (v_start->>'attempt_id')::uuid;
    SELECT * INTO v_attempt FROM public.student_measurement_quiz_complete(
      v_student, v_class, v_assignment, v_attempt_id
    );
    IF v_attempt.attempt_number <> 2 OR v_attempt.score <> 0 OR v_attempt.passed IS NOT FALSE THEN
      RAISE EXCEPTION 'Failing retry result is wrong for %', v_mode;
    END IF;
  END LOOP;

  BEGIN
    PERFORM public.student_measurement_quiz_start(gen_random_uuid(), v_class, v_assignment, 'ruler_tenths');
    RAISE EXCEPTION 'Foreign student was allowed to start an attempt';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
END $$;
SELECT 'PASS: measurement modes, server scoring, first-answer immutability, retries, replay, access and exploration separation' AS result;
ROLLBACK;
