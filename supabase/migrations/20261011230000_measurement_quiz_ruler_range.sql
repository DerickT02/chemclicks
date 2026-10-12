-- The ruler reads 0–10 cm, but both ruler pools kept four readings from the
-- earlier 0–15 cm ruler. The locked cursor cannot show them, so a student could
-- not answer those questions correctly. Replace them with in-range readings,
-- and stop the grader accepting ruler answers above 10 cm as gradable.
BEGIN;

-- An unfinished attempt that already drew an impossible reading cannot be
-- passed. Drop it (its questions cascade) so the next start draws a fresh set.
DELETE FROM public.measurement_quiz_sessions s
WHERE s.status = 'in_progress'
  AND s.mode IN ('ruler_tenths', 'ruler_hundredths')
  AND EXISTS (
    SELECT 1 FROM public.measurement_quiz_session_questions q
    WHERE q.session_id = s.id AND q.reading > 10
  );

UPDATE public.measurement_quiz_readings AS r
SET reading = v.reading
FROM (VALUES
  ('ruler_tenths', 'ruler_09', 0.5), ('ruler_tenths', 'ruler_10', 2.0),
  ('ruler_tenths', 'ruler_11', 6.6), ('ruler_tenths', 'ruler_12', 7.7),
  ('ruler_hundredths', 'ruler_09', 0.55), ('ruler_hundredths', 'ruler_10', 2.09),
  ('ruler_hundredths', 'ruler_11', 6.62), ('ruler_hundredths', 'ruler_12', 7.78)
) AS v(mode, question_key, reading)
WHERE r.mode = v.mode AND r.question_key = v.question_key;

ALTER TABLE public.measurement_quiz_readings
  ADD CONSTRAINT measurement_quiz_readings_within_instrument CHECK (
    reading <= (CASE mode WHEN 'cylinder_tenths' THEN 50 ELSE 10 END)
  );

-- Unchanged from 20261009022937 except the ruler answer bound (15 -> 10).
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

COMMIT;
