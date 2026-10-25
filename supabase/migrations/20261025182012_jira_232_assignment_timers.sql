-- SCRUM-232: persist the assignment exploration-to-quiz lifecycle.
-- The exploration duration ends at the first server-recorded quiz start.
-- Quiz retries update quiz_started_at, but never rewrite that first interval.
BEGIN;

ALTER TABLE public.student_progress
  ADD COLUMN exploration_started_at timestamptz,
  ADD COLUMN first_quiz_started_at timestamptz,
  ADD COLUMN quiz_started_at timestamptz,
  ADD COLUMN exploration_duration_seconds bigint,
  ADD CONSTRAINT student_progress_exploration_duration_nonnegative
    CHECK (exploration_duration_seconds IS NULL OR exploration_duration_seconds >= 0);

COMMENT ON COLUMN public.student_progress.exploration_started_at IS
  'First server-recorded start of assigned exploration; null when exploration has not been started.';
COMMENT ON COLUMN public.student_progress.first_quiz_started_at IS
  'First server-recorded start of the assigned quiz; null when no start timestamp was saved.';
COMMENT ON COLUMN public.student_progress.quiz_started_at IS
  'Latest server-recorded quiz start, including an explicit retry after a completed failed attempt.';
COMMENT ON COLUMN public.student_progress.exploration_duration_seconds IS
  'Wall-clock seconds from the first saved exploration start to the first saved quiz start; null when either endpoint is unknown.';

-- Recover exploration starts from saved history. Measurement sessions already
-- have authoritative start timestamps; older Bohr/Lewis attempts only record
-- submission time, so they are not used to invent quiz start times.
WITH first_explorations AS (
  SELECT sa.progress_id, min(sa.started_at) AS started_at
  FROM public.student_attempts sa
  WHERE sa.quiz_key IS NULL
  GROUP BY sa.progress_id
)
UPDATE public.student_progress p
SET exploration_started_at = first_explorations.started_at
FROM first_explorations
WHERE p.id = first_explorations.progress_id
  AND p.exploration_started_at IS NULL;

WITH measurement_starts AS (
  SELECT ms.progress_id,
    min(ms.started_at) AS first_started_at,
    max(ms.started_at) AS latest_started_at
  FROM public.measurement_quiz_sessions ms
  GROUP BY ms.progress_id
)
UPDATE public.student_progress p
SET first_quiz_started_at = measurement_starts.first_started_at,
    quiz_started_at = measurement_starts.latest_started_at,
    exploration_duration_seconds = CASE
      WHEN p.exploration_started_at IS NULL THEN NULL
      ELSE greatest(
        0::bigint,
        floor(extract(epoch FROM (
          measurement_starts.first_started_at - p.exploration_started_at
        )))::bigint
      )
    END
FROM measurement_starts
WHERE p.id = measurement_starts.progress_id
  AND p.first_quiz_started_at IS NULL;

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
      AND s.id = p_student_id AND s.verified AND c.is_active
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

  INSERT INTO public.student_progress(student_id, class_activity_id)
    VALUES (p_student_id, p_assignment_id)
    ON CONFLICT (student_id, class_activity_id) DO NOTHING;

  SELECT id INTO progress FROM public.student_progress
    WHERE student_id = p_student_id AND class_activity_id = p_assignment_id
    FOR UPDATE;

  SELECT * INTO latest FROM public.student_attempts
    WHERE progress_id = progress AND quiz_key IS NULL
    ORDER BY attempt_number DESC LIMIT 1;

  IF p_action = 'start' THEN
    IF latest.id IS NOT NULL THEN RETURN NEXT latest; RETURN; END IF;
  ELSE
    SELECT * INTO requested FROM public.student_attempts
      WHERE id = p_attempt_id AND progress_id = progress AND quiz_key IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Attempt unavailable' USING ERRCODE = '42501';
    END IF;

    IF p_action = 'complete' THEN
      IF requested.status = 'completed' THEN RETURN NEXT requested; RETURN; END IF;
      IF requested.id <> latest.id THEN
        RAISE EXCEPTION 'Stale attempt' USING ERRCODE = '22023';
      END IF;
      UPDATE public.student_attempts
        SET status = 'completed', completed_at = clock_timestamp()
        WHERE id = requested.id RETURNING * INTO requested;
      UPDATE public.student_progress
        SET status = 'completed', completed_at = requested.completed_at
        WHERE id = progress;
      RETURN NEXT requested; RETURN;
    END IF;

    IF requested.status <> 'completed' THEN
      RAISE EXCEPTION 'Finish this attempt before retrying' USING ERRCODE = '22023';
    END IF;
    IF latest.id <> requested.id THEN RETURN NEXT latest; RETURN; END IF;
  END IF;

  INSERT INTO public.student_attempts(progress_id, attempt_number)
    VALUES (progress, COALESCE(latest.attempt_number, 0) + 1)
    RETURNING * INTO latest;

  UPDATE public.student_progress p
    SET status = 'in_progress',
        started_at = COALESCE(p.started_at, latest.started_at),
        completed_at = NULL,
        exploration_started_at = CASE
          WHEN p.exploration_started_at IS NOT NULL THEN p.exploration_started_at
          WHEN p.first_quiz_started_at IS NOT NULL OR p.quiz_started_at IS NOT NULL THEN NULL
          WHEN EXISTS (
            SELECT 1 FROM public.student_attempts sa
            WHERE sa.progress_id = progress AND sa.quiz_key IS NOT NULL
          ) THEN NULL
          WHEN EXISTS (
            SELECT 1 FROM public.measurement_quiz_sessions ms
            WHERE ms.progress_id = progress
          ) THEN NULL
          ELSE latest.started_at
        END
    WHERE p.id = progress;

  RETURN NEXT latest;
