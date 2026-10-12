-- Unassigning an activity sets class_activities.archived_at. The exploration
-- path already refuses archived assignments (20261010190000), but the quiz
-- functions and the teacher's lesson progress did not look at the column:
--
--   - student_quiz_submit and the three student_measurement_quiz_* functions
--     kept saving graded attempts for an assignment the teacher had removed,
--     for example from a tab left open on the quiz.
--   - teacher_class_lesson_progress still listed the removed lesson and counted
--     it in each student's overall percent, and showed a lesson twice once it
--     had been assigned again.
--
-- Each function below is unchanged from its latest definition apart from the
-- added archived_at check. A finished measurement attempt can still be
-- replayed, because that returns the saved result before the check runs.
BEGIN;

-- Unchanged from 20261007010000 apart from the archive check.
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
  submitted_question_key text;
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
      AND ca.archived_at IS NULL
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
    submitted_question_key := answer->>'questionId';
    IF submitted_question_key IS NULL OR submitted_question_key = ''
       OR (answer->>'selectedIndex') IS NULL
       OR (answer->>'selectedIndex') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Invalid quiz answer' USING ERRCODE = '22023';
    END IF;

    selected_index := (answer->>'selectedIndex')::integer;

    SELECT qq.correct_index, jsonb_array_length(qq.options)
      INTO correct_index, option_count
      FROM public.quiz_questions qq
      WHERE qq.quiz_key = p_quiz_key
        AND qq.question_key = submitted_question_key
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

-- Unchanged from 20261009022937 apart from the archive check.
CREATE OR REPLACE FUNCTION public.student_measurement_quiz_start(
  p_student_id uuid,
  p_class_id uuid,
  p_assignment_id uuid,
  p_mode text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_progress_id uuid;
  v_activity_type text;
  v_quiz_key text;
  v_session public.measurement_quiz_sessions%ROWTYPE;
  v_attempt_number integer;
  v_expected_questions integer := 5;
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('ruler_tenths', 'ruler_hundredths', 'cylinder_tenths') THEN
    RAISE EXCEPTION 'Invalid measurement quiz mode' USING ERRCODE = '22023';
  END IF;

  v_quiz_key := 'measurement_' || p_mode;
  SELECT a.type::text INTO v_activity_type
  FROM public.class_activities ca
  JOIN public.classes c ON c.id = ca.class_id
  JOIN public.students s ON s.class_id = c.id
  JOIN public.activities a ON a.id = ca.activity_id
  WHERE ca.id = p_assignment_id AND c.id = p_class_id
    AND s.id = p_student_id AND c.is_active
    AND ca.archived_at IS NULL
    AND (ca.opens_at IS NULL OR ca.opens_at <= now())
    AND (ca.closes_at IS NULL OR ca.closes_at > now())
  FOR SHARE OF ca, c, s, a;

  IF NOT FOUND OR v_activity_type <> (CASE p_mode
      WHEN 'ruler_tenths' THEN 'measurement_ruler_tenths'
      WHEN 'ruler_hundredths' THEN 'measurement_ruler_hundredths'
      ELSE 'measurement_graduated_cylinder'
    END) THEN
    RAISE EXCEPTION 'Measurement quiz assignment unavailable' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.student_progress(student_id, class_activity_id)
    VALUES (p_student_id, p_assignment_id)
    ON CONFLICT (student_id, class_activity_id) DO NOTHING;
  SELECT id INTO v_progress_id FROM public.student_progress
    WHERE student_id = p_student_id AND class_activity_id = p_assignment_id
    FOR UPDATE;

  SELECT * INTO v_session FROM public.measurement_quiz_sessions
    WHERE progress_id = v_progress_id AND mode = p_mode AND status = 'in_progress'
    FOR UPDATE;

  IF NOT FOUND THEN
    SELECT COALESCE(max(attempt_number), 0) + 1 INTO v_attempt_number
    FROM (
      SELECT ms.attempt_number FROM public.measurement_quiz_sessions ms
        WHERE ms.progress_id = v_progress_id AND ms.mode = p_mode
      UNION ALL
      SELECT sa.attempt_number FROM public.student_attempts sa
        WHERE sa.progress_id = v_progress_id AND sa.quiz_key = v_quiz_key
    ) attempts;

    INSERT INTO public.measurement_quiz_sessions(progress_id, mode, attempt_number)
      VALUES (v_progress_id, p_mode, v_attempt_number)
      RETURNING * INTO v_session;

    INSERT INTO public.measurement_quiz_session_questions(
      session_id, question_index, question_key, reading
    )
    SELECT v_session.id,
      row_number() OVER (ORDER BY selected.random_order)::integer - 1,
      selected.question_key,
      selected.reading
    FROM (
      SELECT question_key, reading, random() AS random_order
      FROM public.measurement_quiz_readings
      WHERE mode = p_mode
      ORDER BY random_order
      LIMIT v_expected_questions
    ) selected;

    IF (SELECT count(*) FROM public.measurement_quiz_session_questions
        WHERE session_id = v_session.id) <> v_expected_questions THEN
      RAISE EXCEPTION 'Measurement quiz question pool is incomplete' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'attempt_id', v_session.id,
    'attempt_number', v_session.attempt_number,
    'mode', v_session.mode,
    'questions', (
      SELECT jsonb_agg(jsonb_build_object(
        'question_index', q.question_index,
        'reading', q.reading,
        'first_answer', q.first_answer,
        'is_correct', q.is_correct
      ) ORDER BY q.question_index)
      FROM public.measurement_quiz_session_questions q
      WHERE q.session_id = v_session.id
    )
  );
