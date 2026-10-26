-- Two graduated cylinder activities, each with its own server-graded quiz, in
-- the same way as the tenths and hundredths ruler activities:
--
--   measurement_graduated_cylinder_whole  mode cylinder_whole   marks every 10 mL, report to 1 mL,   accept ±2 mL
--   measurement_graduated_cylinder        mode cylinder_tenths  marks every 1 mL,  report to 0.1 mL, accept ±0.2 mL
--
-- The existing type keeps meaning tenths, so its assignments, quiz sessions,
-- and saved attempts are unchanged. Tolerances match CYLINDER_WHOLE_SPEC and
-- CYLINDER_SPEC in src/lib/measurement/instruments.ts.
--
-- Requires 20261025000000_cylinder_whole_activity_type.sql to be applied first.
BEGIN;

-- Catalog: the coarser scale comes first, as with the rulers.
UPDATE public.activities
  SET title = 'Graduated Cylinder — Tenths', order_index = 9
  WHERE type = 'measurement_graduated_cylinder';

INSERT INTO public.activities (id, title, type, order_index)
SELECT gen_random_uuid(), 'Graduated Cylinder — Whole milliliters',
  'measurement_graduated_cylinder_whole'::public.activity_type, 8
WHERE NOT EXISTS (
  SELECT 1 FROM public.activities a
  WHERE a.type = 'measurement_graduated_cylinder_whole'::public.activity_type
);

-- Constraints that enumerate the quiz modes.
ALTER TABLE public.measurement_quiz_readings
  DROP CONSTRAINT IF EXISTS measurement_quiz_readings_mode_check,
  ADD CONSTRAINT measurement_quiz_readings_mode_check CHECK (
    mode IN ('ruler_tenths', 'ruler_hundredths', 'cylinder_whole', 'cylinder_tenths')
  ),
  DROP CONSTRAINT IF EXISTS measurement_quiz_readings_within_instrument,
  ADD CONSTRAINT measurement_quiz_readings_within_instrument CHECK (
    reading <= (CASE WHEN mode LIKE 'cylinder_%' THEN 50 ELSE 10 END)
  );

ALTER TABLE public.measurement_quiz_sessions
  DROP CONSTRAINT IF EXISTS measurement_quiz_sessions_mode_check,
  ADD CONSTRAINT measurement_quiz_sessions_mode_check CHECK (
    mode IN ('ruler_tenths', 'ruler_hundredths', 'cylinder_whole', 'cylinder_tenths')
  );

ALTER TABLE public.student_attempts
  DROP CONSTRAINT IF EXISTS student_attempts_measurement_mode_consistent,
  ADD CONSTRAINT student_attempts_measurement_mode_consistent CHECK (
    (quiz_key IS NULL AND instrument IS NULL AND precision_mode IS NULL)
    OR (quiz_key IN ('measurement_ruler_tenths', 'measurement_ruler_hundredths')
        AND instrument = 'ruler'
        AND precision_mode = (CASE quiz_key
          WHEN 'measurement_ruler_tenths' THEN 'tenths'
          ELSE 'hundredths'
        END))
    OR (quiz_key IN ('measurement_cylinder_whole', 'measurement_cylinder_tenths')
        AND instrument = 'cylinder'
        AND precision_mode = (CASE quiz_key
          WHEN 'measurement_cylinder_whole' THEN 'whole'
          ELSE 'tenths'
        END))
    OR (quiz_key NOT IN (
          'measurement_ruler_tenths',
          'measurement_ruler_hundredths',
          'measurement_cylinder_whole',
          'measurement_cylinder_tenths'
        ) AND instrument IS NULL AND precision_mode IS NULL)
  );

-- Whole-milliliter readings, none on a printed 10 mL mark. Matches
-- MODE_QUESTION_POOL.cylinder_whole in src/lib/measurement/quiz.ts.
INSERT INTO public.measurement_quiz_readings(mode, question_key, reading) VALUES
  ('cylinder_whole', 'cylinder_whole_01', 7), ('cylinder_whole', 'cylinder_whole_02', 13),
  ('cylinder_whole', 'cylinder_whole_03', 18), ('cylinder_whole', 'cylinder_whole_04', 24),
  ('cylinder_whole', 'cylinder_whole_05', 26), ('cylinder_whole', 'cylinder_whole_06', 33),
  ('cylinder_whole', 'cylinder_whole_07', 37), ('cylinder_whole', 'cylinder_whole_08', 41),
  ('cylinder_whole', 'cylinder_whole_09', 44), ('cylinder_whole', 'cylinder_whole_10', 46),
  ('cylinder_whole', 'cylinder_whole_11', 48), ('cylinder_whole', 'cylinder_whole_12', 49)
ON CONFLICT (mode, question_key) DO NOTHING;

