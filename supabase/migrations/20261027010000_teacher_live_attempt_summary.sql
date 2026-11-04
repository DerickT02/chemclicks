-- Lightweight live overview; the legacy full-history RPC remains unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION public.teacher_activity_live_summary(
  p_teacher_id uuid, p_class_id uuid, p_assignment_id uuid,
  p_include_attempts boolean DEFAULT false, p_student_id uuid DEFAULT NULL
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
        'overallStatus', CASE
          WHEN a.type::text IN ('bohr_model_intro', 'bohr_model_stability') THEN
            CASE
              WHEN COALESCE(p.status, 'not_started') = 'completed'
                OR passing_attempt.passing_attempt_number IS NOT NULL THEN 'completed'
              WHEN history.has_open_quiz_attempt
                OR (p.quiz_started_at IS NOT NULL
                    AND (latest_quiz.id IS NULL OR latest_quiz.completed_at IS NULL
                         OR p.quiz_started_at > latest_quiz.completed_at)) THEN 'taking_quiz'
              WHEN failure_calc.failed_count > 0 THEN 'needs_retry'
              WHEN COALESCE(p.status, 'not_started') <> 'not_started' THEN 'exploring'
              ELSE 'not_started'
            END
          WHEN a.type::text IN ('lewis_structures_covalent', 'lewis_structures_ionic') THEN
            CASE
              WHEN COALESCE(p.status, 'not_started') = 'completed'
                AND passing_attempt.passing_attempt_number IS NOT NULL THEN 'completed'
              WHEN history.has_open_quiz_attempt
                OR (p.quiz_started_at IS NOT NULL
                    AND (latest_quiz.id IS NULL OR latest_quiz.completed_at IS NULL
                         OR p.quiz_started_at > latest_quiz.completed_at)) THEN 'taking_quiz'
              WHEN failure_calc.failed_count > 0 THEN 'needs_retry'
              WHEN COALESCE(p.status, 'not_started') <> 'not_started' THEN 'exploring'
              ELSE 'not_started'
            END
          ELSE
            CASE
              WHEN COALESCE(p.status, 'not_started') = 'completed' THEN 'completed'
              WHEN EXISTS (
                SELECT 1 FROM public.measurement_quiz_sessions ms
                WHERE ms.progress_id = p.id AND ms.status = 'in_progress'
              ) OR (p.quiz_started_at IS NOT NULL
                    AND (latest_quiz.id IS NULL OR latest_quiz.completed_at IS NULL
                         OR p.quiz_started_at > latest_quiz.completed_at)) THEN 'taking_quiz'
              WHEN COALESCE(p.status, 'not_started') <> 'not_started' THEN 'exploring'
              ELSE 'not_started'
            END
        END,
        'explorationStatus', COALESCE(p.status::text, 'not_started'),
        'explorationDurationSeconds', CASE
          WHEN p.status = 'completed' AND p.started_at IS NOT NULL AND p.completed_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (p.completed_at - p.started_at))::integer
          ELSE NULL
        END,
        'passingQuizAttemptNumber', passing_attempt.passing_attempt_number,
        'passingQuizScore', passing_attempt.score,
        'passingQuizTotal', passing_attempt.question_total,
        'passingQuizPercentage', passing_attempt.percentage,
        'passingQuizCompletedAt', passing_attempt.completed_at,
        'failedQuizAttemptCount', failure_calc.failed_count,
        'stage', CASE
          WHEN EXISTS (
            SELECT 1 FROM public.measurement_quiz_sessions ms
            WHERE ms.progress_id = p.id AND ms.status = 'in_progress'
          ) THEN 'Taking quiz'
          WHEN p.quiz_started_at IS NOT NULL
               AND (latest_quiz.id IS NULL OR latest_quiz.completed_at IS NULL
                    OR p.quiz_started_at > latest_quiz.completed_at) THEN 'Taking quiz'
          WHEN (a.type::text IN ('bohr_model_intro', 'bohr_model_stability')
                AND (COALESCE(p.status, 'not_started') = 'completed'
                     OR passing_attempt.passing_attempt_number IS NOT NULL))
            OR (a.type::text IN ('lewis_structures_covalent', 'lewis_structures_ionic')
                AND COALESCE(p.status, 'not_started') = 'completed'
                AND passing_attempt.passing_attempt_number IS NOT NULL)
            OR (a.type::text NOT IN (
                  'bohr_model_intro', 'bohr_model_stability',
                  'lewis_structures_covalent', 'lewis_structures_ionic'
                ) AND COALESCE(p.status, 'not_started') = 'completed') THEN 'Completed'
          WHEN latest_quiz.id IS NOT NULL AND latest_quiz.passed IS TRUE THEN 'Completed'
          WHEN latest_quiz.id IS NOT NULL THEN 'Needs retry'
          WHEN p.exploration_started_at IS NOT NULL THEN 'Exploring'
          ELSE 'Not started'
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
      CROSS JOIN LATERAL (
        SELECT count(*) AS attempt_count,
          count(*) FILTER (WHERE sa.quiz_key IS NULL) AS exploration_attempt_count,
          count(*) FILTER (WHERE sa.quiz_key IS NOT NULL) AS quiz_attempt_count,
          count(*) FILTER (WHERE sa.status = 'completed') AS completed_count,
          count(*) FILTER (WHERE sa.status = 'in_progress') AS in_progress_count,
          bool_or(sa.quiz_key IS NOT NULL AND sa.status = 'in_progress') AS has_open_quiz_attempt,
          COALESCE(jsonb_agg(jsonb_build_object(
            'id', sa.id, 'attemptNumber', sa.attempt_number, 'status', sa.status,
            'startedAt', sa.started_at, 'completedAt', sa.completed_at,
            'kind', CASE WHEN sa.quiz_key IS NULL THEN 'exploration' ELSE 'quiz' END,
            'quizKey', sa.quiz_key, 'instrument', sa.instrument,
            'precisionMode', sa.precision_mode, 'score', sa.score,
            'questionTotal', sa.question_total, 'percentage', sa.percentage, 'passed', sa.passed
          ) ORDER BY sa.attempt_number DESC, sa.created_at DESC)
          FILTER (WHERE p_include_attempts), '[]'::jsonb) AS attempts
        FROM public.student_attempts sa WHERE sa.progress_id = p.id
      ) history
      LEFT JOIN LATERAL (
        SELECT sa.attempt_number AS passing_attempt_number, sa.score,
               sa.question_total, sa.percentage, sa.completed_at
        FROM public.student_attempts sa
        WHERE sa.progress_id = p.id AND sa.quiz_key IS NOT NULL
          AND sa.status = 'completed' AND sa.passed
        ORDER BY sa.attempt_number ASC LIMIT 1
      ) passing_attempt ON true
      CROSS JOIN LATERAL (
        SELECT count(*) AS failed_count
        FROM public.student_attempts sa
        WHERE sa.progress_id = p.id AND sa.quiz_key IS NOT NULL
          AND sa.status = 'completed' AND NOT sa.passed
          AND sa.attempt_number < COALESCE(passing_attempt.passing_attempt_number, 2147483647)
      ) failure_calc
      LEFT JOIN LATERAL (
        SELECT sa.id, sa.completed_at, sa.passed
        FROM public.student_attempts sa
        WHERE sa.progress_id = p.id AND sa.quiz_key IS NOT NULL
        ORDER BY sa.attempt_number DESC, sa.created_at DESC LIMIT 1
      ) latest_quiz ON true
      WHERE s.class_id = c.id AND (p_student_id IS NULL OR s.id = p_student_id)
    ), '[]'::jsonb)
  ) INTO result
  FROM public.classes c
  JOIN public.teachers t ON t.id = c.teacher_id
  JOIN public.class_activities ca ON ca.class_id = c.id
  JOIN public.activities a ON a.id = ca.activity_id
  WHERE c.id = p_class_id AND ca.id = p_assignment_id AND t.id = p_teacher_id
    AND c.is_active AND ca.archived_at IS NULL;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Activity summary access denied or unavailable.' USING ERRCODE = '42501';
  END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.teacher_activity_live_summary(uuid, uuid, uuid, boolean, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_activity_live_summary(uuid, uuid, uuid, boolean, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
