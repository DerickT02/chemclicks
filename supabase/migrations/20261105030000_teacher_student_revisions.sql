-- Track latest changed student per class, not an ever-growing per-event log.
-- The class row lock makes revisions commit-ordered: a slow older transaction
-- cannot commit behind a cursor that a reader has already observed.
BEGIN;
CREATE TABLE private.teacher_class_versions (
  class_id uuid PRIMARY KEY REFERENCES public.classes(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0,
  reset_revision bigint NOT NULL DEFAULT 0
);
CREATE TABLE private.teacher_changed_students (
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL, -- deliberately no student FK: retain deletion tombstones
  revision bigint NOT NULL,
  PRIMARY KEY (class_id, student_id)
);
CREATE INDEX teacher_changed_students_revision_idx ON private.teacher_changed_students(class_id, revision);
ALTER TABLE private.teacher_class_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.teacher_changed_students ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.teacher_class_versions, private.teacher_changed_students FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT ON private.teacher_class_versions, private.teacher_changed_students TO service_role;

CREATE OR REPLACE FUNCTION private.record_teacher_class_change(
  p_class_id uuid, p_student_id uuid, p_kind text, p_assignment_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  versions jsonb := COALESCE(NULLIF(current_setting('chemclicks.teacher_revisions', true), ''), '{}')::jsonb;
  students_seen jsonb := COALESCE(NULLIF(current_setting('chemclicks.teacher_students', true), ''), '[]')::jsonb;
  hints_seen jsonb := COALESCE(NULLIF(current_setting('chemclicks.teacher_broadcasts', true), ''), '[]')::jsonb;
  v_revision bigint;
  student_key text;
  hint_key text;
BEGIN
  -- Cascading class deletion must not reinsert an already-deleted parent.
  IF p_class_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id) THEN RETURN; END IF;
  v_revision := (versions->>p_class_id::text)::bigint;
  IF v_revision IS NULL THEN
    INSERT INTO private.teacher_class_versions(class_id, revision) VALUES(p_class_id, 1)
    ON CONFLICT (class_id) DO UPDATE SET revision = private.teacher_class_versions.revision + 1
    RETURNING revision INTO v_revision;
    versions := versions || jsonb_build_object(p_class_id::text, v_revision::text);
    PERFORM set_config('chemclicks.teacher_revisions', versions::text, true);
  END IF;
  IF p_student_id IS NULL THEN
    UPDATE private.teacher_class_versions SET reset_revision = v_revision
      WHERE class_id = p_class_id AND reset_revision < v_revision;
    -- Assignment-wide resyncs also discard old tombstones. Any client that
    -- predates this cleanup is explicitly sent a full replacement snapshot.
    DELETE FROM private.teacher_changed_students WHERE class_id = p_class_id AND revision < v_revision;
  ELSE
    student_key := p_class_id::text || ':' || p_student_id::text;
    IF NOT (students_seen ? student_key) THEN
      INSERT INTO private.teacher_changed_students(class_id, student_id, revision)
      VALUES(p_class_id, p_student_id, v_revision)
      ON CONFLICT (class_id, student_id) DO UPDATE SET revision = EXCLUDED.revision;
      students_seen := students_seen || to_jsonb(student_key);
      PERFORM set_config('chemclicks.teacher_students', students_seen::text, true);
    END IF;
  END IF;
  hint_key := p_class_id::text || ':' || p_kind || ':' || COALESCE(p_assignment_id::text, 'all');
  IF NOT (hints_seen ? hint_key) THEN
    hints_seen := hints_seen || to_jsonb(hint_key);
    PERFORM set_config('chemclicks.teacher_broadcasts', hints_seen::text, true);
    PERFORM realtime.send(jsonb_build_object('kind', p_kind, 'assignmentId', p_assignment_id),
      'changed', 'teacher-class:' || p_class_id::text, true);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.record_teacher_class_change(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.broadcast_teacher_class_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  row_data jsonb;
  v_class_id uuid;
  v_student_id uuid;
  v_assignment_id uuid;
  change_kind text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NULL; END IF;
  IF TG_TABLE_NAME = 'activities' THEN
    -- Catalog changes affect every assigned student's labels/completion rules.
    FOR v_class_id IN SELECT DISTINCT ca.class_id FROM public.class_activities ca WHERE ca.activity_id = NEW.id ORDER BY ca.class_id LOOP
      PERFORM private.record_teacher_class_change(v_class_id, NULL, 'progress', NULL);
    END LOOP;
    RETURN NULL;
  END IF;
  FOR row_data IN SELECT value FROM jsonb_array_elements(
    CASE TG_OP WHEN 'INSERT' THEN jsonb_build_array(to_jsonb(NEW))
      WHEN 'DELETE' THEN jsonb_build_array(to_jsonb(OLD))
      ELSE jsonb_build_array(to_jsonb(OLD), to_jsonb(NEW)) END
  ) ORDER BY value->>'class_id' LOOP
    v_class_id := NULL;
    v_student_id := NULL;
    v_assignment_id := NULL;
    change_kind := 'progress';
    IF TG_TABLE_NAME = 'students' THEN
      v_class_id := (row_data->>'class_id')::uuid;
      v_student_id := (row_data->>'id')::uuid;
      change_kind := 'roster';
    ELSIF TG_TABLE_NAME = 'classes' THEN
      v_class_id := (row_data->>'id')::uuid;
      change_kind := 'roster';
    ELSIF TG_TABLE_NAME = 'class_activities' THEN
      v_class_id := (row_data->>'class_id')::uuid;
      v_assignment_id := (row_data->>'id')::uuid;
    ELSIF TG_TABLE_NAME = 'student_progress' THEN
      v_student_id := (row_data->>'student_id')::uuid;
      v_assignment_id := (row_data->>'class_activity_id')::uuid;
      SELECT ca.class_id INTO v_class_id FROM public.class_activities ca WHERE ca.id = v_assignment_id;
    ELSE
      SELECT ca.class_id, ca.id, p.student_id INTO v_class_id, v_assignment_id, v_student_id
      FROM public.student_progress p JOIN public.class_activities ca ON ca.id = p.class_activity_id
      WHERE p.id = (row_data->>'progress_id')::uuid;
    END IF;
    PERFORM private.record_teacher_class_change(v_class_id, v_student_id, change_kind, v_assignment_id);
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.broadcast_teacher_class_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER chemclicks_catalog_broadcast AFTER UPDATE OF title, type, order_index ON public.activities
FOR EACH ROW EXECUTE FUNCTION private.broadcast_teacher_class_change();
COMMIT;
