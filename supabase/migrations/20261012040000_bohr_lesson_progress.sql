-- Bohr lessons gained an assigned exploration (20261010190000), but the
-- teacher's lesson progress still judged them by the Bohr quiz alone, so a
-- finished Bohr exploration showed as "not started".
--
-- A Bohr lesson is now completed when its exploration is finished or the Bohr
-- quiz is passed, and in progress once either has been started. Both Bohr
-- lessons share one quiz, whose attempts are saved against a single
-- assignment, so requiring both (as the Lewis lessons do) would leave the
-- other Bohr lesson unable to complete.
--
-- Unchanged from 20261010000000 apart from the Bohr branch.
BEGIN;

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
            'status', lr.status
          ) ORDER BY lr.order_index, lr.created_at), '[]'::jsonb) AS items,
          CASE WHEN count(*) = 0 THEN 0
            ELSE round(100.0 * count(*) FILTER (WHERE lr.status = 'completed') / count(*))
          END AS overall_percent
        FROM (
          SELECT
            ca.id AS assignment_id, a.id AS activity_id, a.title AS activity_title,
            a.order_index, ca.created_at,
            CASE
              WHEN a.type::text IN ('bohr_model_intro', 'bohr_model_stability') THEN
                CASE
                  WHEN COALESCE(p.status, 'not_started') = 'completed' OR quiz.passed_count > 0
                    THEN 'completed'
                  WHEN COALESCE(p.status, 'not_started') <> 'not_started' OR quiz.attempt_count > 0
                    THEN 'in_progress'
                  ELSE 'not_started'
                END
              WHEN a.type::text IN ('lewis_structures_covalent', 'lewis_structures_ionic') THEN
                CASE
                  WHEN COALESCE(p.status, 'not_started') = 'completed' AND quiz.passed_count > 0
                    THEN 'completed'
                  WHEN COALESCE(p.status, 'not_started') <> 'not_started' OR quiz.attempt_count > 0
                    THEN 'in_progress'
                  ELSE 'not_started'
                END
              ELSE COALESCE(p.status::text, 'not_started')
            END AS status
          FROM public.class_activities ca
          JOIN public.activities a ON a.id = ca.activity_id
          LEFT JOIN public.student_progress p
            ON p.student_id = s.id AND p.class_activity_id = ca.id
          CROSS JOIN LATERAL (
            SELECT
              count(*) AS attempt_count,
              count(*) FILTER (WHERE sa.passed) AS passed_count
            FROM public.student_attempts sa
            WHERE sa.progress_id = p.id
              AND sa.quiz_key = (CASE
                WHEN a.type::text IN ('bohr_model_intro', 'bohr_model_stability') THEN 'bohr_models'
                WHEN a.type::text = 'lewis_structures_covalent' THEN 'lewis_covalent'
                WHEN a.type::text = 'lewis_structures_ionic' THEN 'lewis_ionic'
              END)
          ) quiz
          WHERE ca.class_id = c.id
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

COMMIT;
