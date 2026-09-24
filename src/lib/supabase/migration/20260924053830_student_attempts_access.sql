-- SCRUM-175. classes/teachers intentionally retain their existing RLS state.
BEGIN;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.classes, public.teachers FROM PUBLIC, anon, authenticated;
-- No direct writes to attempt history or its ownership/assignment chain.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.student_attempts, public.student_progress, public.students,
     public.class_activities, public.activities FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.student_attempts TO authenticated;
ALTER TABLE public.student_attempts ENABLE ROW LEVEL SECURITY;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Narrow boolean lookup bypasses only the joined tables' RLS. It always checks
-- the authenticated caller, approved teacher record and verified Auth account.
CREATE FUNCTION private.teacher_can_read_attempt(p_progress_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_progress p
    JOIN public.students s ON s.id = p.student_id
    JOIN public.class_activities ca ON ca.id = p.class_activity_id AND ca.class_id = s.class_id
    JOIN public.classes c ON c.id = ca.class_id
    JOIN public.teachers t ON t.id = c.teacher_id
    JOIN auth.users u ON u.id = t.id
    WHERE p.id = p_progress_id AND t.id = (SELECT auth.uid())
      AND u.email_confirmed_at IS NOT NULL AND NOT COALESCE(u.is_anonymous, false)
  );
$$;
REVOKE ALL ON FUNCTION private.teacher_can_read_attempt(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.teacher_can_read_attempt(uuid) TO authenticated;

CREATE POLICY student_attempts_teacher_read ON public.student_attempts
  FOR SELECT TO authenticated
  USING (private.teacher_can_read_attempt(progress_id));

-- Student identity comes ONLY from the server-verified cookie. This function is
-- inaccessible to browser roles, and runs as its caller (service_role), not owner.
CREATE FUNCTION public.student_attempt_access(
  p_student_id uuid, p_class_id uuid, p_progress_id uuid, p_create boolean DEFAULT false
) RETURNS SETOF public.student_attempts
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  -- Lock ownership rows for this transaction; serialize numbering per progress.
  PERFORM 1 FROM public.student_progress p
    JOIN public.students s ON s.id = p.student_id
    JOIN public.class_activities ca ON ca.id = p.class_activity_id
    JOIN public.classes c ON c.id = ca.class_id
    WHERE p.id = p_progress_id AND s.id = p_student_id
      AND s.class_id = p_class_id AND ca.class_id = p_class_id
      AND s.verified AND c.is_active
    FOR UPDATE OF p FOR SHARE OF s, ca, c;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt access denied' USING ERRCODE = '42501';
  END IF;
  IF p_create THEN
    RETURN QUERY INSERT INTO public.student_attempts(progress_id, attempt_number)
      SELECT p_progress_id, COALESCE(MAX(a.attempt_number), 0) + 1
      FROM public.student_attempts a WHERE a.progress_id = p_progress_id
      RETURNING *;
  ELSE
    RETURN QUERY SELECT a.* FROM public.student_attempts a
      WHERE a.progress_id = p_progress_id ORDER BY a.attempt_number;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.student_attempt_access(uuid, uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_attempt_access(uuid, uuid, uuid, boolean) TO service_role;

COMMIT;