-- Unchanged from 20261012050000 apart from the cylinder_whole mode and an
-- explicit activity type for every mode.
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
  IF p_mode IS NULL OR p_mode NOT IN (
    'ruler_tenths', 'ruler_hundredths', 'cylinder_whole', 'cylinder_tenths'
  ) THEN
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

  IF NOT FOUND OR v_activity_type IS DISTINCT FROM (CASE p_mode
      WHEN 'ruler_tenths' THEN 'measurement_ruler_tenths'
      WHEN 'ruler_hundredths' THEN 'measurement_ruler_hundredths'
      WHEN 'cylinder_whole' THEN 'measurement_graduated_cylinder_whole'
      WHEN 'cylinder_tenths' THEN 'measurement_graduated_cylinder'
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

-- Unchanged from 20261020000000 apart from the cylinder_whole mode, the
-- cylinder answer bound applying to both cylinder modes, and an explicit
-- activity type for every mode.
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
      WHEN 'cylinder_whole' THEN 'measurement_graduated_cylinder_whole'
      WHEN 'cylinder_tenths' THEN 'measurement_graduated_cylinder'
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
  v_decimals := CASE v_mode
    WHEN 'ruler_hundredths' THEN 2
    WHEN 'cylinder_whole' THEN 0
    ELSE 1
  END;
  v_precision := CASE v_mode
    WHEN 'ruler_hundredths' THEN 100
    WHEN 'cylinder_whole' THEN 1
    ELSE 10
  END;
  v_tolerance := CASE v_mode
    WHEN 'ruler_hundredths' THEN 0.02
    WHEN 'ruler_tenths' THEN 0.2
    WHEN 'cylinder_whole' THEN 2
    WHEN 'cylinder_tenths' THEN 0.2
  END;
  v_scale := v_precision;

  IF p_answer IS NOT NULL AND length(p_answer) <= 64
     AND p_answer ~ '^[+-]?([0-9]+([.][0-9]+)?|[.][0-9]+)$' THEN
    v_answer := p_answer::numeric;
    IF v_answer >= 0 AND v_answer <= (CASE
        WHEN v_mode LIKE 'cylinder_%' THEN 50
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

-- Unchanged from 20261012050000 apart from the cylinder_whole precision and
-- an explicit activity type for every mode.
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
      WHEN 'cylinder_whole' THEN 'measurement_graduated_cylinder_whole'
      WHEN 'cylinder_tenths' THEN 'measurement_graduated_cylinder'
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
  v_precision_mode := CASE v_session.mode
    WHEN 'ruler_hundredths' THEN 'hundredths'
    WHEN 'cylinder_whole' THEN 'whole'
    ELSE 'tenths'
  END;

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

-- Unchanged from 20261010190000 apart from allowing the new activity type.
CREATE OR REPLACE FUNCTION public.student_attempt_transition(
  p_student_id uuid, p_class_id uuid, p_assignment_id uuid,
  p_action text, p_attempt_id uuid DEFAULT NULL
) RETURNS SETOF public.student_attempts
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  progress uuid;
  latest public.student_attempts%ROWTYPE;
  requested public.student_attempts%ROWTYPE;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('start','complete','retry') THEN
    RAISE EXCEPTION 'Invalid attempt action' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.class_activities ca
    JOIN public.classes c ON c.id = ca.class_id
    JOIN public.students s ON s.class_id = c.id
    JOIN public.activities a ON a.id = ca.activity_id
    WHERE ca.id = p_assignment_id AND c.id = p_class_id
      AND s.id = p_student_id AND c.is_active
      AND ca.archived_at IS NULL
      AND (ca.opens_at IS NULL OR ca.opens_at <= now())
      AND (ca.closes_at IS NULL OR ca.closes_at > now())
      AND a.type::text IN (
        'bohr_model_intro',
        'bohr_model_stability',
        'lewis_diagram',
        'lewis_structures_ionic',
        'lewis_structures_covalent',
        'measurement_ruler_tenths',
        'measurement_ruler_hundredths',
        'measurement_graduated_cylinder_whole',
        'measurement_graduated_cylinder'
      )
    FOR SHARE OF ca, c, s, a;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment unavailable' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.student_progress(student_id,class_activity_id)
    VALUES(p_student_id,p_assignment_id)
    ON CONFLICT (student_id,class_activity_id) DO NOTHING;

  SELECT id INTO progress FROM public.student_progress
    WHERE student_id=p_student_id AND class_activity_id=p_assignment_id FOR UPDATE;

  SELECT * INTO latest FROM public.student_attempts
    WHERE progress_id=progress AND quiz_key IS NULL
    ORDER BY attempt_number DESC LIMIT 1;

  IF p_action='start' THEN
    IF latest.id IS NOT NULL THEN RETURN NEXT latest; RETURN; END IF;
  ELSE
    SELECT * INTO requested FROM public.student_attempts
      WHERE id=p_attempt_id AND progress_id=progress AND quiz_key IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Attempt unavailable' USING ERRCODE='42501';
    END IF;

    IF p_action='complete' THEN
      IF requested.status='completed' THEN RETURN NEXT requested; RETURN; END IF;
      IF requested.id<>latest.id THEN
        RAISE EXCEPTION 'Stale attempt' USING ERRCODE='22023';
      END IF;
      UPDATE public.student_attempts
        SET status='completed', completed_at=clock_timestamp()
        WHERE id=requested.id RETURNING * INTO requested;
      UPDATE public.student_progress
        SET status='completed', completed_at=requested.completed_at
        WHERE id=progress;
      RETURN NEXT requested; RETURN;
    END IF;

    IF requested.status<>'completed' THEN
      RAISE EXCEPTION 'Finish this attempt before retrying' USING ERRCODE='22023';
    END IF;
    IF latest.id<>requested.id THEN RETURN NEXT latest; RETURN; END IF;
  END IF;

  INSERT INTO public.student_attempts(progress_id,attempt_number)
    VALUES(progress,COALESCE(latest.attempt_number,0)+1)
    RETURNING * INTO latest;

  UPDATE public.student_progress
    SET status='in_progress',
        started_at=COALESCE(started_at,latest.started_at),
        completed_at=NULL
    WHERE id=progress;

  RETURN NEXT latest;
END;
$$;

COMMIT;
