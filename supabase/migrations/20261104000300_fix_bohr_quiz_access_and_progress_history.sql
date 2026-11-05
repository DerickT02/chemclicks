-- Forward-only repair after the split Bohr quizzes and shared progress state.
-- Do not apply automatically: review and deploy separately from the app cleanup.
-- No stored questions, attempts, or progress rows are changed.
BEGIN;

-- The split pools contain correct_index too. They must have the same browser
-- restriction as the legacy Bohr and Lewis pools; questions are loaded by the
-- server only after assignment access has been checked.
DROP POLICY IF EXISTS "chemclicks_quiz_questions_select_active"
  ON public.quiz_questions;

CREATE POLICY "chemclicks_quiz_questions_select_active"
  ON public.quiz_questions
  FOR SELECT TO authenticated
  USING (is_active AND quiz_key NOT IN (
    'bohr_models', 'bohr_model_intro', 'bohr_model_stability',
    'lewis_bonding', 'lewis_covalent', 'lewis_ionic'
  ));

COMMENT ON POLICY "chemclicks_quiz_questions_select_active"
  ON public.quiz_questions IS
  'Authenticated users may read active questions except assignment-gated Bohr (legacy and split) and Lewis pools. Those questions are loaded by the server after an assignment check.';

-- attempt_number is scoped to (progress_id, quiz_key), not to the assignment.
-- Compare submitted results by completion time across accepted quiz keys.
-- created_at and id break timestamp ties consistently for pass selection and
-- failure counts. Return the original per-key attempt number for the history UI.
-- A result with no recorded completion time never counts as the latest one
-- (Postgres sorts NULLs first under DESC), so it cannot hold a quiz open.
CREATE OR REPLACE FUNCTION public.assignment_progress_state(
  p_progress_id uuid, p_activity_type text
) RETURNS TABLE (
  status text,
  stage text,
  passing_attempt_number integer,
  passing_score integer,
  passing_total integer,
  passing_percentage numeric,
  passing_completed_at timestamptz,
  failed_quiz_attempt_count integer,
  completed_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  v_progress public.student_progress%ROWTYPE;
  v_progress_status text;
  v_quiz_keys text[];
  v_passing_id uuid;
  v_passing_created_at timestamptz;
  v_has_latest boolean := false;
  v_latest_completed_at timestamptz;
  v_quiz_open boolean := false;
BEGIN
  IF p_progress_id IS NOT NULL THEN
    SELECT * INTO v_progress FROM public.student_progress sp WHERE sp.id = p_progress_id;
  END IF;
  v_progress_status := COALESCE(v_progress.status::text, 'not_started');

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
         sa.completed_at, sa.created_at, sa.id
    INTO passing_attempt_number, passing_score, passing_total, passing_percentage,
         passing_completed_at, v_passing_created_at, v_passing_id
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress.id AND sa.quiz_key = ANY (v_quiz_keys)
    AND sa.status = 'completed' AND sa.passed
  ORDER BY sa.completed_at ASC NULLS LAST, sa.created_at ASC, sa.id ASC
  LIMIT 1;

  SELECT count(*)::integer INTO failed_quiz_attempt_count
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress.id AND sa.quiz_key = ANY (v_quiz_keys)
    AND sa.status = 'completed' AND NOT sa.passed
    AND (v_passing_id IS NULL
      OR (sa.completed_at, sa.created_at, sa.id)
         < (passing_completed_at, v_passing_created_at, v_passing_id));

  SELECT sa.completed_at INTO v_latest_completed_at
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress.id AND sa.quiz_key = ANY (v_quiz_keys)
    AND sa.status = 'completed'
  ORDER BY sa.completed_at DESC NULLS LAST, sa.created_at DESC, sa.id DESC
  LIMIT 1;
  v_has_latest := FOUND;

  v_quiz_open := EXISTS (
      SELECT 1 FROM public.student_attempts sa
      WHERE sa.progress_id = v_progress.id AND sa.quiz_key = ANY (v_quiz_keys)
        AND sa.status = 'in_progress'
    )
    OR EXISTS (
      SELECT 1 FROM public.measurement_quiz_sessions ms
      WHERE ms.progress_id = v_progress.id AND ms.status = 'in_progress'
    )
    OR (v_progress.quiz_started_at IS NOT NULL
        AND (NOT v_has_latest OR v_latest_completed_at IS NULL
             OR v_progress.quiz_started_at > v_latest_completed_at));

  status := CASE
    WHEN cardinality(v_quiz_keys) = 0 THEN v_progress_status
    WHEN passing_attempt_number IS NOT NULL THEN 'completed'
    WHEN v_progress_status <> 'not_started' OR v_has_latest OR v_quiz_open
      OR v_progress.exploration_started_at IS NOT NULL THEN 'in_progress'
    ELSE 'not_started'
  END;

  stage := CASE
    WHEN status = 'completed' THEN 'completed'
    WHEN v_quiz_open THEN 'quiz_in_progress'
    WHEN v_has_latest THEN 'needs_retry'
    WHEN v_progress_status = 'completed' THEN 'explored'
    WHEN status <> 'not_started' THEN 'exploring'
    ELSE 'not_started'
  END;

  completed_at := CASE
    WHEN status <> 'completed' THEN NULL
    WHEN cardinality(v_quiz_keys) = 0 THEN v_progress.completed_at
    ELSE passing_completed_at
  END;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.assignment_progress_state(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assignment_progress_state(uuid, text)
  TO service_role;

-- Preserve the report's keys, ownership checks and attempt counts. Only the
-- history ordering changes: newest start first across exploration and quizzes,
-- regardless of their independent attempt-number sequences. Attempts with no
-- recorded start time are listed last.
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
        'explorationStatus', COALESCE(p.status::text, 'not_started'),
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
          ) ORDER BY sa.started_at DESC NULLS LAST, sa.created_at DESC, sa.id DESC), '[]'::jsonb) AS attempts
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
