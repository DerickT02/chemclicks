-- Lightweight live attempt summaries built on the shared assignment state
-- (20261104000200). Requires that migration first.
--
-- One private definition builds every per-activity report:
--   teacher_activity_attempt_summary  full histories (unchanged output)
--   teacher_activity_live_summary     no histories unless one student is asked
--                                     for, and only for an active class and an
--                                     unarchived assignment
--   teacher_class_updates             changed students only (20261105040000)
-- Sharing it keeps stage, grade and timer rules identical across all three.
BEGIN;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION private.teacher_attempt_rows(
  p_teacher_id uuid, p_class_id uuid, p_assignment_id uuid,
  p_include_attempts boolean, p_student_ids uuid[], p_require_active boolean
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
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
          -- Overview reads skip building history JSON entirely.
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
          -- Newest start first across exploration and quizzes, whose attempt
          -- numbers are independent sequences (20261104000300).
          ) ORDER BY sa.started_at DESC NULLS LAST, sa.created_at DESC, sa.id DESC)
          FILTER (WHERE p_include_attempts), '[]'::jsonb) AS attempts
        FROM public.student_attempts sa WHERE sa.progress_id = p.id
      ) history
      WHERE s.class_id = c.id AND (p_student_ids IS NULL OR s.id = ANY(p_student_ids))
    ), '[]'::jsonb)
  ) INTO result
  FROM public.classes c
  JOIN public.teachers t ON t.id = c.teacher_id
  JOIN public.class_activities ca ON ca.class_id = c.id
  JOIN public.activities a ON a.id = ca.activity_id
  WHERE c.id = p_class_id AND ca.id = p_assignment_id AND t.id = p_teacher_id
    AND (NOT p_require_active OR (c.is_active AND ca.archived_at IS NULL));

  IF result IS NULL THEN
    RAISE EXCEPTION 'Activity summary access denied or unavailable.' USING ERRCODE = '42501';
  END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION private.teacher_attempt_rows(uuid, uuid, uuid, boolean, uuid[], boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.teacher_attempt_rows(uuid, uuid, uuid, boolean, uuid[], boolean)
  TO service_role;

-- Same output, ownership check, history order and (absent) active/archive
-- filter as 20261104000300; only the definition moved.
CREATE OR REPLACE FUNCTION public.teacher_activity_attempt_summary(
  p_teacher_id uuid, p_class_id uuid, p_assignment_id uuid
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.teacher_attempt_rows(p_teacher_id, p_class_id, p_assignment_id, true, NULL, false);
$$;
REVOKE ALL ON FUNCTION public.teacher_activity_attempt_summary(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_activity_attempt_summary(uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.teacher_activity_live_summary(
  p_teacher_id uuid, p_class_id uuid, p_assignment_id uuid,
  p_include_attempts boolean DEFAULT false, p_student_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.teacher_attempt_rows(p_teacher_id, p_class_id, p_assignment_id, p_include_attempts,
    CASE WHEN p_student_id IS NULL THEN NULL::uuid[] ELSE ARRAY[p_student_id] END, true);
$$;
REVOKE ALL ON FUNCTION public.teacher_activity_live_summary(uuid, uuid, uuid, boolean, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_activity_live_summary(uuid, uuid, uuid, boolean, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
