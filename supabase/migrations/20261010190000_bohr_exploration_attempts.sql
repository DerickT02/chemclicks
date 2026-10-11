-- JIRA 100: allow exploration attempts on Bohr introduction/stability assignments.
-- The supported list matches hasActivityContent in src/lib/assignments/activity-content.ts.
-- Exploration rows keep a NULL quiz_key, so finishing a Bohr exploration never
-- reads or writes the bohr_models quiz attempts that share the same progress row.
-- This also restores the archived-assignment check from
-- 20261002194600_class_activities_archive.sql, which the later
-- 20261007000000_quiz_attempt_metadata.sql replacement dropped.
BEGIN;

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

REVOKE ALL ON FUNCTION public.student_attempt_transition(uuid,uuid,uuid,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.student_attempt_transition(uuid,uuid,uuid,text,uuid)
  TO service_role;

COMMIT;
