-- SCRUM-94: give the teacher's per-assignment attempt roster a single
-- unified status per student, exploration duration, and the specific quiz
-- attempt that completed the lab, instead of leaving the teacher to read a
-- flat attempt-history table to work all of that out.
--
-- teacher_activity_attempt_summary is already scoped to one assignment (one
-- class_activity_id), so unlike teacher_class_lesson_progress it does not
-- need to disambiguate attempts by quiz_key: every quiz attempt under this
-- assignment's progress_id already belongs to this assignment's quiz.
--
-- overallStatus precedence (most to least specific):
--   completed   - the SCRUM-233 completion policy for this activity type is
--                 satisfied (reuses the same per-type rule as
--                 teacher_class_lesson_progress: Bohr is exploration OR a
--                 passed quiz since both Bohr lessons share one quiz;
--                 Lewis requires both; everything else, including
--                 measurement, is exploration-only).
--   taking_quiz - a quiz attempt is currently in_progress. This is what
--                 makes a successful quiz start visible to the teacher
--                 before the student submits, since student_quiz_start
--                 writes that in_progress row immediately.
--   needs_retry - at least one completed quiz attempt exists and none has
--                 passed yet.
--   exploring   - the exploration side has started (student_progress.status
--                 is not 'not_started').
--   not_started - none of the above.
--
-- explorationDurationSeconds is only populated once the exploration attempt
-- is completed; an in-progress exploration reports explorationStatus
-- 'in_progress' with a null duration rather than measuring against now().
--
-- The passing quiz attempt is the earliest completed+passed attempt by
-- attempt_number. failedQuizAttemptCount only counts completed, not-passed
-- attempts that happened before that attempt_number (or all of them, if the
-- student has not passed yet), so a retry taken after completion does not
-- inflate the count that described how the lab was actually finished.
--
-- Unchanged from 20261009023628 apart from the added per-student fields.
BEGIN;

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
        'attempts', history.attempts,
        'overallStatus', CASE
          WHEN a.type::text IN ('bohr_model_intro', 'bohr_model_stability') THEN
            CASE
              WHEN COALESCE(p.status, 'not_started') = 'completed'
                OR passing_attempt.passing_attempt_number IS NOT NULL THEN 'completed'
              WHEN history.has_open_quiz_attempt THEN 'taking_quiz'
              WHEN failure_calc.failed_count > 0 THEN 'needs_retry'
              WHEN COALESCE(p.status, 'not_started') <> 'not_started' THEN 'exploring'
              ELSE 'not_started'
            END
          WHEN a.type::text IN ('lewis_structures_covalent', 'lewis_structures_ionic') THEN
            CASE
              WHEN COALESCE(p.status, 'not_started') = 'completed'
                AND passing_attempt.passing_attempt_number IS NOT NULL THEN 'completed'
              WHEN history.has_open_quiz_attempt THEN 'taking_quiz'
              WHEN failure_calc.failed_count > 0 THEN 'needs_retry'
              WHEN COALESCE(p.status, 'not_started') <> 'not_started' THEN 'exploring'
              ELSE 'not_started'
            END
          ELSE
            CASE
              WHEN COALESCE(p.status, 'not_started') = 'completed' THEN 'completed'
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
        'failedQuizAttemptCount', failure_calc.failed_count
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

COMMIT;
