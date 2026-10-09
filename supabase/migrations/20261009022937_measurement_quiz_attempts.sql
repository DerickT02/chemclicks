-- SCRUM-152: persist server-graded measurement quiz attempts alongside the
-- shared student_attempts result contract. Exploration rows remain quiz_key NULL.
BEGIN;

ALTER TABLE public.student_attempts
  ADD COLUMN instrument text,
  ADD COLUMN precision_mode text,
  ADD CONSTRAINT student_attempts_measurement_mode_consistent CHECK (
    (quiz_key IS NULL AND instrument IS NULL AND precision_mode IS NULL)
    OR (quiz_key IN ('measurement_ruler_tenths', 'measurement_ruler_hundredths')
        AND instrument = 'ruler'
        AND precision_mode = CASE quiz_key
          WHEN 'measurement_ruler_tenths' THEN 'tenths'
          ELSE 'hundredths'
        END)
    OR (quiz_key = 'measurement_cylinder_tenths'
        AND instrument = 'cylinder'
        AND precision_mode = 'tenths')
    OR (quiz_key NOT IN (
          'measurement_ruler_tenths',
          'measurement_ruler_hundredths',
          'measurement_cylinder_tenths'
        ) AND instrument IS NULL AND precision_mode IS NULL)
  );

CREATE TABLE public.measurement_quiz_readings (
  mode text NOT NULL CHECK (mode IN ('ruler_tenths', 'ruler_hundredths', 'cylinder_tenths')),
  question_key text NOT NULL CHECK (length(btrim(question_key)) > 0),
  reading numeric(6, 2) NOT NULL CHECK (reading >= 0),
  PRIMARY KEY (mode, question_key),
  UNIQUE (mode, reading)
);

INSERT INTO public.measurement_quiz_readings(mode, question_key, reading) VALUES
  ('ruler_tenths', 'ruler_01', 1.4), ('ruler_tenths', 'ruler_02', 2.8),
  ('ruler_tenths', 'ruler_03', 3.7), ('ruler_tenths', 'ruler_04', 4.3),
  ('ruler_tenths', 'ruler_05', 5.9), ('ruler_tenths', 'ruler_06', 7.1),
  ('ruler_tenths', 'ruler_07', 8.6), ('ruler_tenths', 'ruler_08', 9.2),
  ('ruler_tenths', 'ruler_09', 10.5), ('ruler_tenths', 'ruler_10', 11.6),
  ('ruler_tenths', 'ruler_11', 12.0), ('ruler_tenths', 'ruler_12', 13.7),
  ('ruler_hundredths', 'ruler_01', 1.46), ('ruler_hundredths', 'ruler_02', 2.85),
  ('ruler_hundredths', 'ruler_03', 3.72), ('ruler_hundredths', 'ruler_04', 4.37),
  ('ruler_hundredths', 'ruler_05', 5.93), ('ruler_hundredths', 'ruler_06', 7.18),
  ('ruler_hundredths', 'ruler_07', 8.64), ('ruler_hundredths', 'ruler_08', 9.21),
  ('ruler_hundredths', 'ruler_09', 10.55), ('ruler_hundredths', 'ruler_10', 11.62),
  ('ruler_hundredths', 'ruler_11', 12.09), ('ruler_hundredths', 'ruler_12', 13.78),
  ('cylinder_tenths', 'cylinder_01', 6.3), ('cylinder_tenths', 'cylinder_02', 8.6),
  ('cylinder_tenths', 'cylinder_03', 12.7), ('cylinder_tenths', 'cylinder_04', 17.2),
  ('cylinder_tenths', 'cylinder_05', 19.5), ('cylinder_tenths', 'cylinder_06', 23.4),
  ('cylinder_tenths', 'cylinder_07', 28.8), ('cylinder_tenths', 'cylinder_08', 31.1),
  ('cylinder_tenths', 'cylinder_09', 36.6), ('cylinder_tenths', 'cylinder_10', 41.7),
  ('cylinder_tenths', 'cylinder_11', 44.3), ('cylinder_tenths', 'cylinder_12', 47.9);

