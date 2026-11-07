-- SCRUM-233: an assigned quiz-backed activity is complete only when its
-- exploration is complete and the matching server-graded quiz has passed.
BEGIN;

ALTER TABLE public.student_progress
  ADD COLUMN exploration_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN exploration_completed_at timestamptz;

COMMENT ON COLUMN public.student_progress.exploration_completed IS
  'Durable completion marker for the assignment exploration, independent of quiz status.';
COMMENT ON COLUMN public.student_progress.exploration_completed_at IS
  'First known server timestamp when the assignment exploration was completed.';

-- Preserve idempotent retries through later quiz starts. The legacy submit
-- RPC has no start timestamp parameter, so use the saved attempt's timestamp
-- when the same submission key is replayed after a retry has begun. The
-- canonical timer-aware RPC still performs all assignment and access checks.
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
  v_progress_id uuid;
  v_quiz_started_at timestamptz;
  v_existing_started_at timestamptz;
BEGIN
  SELECT p.id, p.quiz_started_at
    INTO v_progress_id, v_quiz_started_at
  FROM public.student_progress p
  WHERE p.student_id = p_student_id
    AND p.class_activity_id = p_assignment_id
  FOR UPDATE;

  IF NOT FOUND OR v_quiz_started_at IS NULL THEN
    RAISE EXCEPTION 'Quiz has not been started' USING ERRCODE = '42501';
  END IF;

  SELECT sa.started_at INTO v_existing_started_at
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress_id
    AND sa.quiz_key = p_quiz_key
    AND sa.submission_key = p_submission_key;

  IF FOUND THEN
    v_quiz_started_at := v_existing_started_at;
  END IF;

  RETURN QUERY
  SELECT * FROM public.student_quiz_submit(
    p_student_id,
    p_class_id,
    p_assignment_id,
    p_quiz_key,
    v_quiz_started_at,
    p_submission_key,
    p_answers
  );
END;
$$;

-- Completed exploration attempts are authoritative. Legacy progress rows are
-- also reliable except for Bohr rows that may have been marked complete by
-- the old quiz-pass trigger without any completed exploration attempt.
WITH completed_explorations AS (
  SELECT sa.progress_id,
    min(sa.completed_at) FILTER (WHERE sa.completed_at IS NOT NULL) AS completed_at
  FROM public.student_attempts sa
  WHERE sa.quiz_key IS NULL AND sa.status = 'completed'
  GROUP BY sa.progress_id
)
UPDATE public.student_progress p
SET exploration_completed = true,
    exploration_completed_at = COALESCE(p.exploration_completed_at, e.completed_at)
FROM completed_explorations e
WHERE p.id = e.progress_id;

UPDATE public.student_progress p
SET exploration_completed = true,
    exploration_completed_at = COALESCE(p.exploration_completed_at, p.completed_at)
FROM public.class_activities ca
JOIN public.activities a ON a.id = ca.activity_id
WHERE p.class_activity_id = ca.id
  AND p.status = 'completed'
  AND (
    a.type::text NOT IN ('bohr_model_intro', 'bohr_model_stability')
    OR NOT EXISTS (
      SELECT 1 FROM public.student_attempts exploration
      WHERE exploration.progress_id = p.id
        AND exploration.quiz_key IS NULL
        AND exploration.status = 'completed'
    ) AND NOT EXISTS (
      SELECT 1 FROM public.student_attempts quiz
      WHERE quiz.progress_id = p.id
        AND quiz.quiz_key = ANY (ARRAY['bohr_models', 'bohr_model_intro', 'bohr_model_stability'])
        AND quiz.status = 'completed'
        AND quiz.passed
    )
  );

-- Mark the durable exploration fact from the shared attempt lifecycle. This
-- covers explicit exploration completion and the standard/measurement quiz
-- start RPCs, which close an open exploration attempt in the same transaction.
CREATE OR REPLACE FUNCTION public.mark_assignment_exploration_complete()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.quiz_key IS NULL AND NEW.status = 'completed' THEN
    UPDATE public.student_progress p
    SET exploration_completed = true,
        exploration_completed_at = COALESCE(p.exploration_completed_at, NEW.completed_at)
    WHERE p.id = NEW.progress_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_assignment_exploration_complete()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_assignment_exploration_complete()
  TO service_role;

DROP TRIGGER IF EXISTS student_attempts_mark_exploration_complete
  ON public.student_attempts;
CREATE TRIGGER student_attempts_mark_exploration_complete
AFTER INSERT OR UPDATE OF status, completed_at
ON public.student_attempts
FOR EACH ROW
WHEN (NEW.quiz_key IS NULL AND NEW.status = 'completed')
EXECUTE FUNCTION public.mark_assignment_exploration_complete();

-- Quiz passes are assessment evidence; they no longer mutate exploration state.
DROP TRIGGER IF EXISTS student_attempts_sync_bohr_progress
  ON public.student_attempts;
DROP FUNCTION IF EXISTS public.sync_bohr_progress_after_quiz();