END;
$$;

REVOKE ALL ON FUNCTION public.student_attempt_transition(uuid, uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_attempt_transition(uuid, uuid, uuid, text, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.student_quiz_start(
  p_student_id uuid,
  p_class_id uuid,
  p_assignment_id uuid,
  p_quiz_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_progress public.student_progress%ROWTYPE;
  v_started_at timestamptz;
  v_latest_completed_at timestamptz;
  v_has_quiz_history boolean;
BEGIN
  IF p_quiz_key IS NULL OR p_quiz_key !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Invalid quiz start' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.class_activities ca
  JOIN public.classes c ON c.id = ca.class_id
  JOIN public.students s ON s.class_id = c.id
  JOIN public.activities a ON a.id = ca.activity_id
  WHERE ca.id = p_assignment_id
    AND c.id = p_class_id
    AND s.id = p_student_id
    AND s.verified
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

  SELECT * INTO v_progress
  FROM public.student_progress
  WHERE student_id = p_student_id
    AND class_activity_id = p_assignment_id
  FOR UPDATE;

  SELECT max(sa.completed_at) INTO v_latest_completed_at
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress.id AND sa.quiz_key = p_quiz_key;

  SELECT EXISTS (
    SELECT 1 FROM public.student_attempts sa
    WHERE sa.progress_id = v_progress.id AND sa.quiz_key = p_quiz_key
  ) INTO v_has_quiz_history;

  IF v_progress.quiz_started_at IS NULL AND v_has_quiz_history THEN
    RETURN jsonb_build_object('status', 'retry_required');
  END IF;

  IF v_latest_completed_at IS NOT NULL
     AND (v_progress.quiz_started_at IS NULL
          OR v_latest_completed_at >= v_progress.quiz_started_at) THEN
    RETURN jsonb_build_object('status', 'retry_required');
  END IF;

  IF v_progress.quiz_started_at IS NULL THEN
    v_started_at := clock_timestamp();
    UPDATE public.student_progress p
    SET status = 'in_progress',
        started_at = COALESCE(p.started_at, v_started_at),
        completed_at = NULL,
        quiz_started_at = v_started_at,
        first_quiz_started_at = CASE
          WHEN p.first_quiz_started_at IS NULL AND NOT v_has_quiz_history
            THEN v_started_at
          ELSE p.first_quiz_started_at
        END,
        exploration_duration_seconds = CASE
          WHEN p.exploration_duration_seconds IS NOT NULL THEN p.exploration_duration_seconds
          WHEN p.exploration_started_at IS NOT NULL
               AND p.first_quiz_started_at IS NULL
               AND NOT v_has_quiz_history
            THEN greatest(
              0::bigint,
              floor(extract(epoch FROM (v_started_at - p.exploration_started_at)))::bigint
            )
          ELSE NULL
        END
    WHERE p.id = v_progress.id;
  ELSE
    -- Refreshes, duplicate clicks, and parallel tabs reuse the active start.
    v_started_at := v_progress.quiz_started_at;
  END IF;

  UPDATE public.student_attempts
  SET status = 'completed', completed_at = v_started_at
  WHERE progress_id = v_progress.id
    AND quiz_key IS NULL
    AND status = 'in_progress'
    AND started_at <= v_started_at;

  RETURN jsonb_build_object(
    'progress_id', v_progress.id,
    'status', 'in_progress',
    'started_at', v_started_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.student_quiz_start(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_quiz_start(uuid, uuid, uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.student_quiz_retry_start(
  p_student_id uuid,
  p_class_id uuid,
  p_assignment_id uuid,
  p_quiz_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_progress public.student_progress%ROWTYPE;
  v_latest_completed_at timestamptz;
  v_started_at timestamptz;
BEGIN
  IF p_quiz_key IS NULL OR p_quiz_key !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Invalid quiz retry' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.class_activities ca
  JOIN public.classes c ON c.id = ca.class_id
  JOIN public.students s ON s.class_id = c.id
  JOIN public.activities a ON a.id = ca.activity_id
  WHERE ca.id = p_assignment_id
    AND c.id = p_class_id
    AND s.id = p_student_id
    AND s.verified
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

  SELECT * INTO v_progress
  FROM public.student_progress
  WHERE student_id = p_student_id
    AND class_activity_id = p_assignment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz retry unavailable' USING ERRCODE = '42501';
  END IF;

  SELECT max(sa.completed_at) INTO v_latest_completed_at
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress.id AND sa.quiz_key = p_quiz_key;

  IF v_latest_completed_at IS NULL THEN
    RAISE EXCEPTION 'Quiz retry unavailable' USING ERRCODE = '42501';
  END IF;

  IF v_progress.quiz_started_at IS NOT NULL
     AND v_latest_completed_at < v_progress.quiz_started_at THEN
    -- Another tab already started the retry. Reuse that timestamp.
    RETURN jsonb_build_object(
      'progress_id', v_progress.id,
      'status', 'in_progress',
      'started_at', v_progress.quiz_started_at
    );
  END IF;

  v_started_at := clock_timestamp();
  UPDATE public.student_progress p
  SET status = 'in_progress',
      started_at = COALESCE(p.started_at, v_started_at),
      completed_at = NULL,
      quiz_started_at = v_started_at
  WHERE p.id = v_progress.id;

  UPDATE public.student_attempts
  SET status = 'completed', completed_at = v_started_at
  WHERE progress_id = v_progress.id
    AND quiz_key IS NULL
    AND status = 'in_progress'
    AND started_at <= v_started_at;

  RETURN jsonb_build_object(
    'progress_id', v_progress.id,
    'status', 'in_progress',
    'started_at', v_started_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.student_quiz_retry_start(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_quiz_retry_start(uuid, uuid, uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.student_measurement_quiz_start(
  p_student_id uuid,
  p_class_id uuid,
  p_assignment_id uuid,
  p_mode text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_progress public.student_progress%ROWTYPE;
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
    AND s.id = p_student_id AND s.verified AND c.is_active
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
  SELECT * INTO v_progress FROM public.student_progress
    WHERE student_id = p_student_id AND class_activity_id = p_assignment_id
    FOR UPDATE;

  SELECT * INTO v_session FROM public.measurement_quiz_sessions
    WHERE progress_id = v_progress.id AND mode = p_mode AND status = 'in_progress'
    FOR UPDATE;

  IF NOT FOUND THEN
    SELECT COALESCE(max(attempt_number), 0) + 1 INTO v_attempt_number
    FROM (
      SELECT ms.attempt_number FROM public.measurement_quiz_sessions ms
        WHERE ms.progress_id = v_progress.id AND ms.mode = p_mode
      UNION ALL
      SELECT sa.attempt_number FROM public.student_attempts sa
        WHERE sa.progress_id = v_progress.id AND sa.quiz_key = v_quiz_key
    ) attempts;

    INSERT INTO public.measurement_quiz_sessions(progress_id, mode, attempt_number)
      VALUES (v_progress.id, p_mode, v_attempt_number)
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

    UPDATE public.student_progress p
      SET status = 'in_progress',
          started_at = COALESCE(p.started_at, v_session.started_at),
          completed_at = NULL,
          quiz_started_at = v_session.started_at,
          first_quiz_started_at = CASE
            WHEN p.first_quiz_started_at IS NULL AND v_attempt_number = 1
              THEN v_session.started_at
            ELSE p.first_quiz_started_at
          END,
          exploration_duration_seconds = CASE
            WHEN p.exploration_duration_seconds IS NOT NULL THEN p.exploration_duration_seconds
            WHEN p.exploration_started_at IS NOT NULL
                 AND p.first_quiz_started_at IS NULL
                 AND v_attempt_number = 1
              THEN greatest(
                0::bigint,
                floor(extract(epoch FROM (
                  v_session.started_at - p.exploration_started_at
                )))::bigint
              )
            ELSE p.exploration_duration_seconds
          END
      WHERE p.id = v_progress.id;

    UPDATE public.student_attempts
      SET status = 'completed', completed_at = v_session.started_at
      WHERE progress_id = v_progress.id
        AND quiz_key IS NULL
        AND status = 'in_progress'
        AND started_at <= v_session.started_at;
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
    AND s.verified AND c.is_active
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
    AND s.verified AND c.is_active
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

CREATE OR REPLACE FUNCTION public.teacher_activity_attempt_summary(
  p_teacher_id uuid, p_class_id uuid, p_assignment_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'classId', c.id, 'className', c.name, 'assignmentId', ca.id,
    'activityId', a.id, 'activityTitle', a.title,
    'students', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'studentId', s.id, 'firstName', s.first_name, 'lastName', s.last_name,
        'verified', s.verified, 'attemptCount', history.attempt_count,
        'explorationAttemptCount', history.exploration_attempt_count,
        'quizAttemptCount', history.quiz_attempt_count,
        'completedCount', history.completed_count,
        'inProgressCount', history.in_progress_count,
        'stage', CASE
          WHEN EXISTS (
            SELECT 1 FROM public.measurement_quiz_sessions ms
            WHERE ms.progress_id = p.id AND ms.status = 'in_progress'
          ) THEN 'Taking quiz'
          WHEN p.quiz_started_at IS NOT NULL
               AND (latest_quiz.id IS NULL OR latest_quiz.completed_at IS NULL
                    OR p.quiz_started_at > latest_quiz.completed_at)
            THEN 'Taking quiz'
          WHEN latest_quiz.id IS NOT NULL AND latest_quiz.passed IS TRUE
            THEN 'Completed'
          WHEN latest_quiz.id IS NOT NULL THEN 'Needs retry'
          WHEN p.exploration_started_at IS NOT NULL THEN 'Exploring'
          ELSE 'Not started'
        END,
        'explorationStartedAt', p.exploration_started_at,
        'firstQuizStartedAt', p.first_quiz_started_at,
        'quizStartedAt', p.quiz_started_at,
        'explorationDurationSeconds', p.exploration_duration_seconds,
        'attempts', history.attempts
      ) ORDER BY s.last_name, s.first_name, s.id)
      FROM public.students s
      LEFT JOIN public.student_progress p
        ON p.student_id = s.id AND p.class_activity_id = ca.id
      CROSS JOIN LATERAL (
        SELECT count(*) AS attempt_count,
          count(*) FILTER (WHERE sa.quiz_key IS NULL) AS exploration_attempt_count,
          count(*) FILTER (WHERE sa.quiz_key IS NOT NULL) AS quiz_attempt_count,
          count(*) FILTER (WHERE sa.status = 'completed') AS completed_count,
          count(*) FILTER (WHERE sa.status = 'in_progress') AS in_progress_count,
          COALESCE(jsonb_agg(jsonb_build_object(
            'id', sa.id,
            'attemptNumber', sa.attempt_number,
            'status', sa.status,
            'startedAt', sa.started_at,
            'completedAt', sa.completed_at,
            'kind', CASE WHEN sa.quiz_key IS NULL THEN 'exploration' ELSE 'quiz' END,
            'quizKey', sa.quiz_key,
            'instrument', sa.instrument,
            'precisionMode', sa.precision_mode,
            'score', sa.score,
            'questionTotal', sa.question_total,
            'percentage', sa.percentage,
            'passed', sa.passed
          ) ORDER BY sa.attempt_number DESC, sa.created_at DESC), '[]'::jsonb) AS attempts
        FROM public.student_attempts sa WHERE sa.progress_id = p.id
      ) history
      LEFT JOIN LATERAL (
        SELECT sa.id, sa.completed_at, sa.passed
        FROM public.student_attempts sa
        WHERE sa.progress_id = p.id AND sa.quiz_key IS NOT NULL
        ORDER BY sa.attempt_number DESC, sa.created_at DESC
        LIMIT 1
      ) latest_quiz ON true
      WHERE s.class_id = c.id
    ), '[]'::jsonb)
  ) INTO result
  FROM public.classes c
  JOIN public.teachers t ON t.id = c.teacher_id
  JOIN public.class_activities ca ON ca.class_id = c.id
  JOIN public.activities a ON a.id = ca.activity_id
  WHERE c.id = p_class_id AND ca.id = p_assignment_id AND t.id = p_teacher_id;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Activity summary access denied or unavailable.' USING ERRCODE = '42501';
  END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.teacher_activity_attempt_summary(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_activity_attempt_summary(uuid, uuid, uuid)
  TO service_role;

COMMIT;
