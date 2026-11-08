-- Free-plan safeguard: one hint per class/resource/assignment per transaction,
-- not per changed row. Database broadcasts are delivered after commit, so one
-- hint still tells readers to fetch the transaction's final committed state.
BEGIN;
CREATE OR REPLACE FUNCTION private.broadcast_teacher_class_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  row_data jsonb;
  class_id uuid;
  assignment_id uuid;
  change_kind text;
  seen jsonb := COALESCE(NULLIF(current_setting('chemclicks.teacher_broadcasts', true), ''), '[]')::jsonb;
  hint_key text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NULL; END IF;
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
    IF class_id IS NOT NULL AND NOT (seen ? hint_key) THEN
      -- Transaction-local state rolls back with a savepoint/transaction and is
      -- reset at commit. It cannot suppress hints in a later transaction.
      seen := seen || to_jsonb(hint_key);
      PERFORM set_config('chemclicks.teacher_broadcasts', seen::text, true);
      PERFORM realtime.send(
        jsonb_build_object('kind', change_kind, 'assignmentId', assignment_id),
        'changed', 'teacher-class:' || class_id::text, true
      );
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.broadcast_teacher_class_change() FROM PUBLIC, anon, authenticated;
COMMIT;
