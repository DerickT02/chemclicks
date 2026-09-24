-- Atomic, server-managed exploration attempt lifecycle. No scores supplied by clients.
BEGIN;
CREATE UNIQUE INDEX student_attempts_one_active
  ON public.student_attempts(progress_id) WHERE status = 'in_progress';

CREATE FUNCTION public.student_attempt_transition(
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
      AND (ca.opens_at IS NULL OR ca.opens_at <= now())
      AND (ca.closes_at IS NULL OR ca.closes_at > now())
      AND a.type::text IN ('lewis_diagram','measurement_ruler_hundredths','measurement_graduated_cylinder')
    FOR SHARE OF ca, c, s, a;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment unavailable' USING ERRCODE = '42501';
  END IF;

  -- A unique student/assignment pair plus a row lock serializes simultaneous starts.
  INSERT INTO public.student_progress(student_id,class_activity_id)
    VALUES(p_student_id,p_assignment_id)
    ON CONFLICT (student_id,class_activity_id) DO NOTHING;
  SELECT id INTO progress FROM public.student_progress
    WHERE student_id=p_student_id AND class_activity_id=p_assignment_id FOR UPDATE;
  SELECT * INTO latest FROM public.student_attempts
    WHERE progress_id=progress ORDER BY attempt_number DESC LIMIT 1;

  IF p_action='start' THEN
    -- Refresh/repeated start always returns the current attempt, even if completed.
    IF latest.id IS NOT NULL THEN RETURN NEXT latest; RETURN; END IF;
  ELSE
    SELECT * INTO requested FROM public.student_attempts
      WHERE id=p_attempt_id AND progress_id=progress;
    IF NOT FOUND THEN RAISE EXCEPTION 'Attempt unavailable' USING ERRCODE='42501'; END IF;
    IF p_action='complete' THEN
      -- Replayed completion never changes history or a newer retry's progress.
      IF requested.status='completed' THEN RETURN NEXT requested; RETURN; END IF;
      IF requested.id<>latest.id THEN RAISE EXCEPTION 'Stale attempt' USING ERRCODE='22023'; END IF;
      UPDATE public.student_attempts SET status='completed', completed_at=clock_timestamp()
        WHERE id=requested.id RETURNING * INTO requested;
      UPDATE public.student_progress SET status='completed',completed_at=requested.completed_at
        WHERE id=progress;
      RETURN NEXT requested; RETURN;
    END IF;
    IF requested.status<>'completed' THEN
      RAISE EXCEPTION 'Finish this attempt before retrying' USING ERRCODE='22023';
    END IF;
    -- Double-clicks and stale retry requests cannot create further attempts.
    IF latest.id<>requested.id THEN RETURN NEXT latest; RETURN; END IF;
  END IF;

  INSERT INTO public.student_attempts(progress_id,attempt_number)
    VALUES(progress,COALESCE(latest.attempt_number,0)+1) RETURNING * INTO latest;
  UPDATE public.student_progress
    SET status='in_progress',started_at=COALESCE(started_at,latest.started_at),completed_at=NULL
    WHERE id=progress;
  RETURN NEXT latest;
END;
$$;
REVOKE ALL ON FUNCTION public.student_attempt_transition(uuid,uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.student_attempt_transition(uuid,uuid,uuid,text,uuid) TO service_role;

-- Preserve the Step 2 RPC signature, routing legacy creates through idempotent start.
CREATE OR REPLACE FUNCTION public.student_attempt_access(
  p_student_id uuid, p_class_id uuid, p_progress_id uuid, p_create boolean DEFAULT false
) RETURNS SETOF public.student_attempts
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE assignment uuid;
BEGIN
  SELECT p.class_activity_id INTO assignment FROM public.student_progress p
    JOIN public.students s ON s.id=p.student_id
    JOIN public.class_activities ca ON ca.id=p.class_activity_id
    JOIN public.classes c ON c.id=ca.class_id
    WHERE p.id=p_progress_id AND s.id=p_student_id
      AND s.class_id=p_class_id AND ca.class_id=p_class_id AND s.verified AND c.is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt access denied' USING ERRCODE='42501'; END IF;
  IF p_create THEN
    RETURN QUERY SELECT * FROM public.student_attempt_transition(p_student_id,p_class_id,assignment,'start',NULL);
  ELSE
    RETURN QUERY SELECT a.* FROM public.student_attempts a
      WHERE a.progress_id=p_progress_id ORDER BY a.attempt_number;
  END IF;
END;
$$;
COMMIT;