END;
$$;

-- Unchanged from 20261011230000 apart from the archive check.
CREATE OR REPLACE FUNCTION public.student_measurement_quiz_record_answer(
  p_student_id uuid,
  p_class_id uuid,
  p_assignment_id uuid,
  p_attempt_id uuid,
  p_question_index integer,
  p_answer text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_session public.measurement_quiz_sessions%ROWTYPE;
  v_mode text;
  v_reading numeric;
  v_existing_answer text;
  v_existing_correct boolean;
  v_gradable boolean := false;
  v_answer numeric;
  v_decimals integer;
  v_precision integer;
  v_tolerance numeric;
  v_scale numeric;
  v_is_correct boolean;
  v_counted boolean := false;
  v_first_try_correct boolean;
BEGIN
  SELECT ms.* INTO v_session
  FROM public.measurement_quiz_sessions ms
  JOIN public.student_progress p ON p.id = ms.progress_id
  WHERE ms.id = p_attempt_id
    AND p.student_id = p_student_id
    AND p.class_activity_id = p_assignment_id
  FOR UPDATE OF ms;
  IF NOT FOUND OR v_session.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Measurement attempt unavailable' USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.student_progress p
  JOIN public.class_activities ca ON ca.id = p.class_activity_id
  JOIN public.classes c ON c.id = ca.class_id
  JOIN public.students s ON s.id = p.student_id
  JOIN public.activities a ON a.id = ca.activity_id
  WHERE p.id = v_session.progress_id AND p.student_id = p_student_id
    AND ca.id = p_assignment_id AND c.id = p_class_id AND s.class_id = c.id
    AND c.is_active
    AND ca.archived_at IS NULL
    AND (ca.opens_at IS NULL OR ca.opens_at <= now())
    AND (ca.closes_at IS NULL OR ca.closes_at > now())
    AND a.type::text = (CASE v_session.mode
      WHEN 'ruler_tenths' THEN 'measurement_ruler_tenths'
      WHEN 'ruler_hundredths' THEN 'measurement_ruler_hundredths'
      ELSE 'measurement_graduated_cylinder'
    END)
  FOR SHARE OF ca, c, s, a;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Measurement quiz assignment unavailable' USING ERRCODE = '42501';
  END IF;

  SELECT q.reading, q.first_answer, q.is_correct
    INTO v_reading, v_existing_answer, v_existing_correct
  FROM public.measurement_quiz_session_questions q
  WHERE q.session_id = v_session.id AND q.question_index = p_question_index
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Measurement question unavailable' USING ERRCODE = '22023';
  END IF;

  v_mode := v_session.mode;
  v_decimals := CASE v_mode WHEN 'ruler_hundredths' THEN 2 ELSE 1 END;
  v_precision := CASE v_mode WHEN 'ruler_hundredths' THEN 100 ELSE 10 END;
  v_tolerance := CASE v_mode
    WHEN 'ruler_hundredths' THEN 0.02
    WHEN 'cylinder_tenths' THEN 0.2
    ELSE 0.02
  END;
  v_scale := v_precision;

  IF p_answer IS NOT NULL AND length(p_answer) <= 64
     AND p_answer ~ '^[+-]?([0-9]+([.][0-9]+)?|[.][0-9]+)$' THEN
    v_answer := p_answer::numeric;
    IF v_answer >= 0 AND v_answer <= (CASE v_mode
        WHEN 'cylinder_tenths' THEN 50
        ELSE 10
      END) THEN
      v_gradable := true;
      v_is_correct := length(split_part(p_answer, '.', 2)) = v_decimals
        AND abs(round(v_answer * v_scale) - round(v_reading * v_scale))
          <= round(v_tolerance * v_scale);
    END IF;
  END IF;

  IF v_existing_answer IS NULL AND v_gradable THEN
    UPDATE public.measurement_quiz_session_questions
      SET first_answer = p_answer,
          is_correct = v_is_correct,
          answered_at = clock_timestamp()
      WHERE session_id = v_session.id AND question_index = p_question_index;
    v_counted := true;
    v_first_try_correct := v_is_correct;
  ELSE
    v_first_try_correct := v_existing_correct;
  END IF;

  RETURN jsonb_build_object(
    'mode', v_mode,
    'reading', v_reading,
    'counted', v_counted,
    'first_try_correct', v_first_try_correct
  );
END;
$$;

-- Unchanged from 20261009022937 apart from the archive check.
CREATE OR REPLACE FUNCTION public.student_measurement_quiz_complete(
  p_student_id uuid,
  p_class_id uuid,
  p_assignment_id uuid,
  p_attempt_id uuid
) RETURNS SETOF public.student_attempts
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_session public.measurement_quiz_sessions%ROWTYPE;
  v_quiz_key text;
  v_instrument text;
  v_precision_mode text;
  v_total integer;
  v_score integer;
  v_percentage numeric(5, 2);
  v_passed boolean;
  v_completed_at timestamptz := clock_timestamp();
  v_attempt public.student_attempts%ROWTYPE;
BEGIN
  SELECT ms.* INTO v_session
  FROM public.measurement_quiz_sessions ms
  JOIN public.student_progress p ON p.id = ms.progress_id
  WHERE ms.id = p_attempt_id
    AND p.student_id = p_student_id
    AND p.class_activity_id = p_assignment_id
  FOR UPDATE OF ms;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Measurement attempt unavailable' USING ERRCODE = '42501';
  END IF;

  IF v_session.status = 'completed' THEN
    RETURN QUERY SELECT * FROM public.student_attempts
      WHERE id = v_session.result_attempt_id;
    RETURN;
  END IF;

  PERFORM 1
  FROM public.student_progress p
  JOIN public.class_activities ca ON ca.id = p.class_activity_id
  JOIN public.classes c ON c.id = ca.class_id
  JOIN public.students s ON s.id = p.student_id
  JOIN public.activities a ON a.id = ca.activity_id
  WHERE p.id = v_session.progress_id AND p.student_id = p_student_id
    AND ca.id = p_assignment_id AND c.id = p_class_id AND s.class_id = c.id
    AND c.is_active
    AND ca.archived_at IS NULL
    AND (ca.opens_at IS NULL OR ca.opens_at <= now())
    AND (ca.closes_at IS NULL OR ca.closes_at > now())
    AND a.type::text = (CASE v_session.mode
      WHEN 'ruler_tenths' THEN 'measurement_ruler_tenths'
      WHEN 'ruler_hundredths' THEN 'measurement_ruler_hundredths'
      ELSE 'measurement_graduated_cylinder'
    END)
  FOR SHARE OF ca, c, s, a;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Measurement quiz assignment unavailable' USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::integer,
         count(*) FILTER (WHERE is_correct)::integer
    INTO v_total, v_score
  FROM public.measurement_quiz_session_questions
  WHERE session_id = v_session.id;
  IF v_total <> 5 THEN
    RAISE EXCEPTION 'Measurement attempt is incomplete' USING ERRCODE = '22023';
  END IF;

  v_percentage := round(v_score * 100.0 / v_total, 2);
  v_passed := v_percentage >= 80;
  v_quiz_key := 'measurement_' || v_session.mode;
  v_instrument := CASE WHEN v_session.mode LIKE 'ruler_%' THEN 'ruler' ELSE 'cylinder' END;
  v_precision_mode := CASE WHEN v_session.mode = 'ruler_hundredths' THEN 'hundredths' ELSE 'tenths' END;

  INSERT INTO public.student_attempts(
    progress_id, attempt_number, quiz_key, question_total, score, percentage,
    passed, submission_key, status, started_at, completed_at,
    instrument, precision_mode
  ) VALUES (
    v_session.progress_id, v_session.attempt_number, v_quiz_key, v_total, v_score,
    v_percentage, v_passed, v_session.id::text, 'completed',
    v_session.started_at, v_completed_at, v_instrument, v_precision_mode
  ) RETURNING * INTO v_attempt;

  UPDATE public.measurement_quiz_sessions
    SET status = 'completed', completed_at = v_completed_at,
        result_attempt_id = v_attempt.id
    WHERE id = v_session.id;

  RETURN NEXT v_attempt;
END;
$$;

-- Unchanged from 20261012040000 apart from leaving out archived assignments.
CREATE OR REPLACE FUNCTION public.teacher_class_lesson_progress(
  p_teacher_id uuid, p_class_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'classId', c.id, 'className', c.name,
    'students', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'studentId', s.id, 'firstName', s.first_name, 'lastName', s.last_name,
        'verified', s.verified,
        'lessons', lessons.items,
        'overallPercent', lessons.overall_percent
      ) ORDER BY s.last_name, s.first_name, s.id)
      FROM public.students s
      CROSS JOIN LATERAL (
        SELECT
          COALESCE(jsonb_agg(jsonb_build_object(
            'assignmentId', lr.assignment_id,
            'activityId', lr.activity_id,
            'activityTitle', lr.activity_title,
            'status', lr.status
          ) ORDER BY lr.order_index, lr.created_at), '[]'::jsonb) AS items,
          CASE WHEN count(*) = 0 THEN 0
            ELSE round(100.0 * count(*) FILTER (WHERE lr.status = 'completed') / count(*))
          END AS overall_percent
        FROM (
          SELECT
            ca.id AS assignment_id, a.id AS activity_id, a.title AS activity_title,
            a.order_index, ca.created_at,
            CASE
              WHEN a.type::text IN ('bohr_model_intro', 'bohr_model_stability') THEN
                CASE
                  WHEN COALESCE(p.status, 'not_started') = 'completed' OR quiz.passed_count > 0
                    THEN 'completed'
                  WHEN COALESCE(p.status, 'not_started') <> 'not_started' OR quiz.attempt_count > 0
                    THEN 'in_progress'
                  ELSE 'not_started'
                END
              WHEN a.type::text IN ('lewis_structures_covalent', 'lewis_structures_ionic') THEN
                CASE
                  WHEN COALESCE(p.status, 'not_started') = 'completed' AND quiz.passed_count > 0
                    THEN 'completed'
                  WHEN COALESCE(p.status, 'not_started') <> 'not_started' OR quiz.attempt_count > 0
                    THEN 'in_progress'
                  ELSE 'not_started'
                END
              ELSE COALESCE(p.status::text, 'not_started')
            END AS status
          FROM public.class_activities ca
          JOIN public.activities a ON a.id = ca.activity_id
          LEFT JOIN public.student_progress p
            ON p.student_id = s.id AND p.class_activity_id = ca.id
          CROSS JOIN LATERAL (
            SELECT
              count(*) AS attempt_count,
              count(*) FILTER (WHERE sa.passed) AS passed_count
            FROM public.student_attempts sa
            WHERE sa.progress_id = p.id
              AND sa.quiz_key = (CASE
                WHEN a.type::text IN ('bohr_model_intro', 'bohr_model_stability') THEN 'bohr_models'
                WHEN a.type::text = 'lewis_structures_covalent' THEN 'lewis_covalent'
                WHEN a.type::text = 'lewis_structures_ionic' THEN 'lewis_ionic'
              END)
          ) quiz
          WHERE ca.class_id = c.id AND ca.archived_at IS NULL
        ) lr
      ) lessons
      WHERE s.class_id = c.id
    ), '[]'::jsonb)
  ) INTO result
  FROM public.classes c
  JOIN public.teachers t ON t.id = c.teacher_id
  WHERE c.id = p_class_id AND t.id = p_teacher_id;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Class progress access denied or unavailable.' USING ERRCODE = '42501';
  END IF;
  RETURN result;
END;
$$;

COMMIT;
