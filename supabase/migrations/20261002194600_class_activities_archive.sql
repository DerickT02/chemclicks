-- Archive (unassign) keeps attempt history; re-assign creates a new active row.
BEGIN;

ALTER TABLE public.class_activities
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

COMMENT ON COLUMN public.class_activities.archived_at IS
  'When set, the assignment is hidden from students and the assign catalog. Attempt history is retained. Re-assigning the same activity creates a new row.';

ALTER TABLE public.class_activities
  DROP CONSTRAINT IF EXISTS class_activities_class_activity_key;

CREATE UNIQUE INDEX IF NOT EXISTS class_activities_active_class_activity_key
  ON public.class_activities (class_id, activity_id)
  WHERE archived_at IS NULL;

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
      AND a.type::text IN ('lewis_diagram','lewis_structures_ionic','lewis_structures_covalent','measurement_ruler_tenths','measurement_ruler_hundredths','measurement_graduated_cylinder')
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
    WHERE progress_id=progress ORDER BY attempt_number DESC LIMIT 1;

  IF p_action='start' THEN
    IF latest.id IS NOT NULL THEN RETURN NEXT latest; RETURN; END IF;
  ELSE
    SELECT * INTO requested FROM public.student_attempts
      WHERE id=p_attempt_id AND progress_id=progress;
    IF NOT FOUND THEN RAISE EXCEPTION 'Attempt unavailable' USING ERRCODE='42501'; END IF;
    IF p_action='complete' THEN
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

COMMIT;