CREATE TABLE public.measurement_quiz_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  progress_id uuid NOT NULL REFERENCES public.student_progress(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('ruler_tenths', 'ruler_hundredths', 'cylinder_tenths')),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  result_attempt_id uuid REFERENCES public.student_attempts(id) ON DELETE SET NULL,
  UNIQUE (progress_id, mode, attempt_number),
  CHECK (
    (status = 'in_progress' AND completed_at IS NULL AND result_attempt_id IS NULL)
    OR (status = 'completed' AND completed_at IS NOT NULL AND result_attempt_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX measurement_quiz_one_active_per_mode
  ON public.measurement_quiz_sessions(progress_id, mode)
  WHERE status = 'in_progress';

CREATE TABLE public.measurement_quiz_session_questions (
  session_id uuid NOT NULL REFERENCES public.measurement_quiz_sessions(id) ON DELETE CASCADE,
  question_index integer NOT NULL CHECK (question_index >= 0),
  question_key text NOT NULL,
  reading numeric(6, 2) NOT NULL CHECK (reading >= 0),
  first_answer text,
  is_correct boolean,
  answered_at timestamptz,
  PRIMARY KEY (session_id, question_index),
  UNIQUE (session_id, question_key),
  CHECK (
    (first_answer IS NULL AND is_correct IS NULL AND answered_at IS NULL)
    OR (first_answer IS NOT NULL AND is_correct IS NOT NULL AND answered_at IS NOT NULL)
  )
);

ALTER TABLE public.measurement_quiz_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_quiz_session_questions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.measurement_quiz_readings,
  public.measurement_quiz_sessions,
  public.measurement_quiz_session_questions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.measurement_quiz_readings TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.measurement_quiz_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.measurement_quiz_session_questions TO service_role;

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
    AND (ca.opens_at IS NULL OR ca.opens_at <= now())
    AND (ca.closes_at IS NULL OR ca.closes_at > now())
  FOR SHARE OF ca, c, s, a;

  IF NOT FOUND OR v_activity_type <> CASE p_mode
      WHEN 'ruler_tenths' THEN 'measurement_ruler_tenths'
      WHEN 'ruler_hundredths' THEN 'measurement_ruler_hundredths'
      ELSE 'measurement_graduated_cylinder'
    END THEN
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
    AND (ca.opens_at IS NULL OR ca.opens_at <= now())
    AND (ca.closes_at IS NULL OR ca.closes_at > now())
    AND a.type::text = CASE v_session.mode
      WHEN 'ruler_tenths' THEN 'measurement_ruler_tenths'
      WHEN 'ruler_hundredths' THEN 'measurement_ruler_hundredths'
      ELSE 'measurement_graduated_cylinder'
    END
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
    IF v_answer >= 0 AND v_answer <= CASE v_mode
        WHEN 'cylinder_tenths' THEN 50
        ELSE 15
      END THEN
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
    AND (ca.opens_at IS NULL OR ca.opens_at <= now())
    AND (ca.closes_at IS NULL OR ca.closes_at > now())
    AND a.type::text = CASE v_session.mode
      WHEN 'ruler_tenths' THEN 'measurement_ruler_tenths'
      WHEN 'ruler_hundredths' THEN 'measurement_ruler_hundredths'
      ELSE 'measurement_graduated_cylinder'
    END
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

REVOKE ALL ON FUNCTION public.student_measurement_quiz_start(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.student_measurement_quiz_record_answer(uuid, uuid, uuid, uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.student_measurement_quiz_complete(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_measurement_quiz_start(uuid, uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.student_measurement_quiz_record_answer(uuid, uuid, uuid, uuid, integer, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.student_measurement_quiz_complete(uuid, uuid, uuid, uuid)
  TO service_role;

COMMIT;
