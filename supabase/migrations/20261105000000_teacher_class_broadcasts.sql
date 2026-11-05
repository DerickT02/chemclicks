-- Private invalidation hints only: never broadcast student/account/quiz rows.
-- Apply only to a separately approved project after auditing realtime.messages policies.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.teacher_can_receive_class_updates(p_topic text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.teachers t ON t.id = c.teacher_id
    JOIN auth.users u ON u.id = t.id
    WHERE c.teacher_id = (SELECT auth.uid()) AND c.is_active
      AND p_topic = 'teacher-class:' || c.id::text
      AND u.email_confirmed_at IS NOT NULL AND NOT COALESCE(u.is_anonymous, false)
      AND NOT EXISTS (
        SELECT 1 FROM public.students s WHERE s.auth_user_id = u.id
      )
  );
$$;
REVOKE ALL ON FUNCTION private.teacher_can_receive_class_updates(text) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.teacher_can_receive_class_updates(text) TO authenticated;

-- Realtime owns this table and already enables RLS. Do not ALTER its ownership/RLS.
-- The restrictive policy also prevents a pre-existing broad permissive policy
-- from granting other users access to our reserved topic namespace.
CREATE POLICY chemclicks_class_updates_receive ON realtime.messages
FOR SELECT TO authenticated
USING (
  extension = 'broadcast' AND topic = (SELECT realtime.topic())
  AND private.teacher_can_receive_class_updates((SELECT realtime.topic()))
);
CREATE POLICY chemclicks_class_updates_isolate ON realtime.messages
AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  (topic NOT LIKE 'teacher-class:%'
   AND COALESCE((SELECT realtime.topic()), '') NOT LIKE 'teacher-class:%')
  OR (extension = 'broadcast' AND topic = (SELECT realtime.topic())
      AND private.teacher_can_receive_class_updates((SELECT realtime.topic())))
);
CREATE POLICY chemclicks_class_updates_no_anon_receive ON realtime.messages
AS RESTRICTIVE FOR SELECT TO anon
USING (topic NOT LIKE 'teacher-class:%'
       AND COALESCE((SELECT realtime.topic()), '') NOT LIKE 'teacher-class:%');
-- Only trusted database triggers publish these hints; clients cannot spoof them.
CREATE POLICY chemclicks_class_updates_no_client_send ON realtime.messages
AS RESTRICTIVE FOR INSERT TO anon, authenticated
WITH CHECK (topic NOT LIKE 'teacher-class:%'
            AND COALESCE((SELECT realtime.topic()), '') NOT LIKE 'teacher-class:%');

CREATE OR REPLACE FUNCTION private.broadcast_teacher_class_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  row_data jsonb;
  class_id uuid;
  assignment_id uuid;
  change_kind text;
  seen text[] := ARRAY[]::text[];
  hint_key text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NULL; END IF;
  -- Invalidate both classes/assignments when a record is moved. Deduplicate the
  -- usual UPDATE where its class/assignment did not change.
  FOR row_data IN SELECT value FROM jsonb_array_elements(
    CASE TG_OP
      WHEN 'INSERT' THEN jsonb_build_array(to_jsonb(NEW))
      WHEN 'DELETE' THEN jsonb_build_array(to_jsonb(OLD))
      ELSE jsonb_build_array(to_jsonb(OLD), to_jsonb(NEW))
    END
  ) LOOP
    class_id := NULL;
    assignment_id := NULL;
    change_kind := 'progress';
    IF TG_TABLE_NAME = 'students' THEN
      class_id := (row_data->>'class_id')::uuid;
      change_kind := 'roster';
    ELSIF TG_TABLE_NAME = 'classes' THEN
      class_id := (row_data->>'id')::uuid;
      change_kind := 'roster';
    ELSIF TG_TABLE_NAME = 'class_activities' THEN
      class_id := (row_data->>'class_id')::uuid;
      assignment_id := (row_data->>'id')::uuid;
    ELSIF TG_TABLE_NAME = 'student_progress' THEN
      assignment_id := (row_data->>'class_activity_id')::uuid;
      SELECT ca.class_id INTO class_id FROM public.class_activities ca WHERE ca.id = assignment_id;
    ELSE
      SELECT ca.class_id, ca.id INTO class_id, assignment_id
      FROM public.student_progress p
      JOIN public.class_activities ca ON ca.id = p.class_activity_id
      WHERE p.id = (row_data->>'progress_id')::uuid;
    END IF;
    hint_key := class_id::text || ':' || change_kind || ':' || COALESCE(assignment_id::text, 'all');
    IF class_id IS NOT NULL AND NOT (hint_key = ANY(seen)) THEN
      PERFORM realtime.send(
        jsonb_build_object('kind', change_kind, 'assignmentId', assignment_id),
        'changed', 'teacher-class:' || class_id::text, true
      );
      seen := array_append(seen, hint_key);
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.broadcast_teacher_class_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER chemclicks_students_broadcast AFTER INSERT OR UPDATE OR DELETE ON public.students
FOR EACH ROW EXECUTE FUNCTION private.broadcast_teacher_class_change();
CREATE TRIGGER chemclicks_progress_broadcast AFTER INSERT OR UPDATE OR DELETE ON public.student_progress
FOR EACH ROW EXECUTE FUNCTION private.broadcast_teacher_class_change();
CREATE TRIGGER chemclicks_attempts_broadcast AFTER INSERT OR UPDATE OR DELETE ON public.student_attempts
FOR EACH ROW EXECUTE FUNCTION private.broadcast_teacher_class_change();
CREATE TRIGGER chemclicks_measurement_sessions_broadcast AFTER INSERT OR UPDATE OR DELETE ON public.measurement_quiz_sessions
FOR EACH ROW EXECUTE FUNCTION private.broadcast_teacher_class_change();
CREATE TRIGGER chemclicks_assignments_broadcast AFTER INSERT OR UPDATE OR DELETE ON public.class_activities
FOR EACH ROW EXECUTE FUNCTION private.broadcast_teacher_class_change();
CREATE TRIGGER chemclicks_classes_broadcast AFTER UPDATE OR DELETE ON public.classes
FOR EACH ROW EXECUTE FUNCTION private.broadcast_teacher_class_change();

COMMIT;
