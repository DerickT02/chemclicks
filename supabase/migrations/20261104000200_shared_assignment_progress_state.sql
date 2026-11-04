-- One definition of where a student is in an assignment, shared by the class
-- progress view (teacher_class_lesson_progress) and the detailed results
-- (teacher_activity_attempt_summary), and mirrored for students by
-- isSectionComplete (src/lib/assignments/sequence.ts).
--
-- status    completion. An assignment with a quiz is completed once that quiz
--           is passed; one without a quiz (the Lewis dot diagram) once its
--           exploration is finished. Before this, Bohr and measurement work
--           counted as completed as soon as exploration was finished, so the
--           teacher's bar jumped from started to 100%.
-- stage     not_started (0%) | exploring, explored (33%) |
--           quiz_in_progress, needs_retry (66%) | completed (100%).
--           A quiz is in progress while a measurement session is open or the
--           saved quiz_started_at is later than the latest submitted result.
-- passing_* the first passing submitted quiz attempt.
-- failed_quiz_attempt_count  submitted failed attempts before that pass.
-- completed_at  when status became completed, from the saved records.
--
-- Every count reads only the student's own progress row for the assignment,
-- so another student's or another lesson's pass never completes this one
-- (see 20261104000100).
--
-- Exploration time is student_progress.exploration_duration_seconds (first
-- exploration start to first quiz start, SCRUM-232) everywhere.
BEGIN;

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
  v_has_latest boolean := false;
  v_latest_completed_at timestamptz;
  v_quiz_open boolean := false;
BEGIN
  IF p_progress_id IS NOT NULL THEN
    SELECT * INTO v_progress FROM public.student_progress sp WHERE sp.id = p_progress_id;
  END IF;
  v_progress_status := COALESCE(v_progress.status::text, 'not_started');

  -- The quiz each activity is graded by. Bohr also accepts the split
  -- per-lesson keys (20261103000000) beside the legacy shared key.
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

  SELECT sa.attempt_number, sa.score, sa.question_total, sa.percentage, sa.completed_at
    INTO passing_attempt_number, passing_score, passing_total, passing_percentage, passing_completed_at
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress.id AND sa.quiz_key = ANY (v_quiz_keys)
    AND sa.status = 'completed' AND sa.passed
  ORDER BY sa.attempt_number ASC
  LIMIT 1;

  SELECT count(*)::integer INTO failed_quiz_attempt_count
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress.id AND sa.quiz_key = ANY (v_quiz_keys)
    AND sa.status = 'completed' AND NOT sa.passed
    AND sa.attempt_number < COALESCE(passing_attempt_number, 2147483647);

  SELECT sa.completed_at INTO v_latest_completed_at
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress.id AND sa.quiz_key = ANY (v_quiz_keys)
    AND sa.status = 'completed'
  ORDER BY sa.attempt_number DESC, sa.created_at DESC
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

-- Same roster, ordering, archive filter and ownership check as 20261104000100;
-- status, stage and the timing/result fields now come from the shared state.
CREATE OR REPLACE FUNCTION public.teacher_class_lesson_progress(
  p_teacher_id uuid, p_class_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'classId', c.id, 'className', c.name,
    'students', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'studentId', s.id, 'firstName', s.first_name, 'lastName', s.last_name,
        'verified', s.verified,
        'lessons', lessons.items,
        'overallPercent', lessons.overall_percent
      ) ORDER BY s.last_name, s.first_name, s.id)
      FROM public.students s
      CROSS JOIN LATERAL (
        SELECT
          COALESCE(jsonb_agg(jsonb_build_object(
            'assignmentId', lr.assignment_id,
            'activityId', lr.activity_id,
            'activityTitle', lr.activity_title,
            'status', lr.status,
            'stage', lr.stage,
            'explorationStartedAt', lr.exploration_started_at,
            'firstQuizStartedAt', lr.first_quiz_started_at,
            'quizStartedAt', lr.quiz_started_at,
            'timeToFirstQuizSeconds', lr.exploration_duration_seconds,
            'passingQuizAttemptNumber', lr.passing_attempt_number,
            'passingQuizScore', lr.passing_score,
            'passingQuizTotal', lr.passing_total,
            'passingQuizPercentage', lr.passing_percentage,
            'failedQuizAttemptCount', lr.failed_quiz_attempt_count,
            'completedAt', lr.completed_at
          ) ORDER BY lr.order_index, lr.created_at), '[]'::jsonb) AS items,
          CASE WHEN count(*) = 0 THEN 0
            ELSE round(100.0 * count(*) FILTER (WHERE lr.status = 'completed') / count(*))
          END AS overall_percent
        FROM (
          SELECT
            ca.id AS assignment_id, a.id AS activity_id, a.title AS activity_title,
            a.order_index, ca.created_at,
            p.exploration_started_at, p.first_quiz_started_at, p.quiz_started_at,
            p.exploration_duration_seconds,
            st.status, st.stage, st.passing_attempt_number, st.passing_score,
            st.passing_total, st.passing_percentage, st.failed_quiz_attempt_count,
            st.completed_at
          FROM public.class_activities ca
          JOIN public.activities a ON a.id = ca.activity_id
          LEFT JOIN public.student_progress p
            ON p.student_id = s.id AND p.class_activity_id = ca.id
          CROSS JOIN LATERAL public.assignment_progress_state(p.id, a.type::text) st
          WHERE ca.class_id = c.id AND ca.archived_at IS NULL
        ) lr
      ) lessons
      WHERE s.class_id = c.id
    ), '[]'::jsonb)
  ) INTO result
  FROM public.classes c
  JOIN public.teachers t ON t.id = c.teacher_id
  WHERE c.id = p_class_id AND t.id = p_teacher_id;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Class progress access denied or unavailable.' USING ERRCODE = '42501';
  END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.teacher_class_lesson_progress(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_class_lesson_progress(uuid, uuid)
  TO service_role;

-- Same keys as 20261026043835 so existing readers keep working, plus
-- progressStage and completedAt. overallStatus, stage, the passing/failed
-- fields and explorationDurationSeconds now come from the shared state, and
-- explorationDurationSeconds is the saved exploration-to-first-quiz interval.
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
