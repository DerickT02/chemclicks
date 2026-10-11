-- SCRUM 135: persist quiz-specific metadata on the existing student_attempts table.
-- Exploration attempts continue to use NULL quiz_key. Quiz attempts are scoped
-- by quiz identity so they can coexist with exploration attempts for the same
-- assigned activity.
BEGIN;

ALTER TABLE public.student_attempts
  ADD COLUMN quiz_key text,
  ADD COLUMN question_total integer,
  ADD COLUMN percentage numeric(5, 2),
  ADD COLUMN submission_key text;

ALTER TABLE public.student_attempts
  ADD CONSTRAINT student_attempts_quiz_key_format
    CHECK (quiz_key IS NULL OR quiz_key ~ '^[a-z0-9_]+$'),
  ADD CONSTRAINT student_attempts_submission_key_not_blank
    CHECK (submission_key IS NULL OR length(btrim(submission_key)) > 0),
  ADD CONSTRAINT student_attempts_submission_requires_quiz
    CHECK (submission_key IS NULL OR quiz_key IS NOT NULL),
  ADD CONSTRAINT student_attempts_quiz_metadata_consistent
    CHECK (
      quiz_key IS NULL
      OR (
        question_total IS NOT NULL
        AND question_total > 0
        AND score IS NOT NULL
        AND score >= 0
        AND score <= question_total
        AND percentage IS NOT NULL
        AND percentage >= 0
        AND percentage <= 100
        AND percentage = round((score * 100.0) / question_total, 2)
        AND passed IS NOT NULL
        AND passed = (percentage >= 80)
      )
    );

-- The original constraint treated exploration and quiz attempts as one
-- sequence. Keep the original behavior for exploration rows, while allowing
-- each quiz to have its own retry sequence.
ALTER TABLE public.student_attempts
  DROP CONSTRAINT student_attempts_progress_number_key;

CREATE UNIQUE INDEX student_attempts_exploration_progress_number_key
  ON public.student_attempts (progress_id, attempt_number)
  WHERE quiz_key IS NULL;

CREATE UNIQUE INDEX student_attempts_quiz_progress_number_key
  ON public.student_attempts (progress_id, quiz_key, attempt_number)
  WHERE quiz_key IS NOT NULL;

-- The existing active-attempt index also needs to be scoped. Otherwise an
-- in-progress exploration and an in-progress quiz would conflict.
DROP INDEX IF EXISTS public.student_attempts_one_active;

CREATE UNIQUE INDEX student_attempts_one_active_exploration
  ON public.student_attempts (progress_id)
  WHERE status = 'in_progress' AND quiz_key IS NULL;

CREATE UNIQUE INDEX student_attempts_one_active_quiz
  ON public.student_attempts (progress_id, quiz_key)
  WHERE status = 'in_progress' AND quiz_key IS NOT NULL;

CREATE UNIQUE INDEX student_attempts_submission_key
  ON public.student_attempts (submission_key)
  WHERE submission_key IS NOT NULL;

COMMENT ON COLUMN public.student_attempts.quiz_key IS
  'NULL for exploration attempts; stable quiz identity for quiz attempts.';

COMMENT ON COLUMN public.student_attempts.submission_key IS
  'Server-validated idempotency key for a quiz submission.';

-- Keep the existing exploration lifecycle independent from quiz rows. The
-- function remains exploration-only; quiz submission gets its own server path.
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
      AND (ca.opens_at IS NULL OR ca.opens_at <= now())
      AND (ca.closes_at IS NULL OR ca.closes_at > now())
      AND a.type::text IN (
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
