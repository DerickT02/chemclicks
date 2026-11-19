-- SCRUM-232: start an assigned quiz against its originating assignment.
-- The transition is idempotent for refreshes and closes an active exploration
-- attempt on the same assignment before the quiz begins.
BEGIN;

CREATE OR REPLACE FUNCTION public.student_quiz_start(
  p_student_id uuid,
  p_class_id uuid,
  p_assignment_id uuid,
  p_quiz_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_progress_id uuid;
  v_started_at timestamptz := clock_timestamp();
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

  SELECT id INTO v_progress_id
  FROM public.student_progress
  WHERE student_id = p_student_id
    AND class_activity_id = p_assignment_id
  FOR UPDATE;

  UPDATE public.student_attempts
  SET status = 'completed', completed_at = v_started_at
  WHERE progress_id = v_progress_id
    AND quiz_key IS NULL
    AND status = 'in_progress';

  UPDATE public.student_progress
  SET status = 'in_progress',
      started_at = COALESCE(started_at, v_started_at),
      completed_at = NULL
  WHERE id = v_progress_id;

  RETURN jsonb_build_object(
    'progress_id', v_progress_id,
    'status', 'in_progress',
    'started_at', v_started_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.student_quiz_start(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_quiz_start(uuid, uuid, uuid, text)
  TO service_role;

COMMIT;
