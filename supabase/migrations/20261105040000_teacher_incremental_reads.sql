-- Combined roster/progress reads use a revision cursor and calculate only the
-- changed students. Helpers are private and executable only by trusted server code.
-- Requires 20261104000200 (shared assignment state) and 20261105010000
-- (private.teacher_attempt_rows).
BEGIN;
-- Lesson rows for the class progress view. Status, stage and the timing/result
-- facts come from the shared assignment state, as in 20261104000200.
CREATE OR REPLACE FUNCTION private.teacher_lesson_progress_rows(p_class_id uuid, p_student_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'studentId', s.id, 'firstName', s.first_name, 'lastName', s.last_name,
    'verified', s.verified,
    'lessons', lessons.items,
    'overallPercent', lessons.overall_percent
  ) ORDER BY s.last_name, s.first_name, s.id), '[]'::jsonb)
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
      WHERE ca.class_id = p_class_id AND ca.archived_at IS NULL
    ) lr
  ) lessons
  WHERE s.class_id = p_class_id AND (p_student_ids IS NULL OR s.id = ANY(p_student_ids));
$$;
REVOKE ALL ON FUNCTION private.teacher_lesson_progress_rows(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.teacher_lesson_progress_rows(uuid, uuid[]) TO service_role;

-- Same output and ownership check as 20261104000200; the rows now come from the
-- helper the incremental reads use, so both views always apply the same rules.
CREATE OR REPLACE FUNCTION public.teacher_class_lesson_progress(
  p_teacher_id uuid, p_class_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'classId', c.id, 'className', c.name,
    'students', private.teacher_lesson_progress_rows(c.id, NULL)
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

CREATE OR REPLACE FUNCTION public.teacher_class_updates(
  p_teacher_id uuid, p_class_id uuid, p_after bigint DEFAULT NULL, p_assignment_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  -- One statement, one MVCC snapshot across revision, membership and payloads.
  WITH owned AS MATERIALIZED (
    SELECT c.id, c.name, COALESCE(v.revision, 0) AS revision,
      (p_after IS NULL OR p_after > COALESCE(v.revision, 0)
       OR p_after < COALESCE(v.reset_revision, 0)) AS reset
    FROM public.classes c LEFT JOIN private.teacher_class_versions v ON v.class_id = c.id
    WHERE c.id = p_class_id AND c.teacher_id = p_teacher_id AND c.is_active
      AND (p_assignment_id IS NULL OR EXISTS (
        SELECT 1 FROM public.class_activities ca WHERE ca.id = p_assignment_id
          AND ca.class_id = c.id AND ca.archived_at IS NULL
      ))
  ), scoped AS MATERIALIZED (
    SELECT owned.*, CASE WHEN owned.reset THEN NULL::uuid[] ELSE COALESCE((
      SELECT array_agg(j.student_id) FROM private.teacher_changed_students j
      WHERE j.class_id = owned.id AND j.revision > p_after
    ), ARRAY[]::uuid[]) END AS student_ids FROM owned
  )
  SELECT jsonb_build_object(
    'classId', scoped.id, 'revision', scoped.revision::text, 'reset', scoped.reset,
    'removedStudentIds', COALESCE((
      SELECT jsonb_agg(changed.student_id) FROM unnest(scoped.student_ids) AS changed(student_id)
      WHERE NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = changed.student_id AND s.class_id = scoped.id)
    ), '[]'::jsonb),
    'roster', CASE WHEN p_assignment_id IS NULL AND (scoped.reset OR cardinality(scoped.student_ids) > 0) THEN (
      SELECT jsonb_build_object(
        'pending', COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'first_name', s.first_name,
          'last_name', s.last_name, 'student_id', s.student_id, 'verified', s.verified)
          ORDER BY s.last_name, s.first_name, s.id) FILTER (WHERE s.verified IS NOT TRUE), '[]'::jsonb),
        'active', COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'first_name', s.first_name,
          'last_name', s.last_name, 'student_id', s.student_id, 'verified', s.verified)
          ORDER BY s.last_name, s.first_name, s.id) FILTER (WHERE s.verified IS TRUE), '[]'::jsonb)
      ) FROM public.students s WHERE s.class_id = scoped.id
        AND (scoped.student_ids IS NULL OR s.id = ANY(scoped.student_ids))
    ) ELSE NULL END,
    'progress', CASE WHEN p_assignment_id IS NULL AND (scoped.reset OR cardinality(scoped.student_ids) > 0) THEN
      jsonb_build_object('classId', scoped.id, 'className', scoped.name,
        'students', private.teacher_lesson_progress_rows(scoped.id, scoped.student_ids)) ELSE NULL END,
    'attempts', CASE WHEN p_assignment_id IS NOT NULL AND (scoped.reset OR cardinality(scoped.student_ids) > 0) THEN
      private.teacher_attempt_rows(p_teacher_id, scoped.id, p_assignment_id, false, scoped.student_ids, true) ELSE NULL END
  ) INTO result FROM scoped;
  IF result IS NULL THEN RAISE EXCEPTION 'Class updates access denied or unavailable.' USING ERRCODE = '42501'; END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.teacher_class_updates(uuid, uuid, bigint, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_class_updates(uuid, uuid, bigint, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
