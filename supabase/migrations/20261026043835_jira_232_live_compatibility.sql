-- SCRUM-232 follow-up: preserve the merged SCRUM-94 grade summary and repair
-- states and RPC compatibility after the timer migration reached production.
BEGIN;

-- The timer start functions intentionally advance quiz timestamps, but they
-- must not erase a measurement assignment that was already completed through
-- its exploration flow. The measurement quiz is supplemental for these
-- activity types and its completion routine records a quiz result only.
CREATE OR REPLACE FUNCTION public.preserve_completed_progress_on_quiz_start()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF OLD.status = 'completed'
     AND NEW.quiz_started_at IS DISTINCT FROM OLD.quiz_started_at THEN
    NEW.status := OLD.status;
    NEW.completed_at := OLD.completed_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_progress_preserve_completion_on_quiz_start
  ON public.student_progress;
CREATE TRIGGER student_progress_preserve_completion_on_quiz_start
BEFORE UPDATE OF quiz_started_at ON public.student_progress
FOR EACH ROW
EXECUTE FUNCTION public.preserve_completed_progress_on_quiz_start();

-- Repair measurement rows affected by the already-applied timer migration.
-- A strict timestamp comparison excludes exploration attempts that the timer
-- start itself closed at quiz_started_at.
WITH completed_explorations AS (
  SELECT p.id AS progress_id, max(sa.completed_at) AS completed_at
  FROM public.student_progress p
  JOIN public.student_attempts sa ON sa.progress_id = p.id
  WHERE sa.quiz_key IS NULL
    AND sa.status = 'completed'
    AND p.quiz_started_at IS NOT NULL
    AND sa.completed_at < p.quiz_started_at
  GROUP BY p.id
)
UPDATE public.student_progress p
SET status = 'completed', completed_at = completed_explorations.completed_at
FROM completed_explorations
JOIN public.student_progress source_progress
  ON source_progress.id = completed_explorations.progress_id
JOIN public.class_activities ca ON ca.id = source_progress.class_activity_id
JOIN public.activities a ON a.id = ca.activity_id
WHERE p.id = completed_explorations.progress_id
  AND p.status = 'in_progress'
  AND a.type::text IN (
    'measurement_ruler_tenths',
    'measurement_ruler_hundredths',
    'measurement_graduated_cylinder_whole',
    'measurement_graduated_cylinder'
  );

-- Keep the exact timer-bound function for current clients and restore the
-- legacy six-argument RPC used by the dev app. The wrapper obtains the active
-- start timestamp while holding the same progress lock, then delegates all
-- grading, authorization, validation and idempotency checks to the canonical
-- implementation. Timer-aware callers should continue passing the timestamp.
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
  v_quiz_started_at timestamptz;
BEGIN
  SELECT p.quiz_started_at INTO v_quiz_started_at
  FROM public.student_progress p
  WHERE p.student_id = p_student_id
    AND p.class_activity_id = p_assignment_id
  FOR UPDATE;

  IF NOT FOUND OR v_quiz_started_at IS NULL THEN
    RAISE EXCEPTION 'Quiz has not been started' USING ERRCODE = '42501';
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

REVOKE ALL ON FUNCTION public.student_quiz_submit(uuid, uuid, uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_quiz_submit(uuid, uuid, uuid, text, text, jsonb)
  TO service_role;

-- Restore #138's per-student grade summary while retaining #139's timer and
-- current-stage values under distinct JSON keys.
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
        'overallStatus', CASE
          WHEN a.type::text IN ('bohr_model_intro', 'bohr_model_stability') THEN
            CASE
              WHEN COALESCE(p.status, 'not_started') = 'completed'
                OR passing_attempt.passing_attempt_number IS NOT NULL THEN 'completed'
              WHEN history.has_open_quiz_attempt
                OR (p.quiz_started_at IS NOT NULL
                    AND (latest_quiz.id IS NULL OR latest_quiz.completed_at IS NULL
                         OR p.quiz_started_at > latest_quiz.completed_at))
                THEN 'taking_quiz'
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
                         OR p.quiz_started_at > latest_quiz.completed_at))
                THEN 'taking_quiz'
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
                         OR p.quiz_started_at > latest_quiz.completed_at))
                THEN 'taking_quiz'
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
                    OR p.quiz_started_at > latest_quiz.completed_at)
            THEN 'Taking quiz'
          WHEN (a.type::text IN ('bohr_model_intro', 'bohr_model_stability')
                AND (COALESCE(p.status, 'not_started') = 'completed'
                     OR passing_attempt.passing_attempt_number IS NOT NULL))
            OR (a.type::text IN ('lewis_structures_covalent', 'lewis_structures_ionic')
                AND COALESCE(p.status, 'not_started') = 'completed'
                AND passing_attempt.passing_attempt_number IS NOT NULL)
            OR (a.type::text NOT IN (
                  'bohr_model_intro', 'bohr_model_stability',
                  'lewis_structures_covalent', 'lewis_structures_ionic'
                ) AND COALESCE(p.status, 'not_started') = 'completed')
            THEN 'Completed'
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

NOTIFY pgrst, 'reload schema';
COMMIT;