-- The return shape is expanded for student reads, so recreate the helper.
DROP FUNCTION public.assignment_progress_state(uuid, text);
CREATE FUNCTION public.assignment_progress_state(
  p_progress_id uuid, p_activity_type text
) RETURNS TABLE (
  status text,
  stage text,
  exploration_completed boolean,
  exploration_completed_at timestamptz,
  passing_attempt_number integer,
  passing_score integer,
  passing_total integer,
  passing_percentage numeric,
  passing_quiz_key text,
  passing_completed_at timestamptz,
  failed_quiz_attempt_count integer,
  completed_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  v_progress public.student_progress%ROWTYPE;
  v_progress_status text;
  v_exploration_completed boolean := false;
  v_quiz_keys text[];
  v_has_latest boolean := false;
  v_latest_completed_at timestamptz;
  v_quiz_open boolean := false;
BEGIN
  IF p_progress_id IS NOT NULL THEN
    SELECT * INTO v_progress
    FROM public.student_progress sp
    WHERE sp.id = p_progress_id;
  END IF;

  v_progress_status := COALESCE(v_progress.status::text, 'not_started');
  v_exploration_completed := COALESCE(v_progress.exploration_completed, false);
  exploration_completed := v_exploration_completed;
  exploration_completed_at := v_progress.exploration_completed_at;

  -- Accept the legacy shared Bohr key and each current per-lesson key.
  v_quiz_keys := CASE p_activity_type
    WHEN 'bohr_model_intro' THEN ARRAY['bohr_models', 'bohr_model_intro']
    WHEN 'bohr_model_stability' THEN ARRAY['bohr_models', 'bohr_model_stability']
    WHEN 'lewis_structures_covalent' THEN ARRAY['lewis_covalent']
    WHEN 'lewis_structures_ionic' THEN ARRAY['lewis_ionic']
    WHEN 'measurement_ruler_tenths' THEN ARRAY['measurement_ruler_tenths']
    WHEN 'measurement_ruler_hundredths' THEN ARRAY['measurement_ruler_hundredths']
    WHEN 'measurement_graduated_cylinder_whole' THEN ARRAY['measurement_cylinder_whole']
    WHEN 'measurement_graduated_cylinder' THEN ARRAY['measurement_cylinder_tenths']
    ELSE ARRAY[]::text[]
  END;

  SELECT sa.attempt_number, sa.score, sa.question_total, sa.percentage,
         sa.quiz_key, sa.completed_at
    INTO passing_attempt_number, passing_score, passing_total,
         passing_percentage, passing_quiz_key, passing_completed_at
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress.id
    AND sa.quiz_key = ANY (v_quiz_keys)
    AND sa.status = 'completed'
    AND sa.passed
  ORDER BY sa.attempt_number ASC, sa.created_at ASC
  LIMIT 1;

  SELECT count(*)::integer INTO failed_quiz_attempt_count
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress.id
    AND sa.quiz_key = ANY (v_quiz_keys)
    AND sa.status = 'completed'
    AND NOT sa.passed
    AND sa.attempt_number < COALESCE(passing_attempt_number, 2147483647);

  SELECT sa.completed_at INTO v_latest_completed_at
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress.id
    AND sa.quiz_key = ANY (v_quiz_keys)
    AND sa.status = 'completed'
  ORDER BY sa.attempt_number DESC, sa.created_at DESC
  LIMIT 1;
  v_has_latest := FOUND;

  v_quiz_open := EXISTS (
      SELECT 1 FROM public.student_attempts sa
      WHERE sa.progress_id = v_progress.id
        AND sa.quiz_key = ANY (v_quiz_keys)
        AND sa.status = 'in_progress'
    )
    OR EXISTS (
      SELECT 1 FROM public.measurement_quiz_sessions ms
      WHERE ms.progress_id = v_progress.id
        AND ms.status = 'in_progress'
    )
    OR (v_progress.quiz_started_at IS NOT NULL
        AND (NOT v_has_latest OR v_latest_completed_at IS NULL
             OR v_progress.quiz_started_at > v_latest_completed_at));

  status := CASE
    WHEN v_exploration_completed
         AND (cardinality(v_quiz_keys) = 0 OR passing_attempt_number IS NOT NULL)
      THEN 'completed'
    WHEN v_progress_status <> 'not_started'
      OR v_exploration_completed
      OR passing_attempt_number IS NOT NULL
      OR v_has_latest
      OR v_quiz_open
      OR v_progress.exploration_started_at IS NOT NULL
      THEN 'in_progress'
    ELSE 'not_started'
  END;

  stage := CASE
    WHEN status = 'completed' THEN 'completed'
    WHEN v_quiz_open THEN 'quiz_in_progress'
    WHEN v_has_latest AND passing_attempt_number IS NULL THEN 'needs_retry'
    WHEN v_exploration_completed THEN 'explored'
    WHEN status <> 'not_started' THEN 'exploring'
    ELSE 'not_started'
  END;

  completed_at := CASE
    WHEN status <> 'completed' THEN NULL
    WHEN cardinality(v_quiz_keys) = 0 THEN v_progress.exploration_completed_at
    WHEN v_progress.exploration_completed_at IS NULL OR passing_completed_at IS NULL
      THEN NULL
    ELSE GREATEST(v_progress.exploration_completed_at, passing_completed_at)
  END;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.assignment_progress_state(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assignment_progress_state(uuid, text)
  TO service_role;

-- This RPC is used only by server-side service clients. It refuses IDs outside
-- the signed-in student's active class and returns one canonical state per ID.
CREATE OR REPLACE FUNCTION public.student_assignment_progress_states(
  p_student_id uuid, p_class_id uuid, p_assignment_ids uuid[]
) RETURNS TABLE (
  assignment_id uuid,
  status text,
  stage text,
  exploration_completed boolean,
  exploration_completed_at timestamptz,
  passing_attempt_number integer,
  passing_score integer,
  passing_total integer,
  passing_percentage numeric,
  passing_quiz_key text,
  passing_completed_at timestamptz,
  failed_quiz_attempt_count integer,
  completed_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_student_id IS NULL OR p_class_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.classes c ON c.id = s.class_id
    WHERE s.id = p_student_id
      AND s.class_id = p_class_id
      AND s.verified
      AND c.is_active
  ) THEN
    RAISE EXCEPTION 'Student assignment state unavailable' USING ERRCODE = '42501';
  END IF;

  IF p_assignment_ids IS NULL OR cardinality(p_assignment_ids) = 0 THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_assignment_ids) requested(assignment_id)
    WHERE requested.assignment_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.class_activities ca
         WHERE ca.id = requested.assignment_id
           AND ca.class_id = p_class_id
           AND ca.archived_at IS NULL
       )
  ) THEN
    RAISE EXCEPTION 'Student assignment state unavailable' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT ca.id, st.status, st.stage, st.exploration_completed,
         st.exploration_completed_at, st.passing_attempt_number,
         st.passing_score, st.passing_total, st.passing_percentage,
         st.passing_quiz_key, st.passing_completed_at,
         st.failed_quiz_attempt_count, st.completed_at
  FROM (
    SELECT DISTINCT requested.assignment_id
    FROM unnest(p_assignment_ids) requested(assignment_id)
  ) requested
  JOIN public.class_activities ca ON ca.id = requested.assignment_id
  JOIN public.activities a ON a.id = ca.activity_id
  LEFT JOIN public.student_progress p
    ON p.student_id = p_student_id AND p.class_activity_id = ca.id
  CROSS JOIN LATERAL public.assignment_progress_state(p.id, a.type::text) st
  WHERE ca.class_id = p_class_id
    AND ca.archived_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.student_assignment_progress_states(uuid, uuid, uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_assignment_progress_states(uuid, uuid, uuid[])
  TO service_role;

-- Preserve teacher report fields while deriving explorationStatus from the
-- durable exploration fact instead of the quiz-mutated legacy status column.
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
        'overallStatus', CASE st.stage
          WHEN 'completed' THEN 'completed'
          WHEN 'quiz_in_progress' THEN 'taking_quiz'
          WHEN 'needs_retry' THEN 'needs_retry'
          WHEN 'not_started' THEN 'not_started'
          ELSE 'exploring'
        END,
        'progressStage', st.stage,
        'explorationStatus', CASE
          WHEN st.exploration_completed THEN 'completed'
          WHEN p.exploration_started_at IS NOT NULL THEN 'in_progress'
          ELSE 'not_started'
        END,
        'explorationDurationSeconds', p.exploration_duration_seconds,
        'passingQuizAttemptNumber', st.passing_attempt_number,
        'passingQuizScore', st.passing_score,
        'passingQuizTotal', st.passing_total,
        'passingQuizPercentage', st.passing_percentage,
        'passingQuizCompletedAt', st.passing_completed_at,
        'failedQuizAttemptCount', st.failed_quiz_attempt_count,
        'completedAt', st.completed_at,
        'stage', CASE st.stage
          WHEN 'completed' THEN 'Completed'
          WHEN 'quiz_in_progress' THEN 'Taking quiz'
          WHEN 'needs_retry' THEN 'Needs retry'
          WHEN 'not_started' THEN 'Not started'
          ELSE 'Exploring'
        END,
        'explorationStartedAt', p.exploration_started_at,
        'firstQuizStartedAt', p.first_quiz_started_at,
        'quizStartedAt', p.quiz_started_at,
        'timeToFirstQuizSeconds', p.exploration_duration_seconds,
        'attempts', history.attempts
      ) ORDER BY s.last_name, s.first_name, s.id)
      FROM public.students s
      LEFT JOIN public.student_progress p
        ON p.student_id = s.id AND p.class_activity_id = ca.id
      CROSS JOIN LATERAL public.assignment_progress_state(p.id, a.type::text) st
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

NOTIFY pgrst, 'reload schema';
COMMIT;
