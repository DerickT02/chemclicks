-- SCRUM 135: server-side quiz grading and idempotent quiz attempt creation.
BEGIN;

CREATE OR REPLACE FUNCTION public.student_quiz_submit(
  p_student_id uuid,
  p_class_id uuid,
  p_assignment_id uuid,
  p_quiz_key text,
  p_submission_key text,
  p_answers jsonb
) RETURNS SETOF public.student_attempts
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  progress uuid;
  assignment_type text;
  expected_questions integer;
  answer jsonb;
  question_key text;
  selected_index integer;
  correct_index integer;
  option_count integer;
  answer_count integer;
  question_pool_count integer;
  score_value integer := 0;
  next_attempt_number integer;
  percentage_value numeric(5, 2);
  passed_value boolean;
  started_timestamp timestamptz := clock_timestamp();
  completed_timestamp timestamptz;
  existing_attempt public.student_attempts%ROWTYPE;
  inserted_attempt public.student_attempts%ROWTYPE;
BEGIN
  IF p_quiz_key IS NULL OR p_quiz_key !~ '^[a-z0-9_]+$'
     OR p_submission_key IS NULL OR length(btrim(p_submission_key)) = 0
     OR p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN
    RAISE EXCEPTION 'Invalid quiz submission' USING ERRCODE = '22023';
  END IF;

  -- The server supplies the student and class identity. This check prevents
  -- the RPC from being used with a forged ownership chain even if a caller
  -- somehow obtains service-role execution.
  SELECT ca.id, a.type::text
    INTO progress, assignment_type
    FROM public.class_activities ca
    JOIN public.classes c ON c.id = ca.class_id
    JOIN public.students s ON s.class_id = c.id
    JOIN public.activities a ON a.id = ca.activity_id
    WHERE ca.id = p_assignment_id
      AND c.id = p_class_id
      AND s.id = p_student_id
      AND c.is_active
      AND (ca.opens_at IS NULL OR ca.opens_at <= now())
      AND (ca.closes_at IS NULL OR ca.closes_at > now())
      AND (
        (p_quiz_key = 'bohr_models' AND a.type::text IN ('bohr_model_intro', 'bohr_model_stability'))
        OR (p_quiz_key = 'lewis_covalent' AND a.type::text = 'lewis_structures_covalent')
        OR (p_quiz_key = 'lewis_ionic' AND a.type::text = 'lewis_structures_ionic')
      )
    FOR SHARE OF ca, c, s, a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz assignment unavailable' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.student_progress(student_id, class_activity_id)
    VALUES (p_student_id, p_assignment_id)
    ON CONFLICT (student_id, class_activity_id) DO NOTHING;

  SELECT id INTO progress
    FROM public.student_progress
    WHERE student_id = p_student_id
      AND class_activity_id = p_assignment_id
    FOR UPDATE;

  -- Replaying a submission returns the original immutable result.
  SELECT * INTO existing_attempt
    FROM public.student_attempts
    WHERE submission_key = p_submission_key
      AND progress_id = progress
      AND quiz_key = p_quiz_key;
  IF FOUND THEN
    RETURN NEXT existing_attempt;
    RETURN;
  END IF;

  SELECT count(*)::integer INTO question_pool_count
    FROM public.quiz_questions
    WHERE quiz_key = p_quiz_key AND is_active;

  expected_questions := LEAST(12, question_pool_count);
  answer_count := jsonb_array_length(p_answers);

  IF expected_questions = 0 OR answer_count <> expected_questions THEN
    RAISE EXCEPTION 'Quiz submission has an invalid question count' USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT count(DISTINCT value->>'questionId')
      FROM jsonb_array_elements(p_answers)
  ) <> answer_count THEN
    RAISE EXCEPTION 'Quiz submission contains duplicate questions' USING ERRCODE = '22023';
  END IF;

  FOR answer IN SELECT value FROM jsonb_array_elements(p_answers)
  LOOP
    question_key := answer->>'questionId';
    IF question_key IS NULL OR question_key = ''
       OR (answer->>'selectedIndex') IS NULL
       OR (answer->>'selectedIndex') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Invalid quiz answer' USING ERRCODE = '22023';
    END IF;

    selected_index := (answer->>'selectedIndex')::integer;

    SELECT qq.correct_index, jsonb_array_length(qq.options)
      INTO correct_index, option_count
      FROM public.quiz_questions qq
      WHERE qq.quiz_key = p_quiz_key
        AND qq.question_key = question_key
        AND qq.is_active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Quiz question is unavailable' USING ERRCODE = '22023';
    END IF;

    IF selected_index >= option_count THEN
      RAISE EXCEPTION 'Quiz answer choice is unavailable' USING ERRCODE = '22023';
    END IF;

    IF selected_index = correct_index THEN
      score_value := score_value + 1;
    END IF;
  END LOOP;

  percentage_value := round((score_value * 100.0) / answer_count, 2);
  passed_value := percentage_value >= 80;
  completed_timestamp := clock_timestamp();

  SELECT COALESCE(max(attempt_number), 0) + 1 INTO next_attempt_number
    FROM public.student_attempts
    WHERE progress_id = progress AND quiz_key = p_quiz_key;

  INSERT INTO public.student_attempts(
    progress_id,
    attempt_number,
    quiz_key,
    question_total,
    score,
    percentage,
    passed,
    submission_key,
    status,
    started_at,
    completed_at
  ) VALUES (
    progress,
    next_attempt_number,
    p_quiz_key,
    answer_count,
    score_value,
    percentage_value,
    passed_value,
    p_submission_key,
    'completed',
    started_timestamp,
    completed_timestamp
  ) RETURNING * INTO inserted_attempt;

  RETURN NEXT inserted_attempt;
END;
$$;

REVOKE ALL ON FUNCTION public.student_quiz_submit(uuid,uuid,uuid,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_quiz_submit(uuid,uuid,uuid,text,text,jsonb)
  TO service_role;

COMMIT;
