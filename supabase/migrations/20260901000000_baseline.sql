


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."activity_type" AS ENUM (
    'bohr_model_intro',
    'bohr_model_stability',
    'lewis_diagram',
    'lewis_structures_covalent',
    'lewis_structures_ionic',
    'measurement_ruler_tenths',
    'measurement_ruler_hundredths',
    'measurement_graduated_cylinder'
);


ALTER TYPE "public"."activity_type" OWNER TO "postgres";


CREATE TYPE "public"."progress_status" AS ENUM (
    'not_started',
    'in_progress',
    'completed'
);


ALTER TYPE "public"."progress_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."broadcast_teacher_class_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."broadcast_teacher_class_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."record_teacher_class_change"("p_class_id" "uuid", "p_student_id" "uuid", "p_kind" "text", "p_assignment_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."record_teacher_class_change"("p_class_id" "uuid", "p_student_id" "uuid", "p_kind" "text", "p_assignment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."teacher_attempt_rows"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_include_attempts" boolean, "p_student_ids" "uuid"[], "p_require_active" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."teacher_attempt_rows"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_include_attempts" boolean, "p_student_ids" "uuid"[], "p_require_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."teacher_can_read_attempt"("p_progress_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
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


ALTER FUNCTION "private"."teacher_can_read_attempt"("p_progress_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."teacher_can_receive_class_updates"("p_topic" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."teacher_can_receive_class_updates"("p_topic" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."teacher_lesson_progress_rows"("p_class_id" "uuid", "p_student_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."teacher_lesson_progress_rows"("p_class_id" "uuid", "p_student_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assignment_progress_state"("p_progress_id" "uuid", "p_activity_type" "text") RETURNS TABLE("status" "text", "stage" "text", "exploration_completed" boolean, "exploration_completed_at" timestamp with time zone, "passing_attempt_number" integer, "passing_score" integer, "passing_total" integer, "passing_percentage" numeric, "passing_quiz_key" "text", "passing_completed_at" timestamp with time zone, "failed_quiz_attempt_count" integer, "completed_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
#variable_conflict use_column
DECLARE
  v_progress public.student_progress%ROWTYPE;
  v_progress_status text;
  v_exploration_completed boolean := false;
  v_quiz_keys text[];
  v_has_latest boolean := false;
  v_latest_completed_at timestamptz;
  v_quiz_open boolean := false;
BEGIN
  IF p_progress_id IS NOT NULL THEN
    SELECT * INTO v_progress
    FROM public.student_progress sp
    WHERE sp.id = p_progress_id;
  END IF;

  v_progress_status := COALESCE(v_progress.status::text, 'not_started');
  v_exploration_completed := COALESCE(v_progress.exploration_completed, false);
  exploration_completed := v_exploration_completed;
  exploration_completed_at := v_progress.exploration_completed_at;

  -- Accept the legacy shared Bohr key and each current per-lesson key.
  v_quiz_keys := CASE p_activity_type
    WHEN 'bohr_model_intro' THEN ARRAY['bohr_models', 'bohr_model_intro']
    WHEN 'bohr_model_stability' THEN ARRAY['bohr_models', 'bohr_model_stability']
    WHEN 'lewis_structures_covalent' THEN ARRAY['lewis_covalent']
    WHEN 'lewis_structures_ionic' THEN ARRAY['lewis_ionic']
    WHEN 'lewis_diagram' THEN ARRAY['lewis_diagram']
    WHEN 'measurement_ruler_tenths' THEN ARRAY['measurement_ruler_tenths']
    WHEN 'measurement_ruler_hundredths' THEN ARRAY['measurement_ruler_hundredths']
    WHEN 'measurement_graduated_cylinder_whole' THEN ARRAY['measurement_cylinder_whole']
    WHEN 'measurement_graduated_cylinder' THEN ARRAY['measurement_cylinder_tenths']
    ELSE ARRAY[]::text[]
  END;

  SELECT sa.attempt_number, sa.score, sa.question_total, sa.percentage,
         sa.quiz_key, sa.completed_at
    INTO passing_attempt_number, passing_score, passing_total,
         passing_percentage, passing_quiz_key, passing_completed_at
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress.id
    AND sa.quiz_key = ANY (v_quiz_keys)
    AND sa.status = 'completed'
    AND sa.passed
  ORDER BY sa.attempt_number ASC, sa.created_at ASC
  LIMIT 1;

  SELECT count(*)::integer INTO failed_quiz_attempt_count
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress.id
    AND sa.quiz_key = ANY (v_quiz_keys)
    AND sa.status = 'completed'
    AND NOT sa.passed
    AND sa.attempt_number < COALESCE(passing_attempt_number, 2147483647);

  SELECT sa.completed_at INTO v_latest_completed_at
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress.id
    AND sa.quiz_key = ANY (v_quiz_keys)
    AND sa.status = 'completed'
  ORDER BY sa.attempt_number DESC, sa.created_at DESC
  LIMIT 1;
  v_has_latest := FOUND;

  v_quiz_open := EXISTS (
      SELECT 1 FROM public.student_attempts sa
      WHERE sa.progress_id = v_progress.id
        AND sa.quiz_key = ANY (v_quiz_keys)
        AND sa.status = 'in_progress'
    )
    OR EXISTS (
      SELECT 1 FROM public.measurement_quiz_sessions ms
      WHERE ms.progress_id = v_progress.id
        AND ms.status = 'in_progress'
    )
    OR (v_progress.quiz_started_at IS NOT NULL
        AND (NOT v_has_latest OR v_latest_completed_at IS NULL
             OR v_progress.quiz_started_at > v_latest_completed_at));

  status := CASE
    WHEN v_exploration_completed
         AND (cardinality(v_quiz_keys) = 0 OR passing_attempt_number IS NOT NULL)
      THEN 'completed'
    WHEN v_progress_status <> 'not_started'
      OR v_exploration_completed
      OR passing_attempt_number IS NOT NULL
      OR v_has_latest
      OR v_quiz_open
      OR v_progress.exploration_started_at IS NOT NULL
      THEN 'in_progress'
    ELSE 'not_started'
  END;

  stage := CASE
    WHEN status = 'completed' THEN 'completed'
    WHEN v_quiz_open THEN 'quiz_in_progress'
    WHEN v_has_latest AND passing_attempt_number IS NULL THEN 'needs_retry'
    WHEN v_exploration_completed THEN 'explored'
    WHEN status <> 'not_started' THEN 'exploring'
    ELSE 'not_started'
  END;

  completed_at := CASE
    WHEN status <> 'completed' THEN NULL
    WHEN cardinality(v_quiz_keys) = 0 THEN v_progress.exploration_completed_at
    WHEN v_progress.exploration_completed_at IS NULL OR passing_completed_at IS NULL
      THEN NULL
    ELSE GREATEST(v_progress.exploration_completed_at, passing_completed_at)
  END;

  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."assignment_progress_state"("p_progress_id" "uuid", "p_activity_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assignment_progress_state"("p_progress_id" "uuid", "p_activity_type" "text") IS 'Shared assignment status and stage. Quizzed lessons, including the Lewis dot diagram since SCRUM-234, complete once their exploration is finished and their own quiz is passed.';



CREATE OR REPLACE FUNCTION "public"."handle_new_teacher"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  chosen_display_name text;
BEGIN
  chosen_display_name := nullif(trim(NEW.raw_user_meta_data->>'display_name'), '');

  INSERT INTO public.teachers (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    coalesce(chosen_display_name, split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_teacher"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_assignment_exploration_complete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.quiz_key IS NULL AND NEW.status = 'completed' THEN
    UPDATE public.student_progress p
    SET exploration_completed = true,
        exploration_completed_at = COALESCE(p.exploration_completed_at, NEW.completed_at)
    WHERE p.id = NEW.progress_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."mark_assignment_exploration_complete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preserve_completed_progress_on_quiz_start"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF OLD.status = 'completed'
     AND NEW.quiz_started_at IS DISTINCT FROM OLD.quiz_started_at THEN
    NEW.status := OLD.status;
    NEW.completed_at := OLD.completed_at;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."preserve_completed_progress_on_quiz_start"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."student_assignment_progress_states"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_ids" "uuid"[]) RETURNS TABLE("assignment_id" "uuid", "status" "text", "stage" "text", "exploration_completed" boolean, "exploration_completed_at" timestamp with time zone, "passing_attempt_number" integer, "passing_score" integer, "passing_total" integer, "passing_percentage" numeric, "passing_quiz_key" "text", "passing_completed_at" timestamp with time zone, "failed_quiz_attempt_count" integer, "completed_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
  IF p_student_id IS NULL OR p_class_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.classes c ON c.id = s.class_id
    WHERE s.id = p_student_id
      AND s.class_id = p_class_id
      AND s.verified
      AND c.is_active
  ) THEN
    RAISE EXCEPTION 'Student assignment state unavailable' USING ERRCODE = '42501';
  END IF;

  IF p_assignment_ids IS NULL OR cardinality(p_assignment_ids) = 0 THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_assignment_ids) requested(assignment_id)
    WHERE requested.assignment_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.class_activities ca
         WHERE ca.id = requested.assignment_id
           AND ca.class_id = p_class_id
           AND ca.archived_at IS NULL
       )
  ) THEN
    RAISE EXCEPTION 'Student assignment state unavailable' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT ca.id, st.status, st.stage, st.exploration_completed,
         st.exploration_completed_at, st.passing_attempt_number,
         st.passing_score, st.passing_total, st.passing_percentage,
         st.passing_quiz_key, st.passing_completed_at,
         st.failed_quiz_attempt_count, st.completed_at
  FROM (
    SELECT DISTINCT requested.assignment_id
    FROM unnest(p_assignment_ids) requested(assignment_id)
  ) requested
  JOIN public.class_activities ca ON ca.id = requested.assignment_id
  JOIN public.activities a ON a.id = ca.activity_id
  LEFT JOIN public.student_progress p
    ON p.student_id = p_student_id AND p.class_activity_id = ca.id
  CROSS JOIN LATERAL public.assignment_progress_state(p.id, a.type::text) st
  WHERE ca.class_id = p_class_id
    AND ca.archived_at IS NULL;
END;
$$;


ALTER FUNCTION "public"."student_assignment_progress_states"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_ids" "uuid"[]) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."student_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "progress_id" "uuid" NOT NULL,
    "attempt_number" integer NOT NULL,
    "score" numeric(5,2),
    "passed" boolean,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "quiz_key" "text",
    "question_total" integer,
    "percentage" numeric(5,2),
    "submission_key" "text",
    "instrument" "text",
    "precision_mode" "text",
    CONSTRAINT "student_attempts_completion_state" CHECK (((("status" = 'in_progress'::"text") AND ("completed_at" IS NULL)) OR (("status" = 'completed'::"text") AND ("completed_at" IS NOT NULL)))),
    CONSTRAINT "student_attempts_measurement_mode_consistent" CHECK (((("quiz_key" IS NULL) AND ("instrument" IS NULL) AND ("precision_mode" IS NULL)) OR (("quiz_key" = ANY (ARRAY['measurement_ruler_tenths'::"text", 'measurement_ruler_hundredths'::"text"])) AND ("instrument" = 'ruler'::"text") AND ("precision_mode" =
CASE "quiz_key"
    WHEN 'measurement_ruler_tenths'::"text" THEN 'tenths'::"text"
    ELSE 'hundredths'::"text"
END)) OR (("quiz_key" = ANY (ARRAY['measurement_cylinder_whole'::"text", 'measurement_cylinder_tenths'::"text"])) AND ("instrument" = 'cylinder'::"text") AND ("precision_mode" =
CASE "quiz_key"
    WHEN 'measurement_cylinder_whole'::"text" THEN 'whole'::"text"
    ELSE 'tenths'::"text"
END)) OR (("quiz_key" <> ALL (ARRAY['measurement_ruler_tenths'::"text", 'measurement_ruler_hundredths'::"text", 'measurement_cylinder_whole'::"text", 'measurement_cylinder_tenths'::"text"])) AND ("instrument" IS NULL) AND ("precision_mode" IS NULL)))),
    CONSTRAINT "student_attempts_positive_number" CHECK (("attempt_number" > 0)),
    CONSTRAINT "student_attempts_quiz_key_format" CHECK ((("quiz_key" IS NULL) OR ("quiz_key" ~ '^[a-z0-9_]+$'::"text"))),
    CONSTRAINT "student_attempts_quiz_metadata_consistent" CHECK ((("quiz_key" IS NULL) OR (("question_total" IS NOT NULL) AND ("question_total" > 0) AND ("score" IS NOT NULL) AND ("score" >= (0)::numeric) AND ("score" <= ("question_total")::numeric) AND ("percentage" IS NOT NULL) AND ("percentage" >= (0)::numeric) AND ("percentage" <= (100)::numeric) AND ("percentage" = "round"((("score" * 100.0) / ("question_total")::numeric), 2)) AND ("passed" IS NOT NULL) AND ("passed" = ("percentage" >= (80)::numeric))))),
    CONSTRAINT "student_attempts_submission_key_not_blank" CHECK ((("submission_key" IS NULL) OR ("length"("btrim"("submission_key")) > 0))),
    CONSTRAINT "student_attempts_submission_requires_quiz" CHECK ((("submission_key" IS NULL) OR ("quiz_key" IS NOT NULL))),
    CONSTRAINT "student_attempts_timestamp_order" CHECK ((("completed_at" IS NULL) OR ("completed_at" >= "started_at"))),
    CONSTRAINT "student_attempts_valid_status" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."student_attempts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."student_attempts"."quiz_key" IS 'NULL for exploration attempts; stable quiz identity for quiz attempts.';



COMMENT ON COLUMN "public"."student_attempts"."submission_key" IS 'Server-validated idempotency key for a quiz submission.';



CREATE OR REPLACE FUNCTION "public"."student_attempt_access"("p_student_id" "uuid", "p_class_id" "uuid", "p_progress_id" "uuid", "p_create" boolean DEFAULT false) RETURNS SETOF "public"."student_attempts"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE assignment uuid;
BEGIN
  SELECT p.class_activity_id INTO assignment FROM public.student_progress p
    JOIN public.students s ON s.id=p.student_id
    JOIN public.class_activities ca ON ca.id=p.class_activity_id
    JOIN public.classes c ON c.id=ca.class_id
    WHERE p.id=p_progress_id AND s.id=p_student_id
      AND s.class_id=p_class_id AND ca.class_id=p_class_id AND s.verified AND c.is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt access denied' USING ERRCODE='42501'; END IF;
  IF p_create THEN
    RETURN QUERY SELECT * FROM public.student_attempt_transition(p_student_id,p_class_id,assignment,'start',NULL);
  ELSE
    RETURN QUERY SELECT a.* FROM public.student_attempts a
      WHERE a.progress_id=p_progress_id ORDER BY a.attempt_number;
  END IF;
END;
$$;


ALTER FUNCTION "public"."student_attempt_access"("p_student_id" "uuid", "p_class_id" "uuid", "p_progress_id" "uuid", "p_create" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."student_attempt_transition"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_action" "text", "p_attempt_id" "uuid" DEFAULT NULL::"uuid") RETURNS SETOF "public"."student_attempts"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  progress uuid;
  latest public.student_attempts%ROWTYPE;
  requested public.student_attempts%ROWTYPE;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('start','complete','retry') THEN
    RAISE EXCEPTION 'Invalid attempt action' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.class_activities ca
    JOIN public.classes c ON c.id = ca.class_id
    JOIN public.students s ON s.class_id = c.id
    JOIN public.activities a ON a.id = ca.activity_id
    WHERE ca.id = p_assignment_id AND c.id = p_class_id
      AND s.id = p_student_id AND s.verified AND c.is_active
      AND ca.archived_at IS NULL
      AND (ca.opens_at IS NULL OR ca.opens_at <= now())
      AND (ca.closes_at IS NULL OR ca.closes_at > now())
      AND a.type::text IN (
        'bohr_model_intro',
        'bohr_model_stability',
        'lewis_diagram',
        'lewis_structures_ionic',
        'lewis_structures_covalent',
        'measurement_ruler_tenths',
        'measurement_ruler_hundredths',
        'measurement_graduated_cylinder_whole',
        'measurement_graduated_cylinder'
      )
    FOR SHARE OF ca, c, s, a;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment unavailable' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.student_progress(student_id, class_activity_id)
    VALUES (p_student_id, p_assignment_id)
    ON CONFLICT (student_id, class_activity_id) DO NOTHING;

  SELECT id INTO progress FROM public.student_progress
    WHERE student_id = p_student_id AND class_activity_id = p_assignment_id
    FOR UPDATE;

  SELECT * INTO latest FROM public.student_attempts
    WHERE progress_id = progress AND quiz_key IS NULL
    ORDER BY attempt_number DESC LIMIT 1;

  IF p_action = 'start' THEN
    IF latest.id IS NOT NULL THEN RETURN NEXT latest; RETURN; END IF;
  ELSE
    SELECT * INTO requested FROM public.student_attempts
      WHERE id = p_attempt_id AND progress_id = progress AND quiz_key IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Attempt unavailable' USING ERRCODE = '42501';
    END IF;

    IF p_action = 'complete' THEN
      IF requested.status = 'completed' THEN RETURN NEXT requested; RETURN; END IF;
      IF requested.id <> latest.id THEN
        RAISE EXCEPTION 'Stale attempt' USING ERRCODE = '22023';
      END IF;
      UPDATE public.student_attempts
        SET status = 'completed', completed_at = clock_timestamp()
        WHERE id = requested.id RETURNING * INTO requested;
      UPDATE public.student_progress
        SET status = 'completed', completed_at = requested.completed_at
        WHERE id = progress;
      RETURN NEXT requested; RETURN;
    END IF;

    IF requested.status <> 'completed' THEN
      RAISE EXCEPTION 'Finish this attempt before retrying' USING ERRCODE = '22023';
    END IF;
    IF latest.id <> requested.id THEN RETURN NEXT latest; RETURN; END IF;
  END IF;

  INSERT INTO public.student_attempts(progress_id, attempt_number)
    VALUES (progress, COALESCE(latest.attempt_number, 0) + 1)
    RETURNING * INTO latest;

  UPDATE public.student_progress p
    SET status = 'in_progress',
        started_at = COALESCE(p.started_at, latest.started_at),
        completed_at = NULL,
        exploration_started_at = CASE
          WHEN p.exploration_started_at IS NOT NULL THEN p.exploration_started_at
          WHEN p.first_quiz_started_at IS NOT NULL OR p.quiz_started_at IS NOT NULL THEN NULL
          WHEN EXISTS (
            SELECT 1 FROM public.student_attempts sa
            WHERE sa.progress_id = progress AND sa.quiz_key IS NOT NULL
          ) THEN NULL
          WHEN EXISTS (
            SELECT 1 FROM public.measurement_quiz_sessions ms
            WHERE ms.progress_id = progress
          ) THEN NULL
          ELSE latest.started_at
        END
    WHERE p.id = progress;

  RETURN NEXT latest;
END;
$$;


ALTER FUNCTION "public"."student_attempt_transition"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_action" "text", "p_attempt_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."student_attempts_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."student_attempts_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."student_measurement_quiz_complete"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_attempt_id" "uuid") RETURNS SETOF "public"."student_attempts"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_session public.measurement_quiz_sessions%ROWTYPE;
  v_quiz_key text;
  v_instrument text;
  v_precision_mode text;
  v_total integer;
  v_score integer;
  v_percentage numeric(5, 2);
  v_passed boolean;
  v_completed_at timestamptz := clock_timestamp();
  v_attempt public.student_attempts%ROWTYPE;
BEGIN
  SELECT ms.* INTO v_session
  FROM public.measurement_quiz_sessions ms
  JOIN public.student_progress p ON p.id = ms.progress_id
  WHERE ms.id = p_attempt_id
    AND p.student_id = p_student_id
    AND p.class_activity_id = p_assignment_id
  FOR UPDATE OF ms;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Measurement attempt unavailable' USING ERRCODE = '42501';
  END IF;

  IF v_session.status = 'completed' THEN
    RETURN QUERY SELECT * FROM public.student_attempts
      WHERE id = v_session.result_attempt_id;
    RETURN;
  END IF;

  PERFORM 1
  FROM public.student_progress p
  JOIN public.class_activities ca ON ca.id = p.class_activity_id
  JOIN public.classes c ON c.id = ca.class_id
  JOIN public.students s ON s.id = p.student_id
  JOIN public.activities a ON a.id = ca.activity_id
  WHERE p.id = v_session.progress_id AND p.student_id = p_student_id
    AND ca.id = p_assignment_id AND c.id = p_class_id AND s.class_id = c.id
    AND s.verified AND c.is_active
    AND ca.archived_at IS NULL
    AND (ca.opens_at IS NULL OR ca.opens_at <= now())
    AND (ca.closes_at IS NULL OR ca.closes_at > now())
    AND a.type::text = (CASE v_session.mode
      WHEN 'ruler_tenths' THEN 'measurement_ruler_tenths'
      WHEN 'ruler_hundredths' THEN 'measurement_ruler_hundredths'
      WHEN 'cylinder_whole' THEN 'measurement_graduated_cylinder_whole'
      WHEN 'cylinder_tenths' THEN 'measurement_graduated_cylinder'
    END)
  FOR SHARE OF ca, c, s, a;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Measurement quiz assignment unavailable' USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::integer,
         count(*) FILTER (WHERE is_correct)::integer
    INTO v_total, v_score
  FROM public.measurement_quiz_session_questions
  WHERE session_id = v_session.id;
  IF v_total <> 5 THEN
    RAISE EXCEPTION 'Measurement attempt is incomplete' USING ERRCODE = '22023';
  END IF;

  v_percentage := round(v_score * 100.0 / v_total, 2);
  v_passed := v_percentage >= 80;
  v_quiz_key := 'measurement_' || v_session.mode;
  v_instrument := CASE WHEN v_session.mode LIKE 'ruler_%' THEN 'ruler' ELSE 'cylinder' END;
  v_precision_mode := CASE v_session.mode
    WHEN 'ruler_hundredths' THEN 'hundredths'
    WHEN 'cylinder_whole' THEN 'whole'
    ELSE 'tenths'
  END;

  INSERT INTO public.student_attempts(
    progress_id, attempt_number, quiz_key, question_total, score, percentage,
    passed, submission_key, status, started_at, completed_at,
    instrument, precision_mode
  ) VALUES (
    v_session.progress_id, v_session.attempt_number, v_quiz_key, v_total, v_score,
    v_percentage, v_passed, v_session.id::text, 'completed',
    v_session.started_at, v_completed_at, v_instrument, v_precision_mode
  ) RETURNING * INTO v_attempt;

  UPDATE public.measurement_quiz_sessions
    SET status = 'completed', completed_at = v_completed_at,
        result_attempt_id = v_attempt.id
    WHERE id = v_session.id;

  RETURN NEXT v_attempt;
END;
$$;


ALTER FUNCTION "public"."student_measurement_quiz_complete"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_attempt_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."student_measurement_quiz_record_answer"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_attempt_id" "uuid", "p_question_index" integer, "p_answer" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
DECLARE
  v_session public.measurement_quiz_sessions%ROWTYPE;
  v_mode text;
  v_reading numeric;
  v_existing_answer text;
  v_existing_correct boolean;
  v_gradable boolean := false;
  v_answer numeric;
  v_decimals integer;
  v_precision integer;
  v_tolerance numeric;
  v_scale numeric;
  v_is_correct boolean;
  v_counted boolean := false;
  v_first_try_correct boolean;
BEGIN
  SELECT ms.* INTO v_session
  FROM public.measurement_quiz_sessions ms
  JOIN public.student_progress p ON p.id = ms.progress_id
  WHERE ms.id = p_attempt_id
    AND p.student_id = p_student_id
    AND p.class_activity_id = p_assignment_id
  FOR UPDATE OF ms;
  IF NOT FOUND OR v_session.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Measurement attempt unavailable' USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.student_progress p
  JOIN public.class_activities ca ON ca.id = p.class_activity_id
  JOIN public.classes c ON c.id = ca.class_id
  JOIN public.students s ON s.id = p.student_id
  JOIN public.activities a ON a.id = ca.activity_id
  WHERE p.id = v_session.progress_id AND p.student_id = p_student_id
    AND ca.id = p_assignment_id AND c.id = p_class_id AND s.class_id = c.id
    AND s.verified AND c.is_active
    AND ca.archived_at IS NULL
    AND (ca.opens_at IS NULL OR ca.opens_at <= now())
    AND (ca.closes_at IS NULL OR ca.closes_at > now())
    AND a.type::text = (CASE v_session.mode
      WHEN 'ruler_tenths' THEN 'measurement_ruler_tenths'
      WHEN 'ruler_hundredths' THEN 'measurement_ruler_hundredths'
      WHEN 'cylinder_whole' THEN 'measurement_graduated_cylinder_whole'
      WHEN 'cylinder_tenths' THEN 'measurement_graduated_cylinder'
    END)
  FOR SHARE OF ca, c, s, a;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Measurement quiz assignment unavailable' USING ERRCODE = '42501';
  END IF;

  SELECT q.reading, q.first_answer, q.is_correct
    INTO v_reading, v_existing_answer, v_existing_correct
  FROM public.measurement_quiz_session_questions q
  WHERE q.session_id = v_session.id AND q.question_index = p_question_index
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Measurement question unavailable' USING ERRCODE = '22023';
  END IF;

  v_mode := v_session.mode;
  v_decimals := CASE v_mode
    WHEN 'ruler_hundredths' THEN 2
    WHEN 'cylinder_whole' THEN 0
    ELSE 1
  END;
  v_precision := CASE v_mode
    WHEN 'ruler_hundredths' THEN 100
    WHEN 'cylinder_whole' THEN 1
    ELSE 10
  END;
  v_tolerance := CASE v_mode
    WHEN 'ruler_hundredths' THEN 0.02
    WHEN 'ruler_tenths' THEN 0.2
    WHEN 'cylinder_whole' THEN 2
    WHEN 'cylinder_tenths' THEN 0.2
  END;
  v_scale := v_precision;

  IF p_answer IS NOT NULL AND length(p_answer) <= 64
     AND p_answer ~ '^[+-]?([0-9]+([.][0-9]+)?|[.][0-9]+)$' THEN
    v_answer := p_answer::numeric;
    IF v_answer >= 0 AND v_answer <= (CASE
        WHEN v_mode LIKE 'cylinder_%' THEN 50
        ELSE 10
      END) THEN
      v_gradable := true;
      v_is_correct := length(split_part(p_answer, '.', 2)) = v_decimals
        AND abs(round(v_answer * v_scale) - round(v_reading * v_scale))
          <= round(v_tolerance * v_scale);
    END IF;
  END IF;

  IF v_existing_answer IS NULL AND v_gradable THEN
    UPDATE public.measurement_quiz_session_questions
      SET first_answer = p_answer,
          is_correct = v_is_correct,
          answered_at = clock_timestamp()
      WHERE session_id = v_session.id AND question_index = p_question_index;
    v_counted := true;
    v_first_try_correct := v_is_correct;
  ELSE
    v_first_try_correct := v_existing_correct;
  END IF;

  RETURN jsonb_build_object(
    'mode', v_mode,
    'reading', v_reading,
    'counted', v_counted,
    'first_try_correct', v_first_try_correct
  );
END;
$_$;


ALTER FUNCTION "public"."student_measurement_quiz_record_answer"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_attempt_id" "uuid", "p_question_index" integer, "p_answer" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."student_measurement_quiz_start"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_mode" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_progress public.student_progress%ROWTYPE;
  v_activity_type text;
  v_quiz_key text;
  v_session public.measurement_quiz_sessions%ROWTYPE;
  v_attempt_number integer;
  v_expected_questions integer := 5;
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN (
    'ruler_tenths', 'ruler_hundredths', 'cylinder_whole', 'cylinder_tenths'
  ) THEN
    RAISE EXCEPTION 'Invalid measurement quiz mode' USING ERRCODE = '22023';
  END IF;

  v_quiz_key := 'measurement_' || p_mode;
  SELECT a.type::text INTO v_activity_type
  FROM public.class_activities ca
  JOIN public.classes c ON c.id = ca.class_id
  JOIN public.students s ON s.class_id = c.id
  JOIN public.activities a ON a.id = ca.activity_id
  WHERE ca.id = p_assignment_id AND c.id = p_class_id
    AND s.id = p_student_id AND s.verified AND c.is_active
    AND ca.archived_at IS NULL
    AND (ca.opens_at IS NULL OR ca.opens_at <= now())
    AND (ca.closes_at IS NULL OR ca.closes_at > now())
  FOR SHARE OF ca, c, s, a;

  IF NOT FOUND OR v_activity_type IS DISTINCT FROM (CASE p_mode
      WHEN 'ruler_tenths' THEN 'measurement_ruler_tenths'
      WHEN 'ruler_hundredths' THEN 'measurement_ruler_hundredths'
      WHEN 'cylinder_whole' THEN 'measurement_graduated_cylinder_whole'
      WHEN 'cylinder_tenths' THEN 'measurement_graduated_cylinder'
    END) THEN
    RAISE EXCEPTION 'Measurement quiz assignment unavailable' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.student_progress(student_id, class_activity_id)
    VALUES (p_student_id, p_assignment_id)
    ON CONFLICT (student_id, class_activity_id) DO NOTHING;
  SELECT * INTO v_progress FROM public.student_progress
    WHERE student_id = p_student_id AND class_activity_id = p_assignment_id
    FOR UPDATE;

  SELECT * INTO v_session FROM public.measurement_quiz_sessions
    WHERE progress_id = v_progress.id AND mode = p_mode AND status = 'in_progress'
    FOR UPDATE;

  IF NOT FOUND THEN
    SELECT COALESCE(max(attempt_number), 0) + 1 INTO v_attempt_number
    FROM (
      SELECT ms.attempt_number FROM public.measurement_quiz_sessions ms
        WHERE ms.progress_id = v_progress.id AND ms.mode = p_mode
      UNION ALL
      SELECT sa.attempt_number FROM public.student_attempts sa
        WHERE sa.progress_id = v_progress.id AND sa.quiz_key = v_quiz_key
    ) attempts;

    INSERT INTO public.measurement_quiz_sessions(progress_id, mode, attempt_number)
      VALUES (v_progress.id, p_mode, v_attempt_number)
      RETURNING * INTO v_session;

    INSERT INTO public.measurement_quiz_session_questions(
      session_id, question_index, question_key, reading
    )
    SELECT v_session.id,
      row_number() OVER (ORDER BY selected.random_order)::integer - 1,
      selected.question_key,
      selected.reading
    FROM (
      SELECT question_key, reading, random() AS random_order
      FROM public.measurement_quiz_readings
      WHERE mode = p_mode
      ORDER BY random_order
      LIMIT v_expected_questions
    ) selected;

    IF (SELECT count(*) FROM public.measurement_quiz_session_questions
        WHERE session_id = v_session.id) <> v_expected_questions THEN
      RAISE EXCEPTION 'Measurement quiz question pool is incomplete' USING ERRCODE = '22023';
    END IF;

    UPDATE public.student_progress p
      SET status = 'in_progress',
          started_at = COALESCE(p.started_at, v_session.started_at),
          completed_at = NULL,
          quiz_started_at = v_session.started_at,
          first_quiz_started_at = CASE
            WHEN p.first_quiz_started_at IS NULL AND v_attempt_number = 1
              THEN v_session.started_at
            ELSE p.first_quiz_started_at
          END,
          exploration_duration_seconds = CASE
            WHEN p.exploration_duration_seconds IS NOT NULL THEN p.exploration_duration_seconds
            WHEN p.exploration_started_at IS NOT NULL
                 AND p.first_quiz_started_at IS NULL
                 AND v_attempt_number = 1
              THEN greatest(
                0::bigint,
                floor(extract(epoch FROM (
                  v_session.started_at - p.exploration_started_at
                )))::bigint
              )
            ELSE p.exploration_duration_seconds
          END
      WHERE p.id = v_progress.id;

    UPDATE public.student_attempts
      SET status = 'completed', completed_at = v_session.started_at
      WHERE progress_id = v_progress.id
        AND quiz_key IS NULL
        AND status = 'in_progress'
        AND started_at <= v_session.started_at;
  END IF;

  RETURN jsonb_build_object(
    'attempt_id', v_session.id,
    'attempt_number', v_session.attempt_number,
    'mode', v_session.mode,
    'questions', (
      SELECT jsonb_agg(jsonb_build_object(
        'question_index', q.question_index,
        'reading', q.reading,
        'first_answer', q.first_answer,
        'is_correct', q.is_correct
      ) ORDER BY q.question_index)
      FROM public.measurement_quiz_session_questions q
      WHERE q.session_id = v_session.id
    )
  );
END;
$$;


ALTER FUNCTION "public"."student_measurement_quiz_start"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."student_quiz_retry_start"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_quiz_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
DECLARE
  v_progress public.student_progress%ROWTYPE;
  v_latest_completed_at timestamptz;
  v_started_at timestamptz;
BEGIN
  IF p_quiz_key IS NULL OR p_quiz_key !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Invalid quiz retry' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.class_activities ca
  JOIN public.classes c ON c.id = ca.class_id
  JOIN public.students s ON s.class_id = c.id
  JOIN public.activities a ON a.id = ca.activity_id
  WHERE ca.id = p_assignment_id
    AND c.id = p_class_id
    AND s.id = p_student_id
    AND s.verified
    AND c.is_active
    AND ca.archived_at IS NULL
    AND (ca.opens_at IS NULL OR ca.opens_at <= now())
    AND (ca.closes_at IS NULL OR ca.closes_at > now())
    AND (
      ((((((((((((p_quiz_key = 'bohr_models' AND a.type::text IN ('bohr_model_intro', 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability'))
      OR (p_quiz_key = 'lewis_covalent' AND a.type::text = 'lewis_structures_covalent')
      OR (p_quiz_key = 'lewis_ionic' AND a.type::text = 'lewis_structures_ionic') OR (p_quiz_key = 'lewis_diagram' AND a.type::text = 'lewis_diagram')
    )
  FOR SHARE OF ca, c, s, a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz assignment unavailable' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_progress
  FROM public.student_progress
  WHERE student_id = p_student_id
    AND class_activity_id = p_assignment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz retry unavailable' USING ERRCODE = '42501';
  END IF;

  SELECT max(sa.completed_at) INTO v_latest_completed_at
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress.id AND sa.quiz_key = p_quiz_key;

  IF v_latest_completed_at IS NULL THEN
    RAISE EXCEPTION 'Quiz retry unavailable' USING ERRCODE = '42501';
  END IF;

  IF v_progress.quiz_started_at IS NOT NULL
     AND v_latest_completed_at < v_progress.quiz_started_at THEN
    -- Another tab already started the retry. Reuse that timestamp.
    RETURN jsonb_build_object(
      'progress_id', v_progress.id,
      'status', 'in_progress',
      'started_at', v_progress.quiz_started_at
    );
  END IF;

  v_started_at := clock_timestamp();
  UPDATE public.student_progress p
  SET status = 'in_progress',
      started_at = COALESCE(p.started_at, v_started_at),
      completed_at = NULL,
      quiz_started_at = v_started_at
  WHERE p.id = v_progress.id;

  UPDATE public.student_attempts
  SET status = 'completed', completed_at = v_started_at
  WHERE progress_id = v_progress.id
    AND quiz_key IS NULL
    AND status = 'in_progress'
    AND started_at <= v_started_at;

  RETURN jsonb_build_object(
    'progress_id', v_progress.id,
    'status', 'in_progress',
    'started_at', v_started_at
  );
END;
$_$;


ALTER FUNCTION "public"."student_quiz_retry_start"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_quiz_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."student_quiz_start"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_quiz_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
DECLARE
  v_progress public.student_progress%ROWTYPE;
  v_started_at timestamptz;
  v_latest_completed_at timestamptz;
  v_has_quiz_history boolean;
BEGIN
  IF p_quiz_key IS NULL OR p_quiz_key !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Invalid quiz start' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.class_activities ca
  JOIN public.classes c ON c.id = ca.class_id
  JOIN public.students s ON s.class_id = c.id
  JOIN public.activities a ON a.id = ca.activity_id
  WHERE ca.id = p_assignment_id
    AND c.id = p_class_id
    AND s.id = p_student_id
    AND s.verified
    AND c.is_active
    AND ca.archived_at IS NULL
    AND (ca.opens_at IS NULL OR ca.opens_at <= now())
    AND (ca.closes_at IS NULL OR ca.closes_at > now())
    AND (
      ((((((((((((p_quiz_key = 'bohr_models' AND a.type::text IN ('bohr_model_intro', 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability'))
      OR (p_quiz_key = 'lewis_covalent' AND a.type::text = 'lewis_structures_covalent')
      OR (p_quiz_key = 'lewis_ionic' AND a.type::text = 'lewis_structures_ionic') OR (p_quiz_key = 'lewis_diagram' AND a.type::text = 'lewis_diagram')
    )
  FOR SHARE OF ca, c, s, a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz assignment unavailable' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.student_progress(student_id, class_activity_id)
    VALUES (p_student_id, p_assignment_id)
    ON CONFLICT (student_id, class_activity_id) DO NOTHING;

  SELECT * INTO v_progress
  FROM public.student_progress
  WHERE student_id = p_student_id
    AND class_activity_id = p_assignment_id
  FOR UPDATE;

  SELECT max(sa.completed_at) INTO v_latest_completed_at
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress.id AND sa.quiz_key = p_quiz_key;

  SELECT EXISTS (
    SELECT 1 FROM public.student_attempts sa
    WHERE sa.progress_id = v_progress.id AND sa.quiz_key = p_quiz_key
  ) INTO v_has_quiz_history;

  IF v_progress.quiz_started_at IS NULL AND v_has_quiz_history THEN
    RETURN jsonb_build_object('status', 'retry_required');
  END IF;

  IF v_latest_completed_at IS NOT NULL
     AND (v_progress.quiz_started_at IS NULL
          OR v_latest_completed_at >= v_progress.quiz_started_at) THEN
    RETURN jsonb_build_object('status', 'retry_required');
  END IF;

  IF v_progress.quiz_started_at IS NULL THEN
    v_started_at := clock_timestamp();
    UPDATE public.student_progress p
    SET status = 'in_progress',
        started_at = COALESCE(p.started_at, v_started_at),
        completed_at = NULL,
        quiz_started_at = v_started_at,
        first_quiz_started_at = CASE
          WHEN p.first_quiz_started_at IS NULL AND NOT v_has_quiz_history
            THEN v_started_at
          ELSE p.first_quiz_started_at
        END,
        exploration_duration_seconds = CASE
          WHEN p.exploration_duration_seconds IS NOT NULL THEN p.exploration_duration_seconds
          WHEN p.exploration_started_at IS NOT NULL
               AND p.first_quiz_started_at IS NULL
               AND NOT v_has_quiz_history
            THEN greatest(
              0::bigint,
              floor(extract(epoch FROM (v_started_at - p.exploration_started_at)))::bigint
            )
          ELSE NULL
        END
    WHERE p.id = v_progress.id;
  ELSE
    -- Refreshes, duplicate clicks, and parallel tabs reuse the active start.
    v_started_at := v_progress.quiz_started_at;
  END IF;

  UPDATE public.student_attempts
  SET status = 'completed', completed_at = v_started_at
  WHERE progress_id = v_progress.id
    AND quiz_key IS NULL
    AND status = 'in_progress'
    AND started_at <= v_started_at;

  RETURN jsonb_build_object(
    'progress_id', v_progress.id,
    'status', 'in_progress',
    'started_at', v_started_at
  );
END;
$_$;


ALTER FUNCTION "public"."student_quiz_start"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_quiz_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."student_quiz_submit"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_quiz_key" "text", "p_submission_key" "text", "p_answers" "jsonb") RETURNS SETOF "public"."student_attempts"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_progress_id uuid;
  v_quiz_started_at timestamptz;
  v_existing_started_at timestamptz;
BEGIN
  SELECT p.id, p.quiz_started_at
    INTO v_progress_id, v_quiz_started_at
  FROM public.student_progress p
  WHERE p.student_id = p_student_id
    AND p.class_activity_id = p_assignment_id
  FOR UPDATE;

  IF NOT FOUND OR v_quiz_started_at IS NULL THEN
    RAISE EXCEPTION 'Quiz has not been started' USING ERRCODE = '42501';
  END IF;

  SELECT sa.started_at INTO v_existing_started_at
  FROM public.student_attempts sa
  WHERE sa.progress_id = v_progress_id
    AND sa.quiz_key = p_quiz_key
    AND sa.submission_key = p_submission_key;

  IF FOUND THEN
    v_quiz_started_at := v_existing_started_at;
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


ALTER FUNCTION "public"."student_quiz_submit"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_quiz_key" "text", "p_submission_key" "text", "p_answers" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."student_quiz_submit"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_quiz_key" "text", "p_quiz_started_at" timestamp with time zone, "p_submission_key" "text", "p_answers" "jsonb") RETURNS SETOF "public"."student_attempts"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
DECLARE
  progress uuid;
  assignment_type text;
  expected_questions integer;
  answer jsonb;
  submitted_question_key text;
  selected_index integer;
  correct_index integer;
  option_count integer;
  answer_count integer;
  question_pool_count integer;
  score_value integer := 0;
  next_attempt_number integer;
  percentage_value numeric(5, 2);
  passed_value boolean;
  started_timestamp timestamptz;
  completed_timestamp timestamptz;
  existing_attempt public.student_attempts%ROWTYPE;
  inserted_attempt public.student_attempts%ROWTYPE;
BEGIN
  IF p_quiz_key IS NULL OR p_quiz_key !~ '^[a-z0-9_]+$'
     OR p_quiz_started_at IS NULL
     OR p_submission_key IS NULL OR length(btrim(p_submission_key)) = 0
     OR p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN
    RAISE EXCEPTION 'Invalid quiz submission' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.class_activities ca
  JOIN public.classes c ON c.id = ca.class_id
  JOIN public.students s ON s.class_id = c.id
  JOIN public.activities a ON a.id = ca.activity_id
  WHERE ca.id = p_assignment_id
    AND c.id = p_class_id
    AND s.id = p_student_id
    AND s.verified
    AND c.is_active
    AND ca.archived_at IS NULL
    AND (ca.opens_at IS NULL OR ca.opens_at <= now())
    AND (ca.closes_at IS NULL OR ca.closes_at > now())
    AND (
      ((((((((((((p_quiz_key = 'bohr_models' AND a.type::text IN ('bohr_model_intro', 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability')) OR (p_quiz_key = 'bohr_model_intro' AND a.type::text = 'bohr_model_intro') OR (p_quiz_key = 'bohr_model_stability' AND a.type::text = 'bohr_model_stability'))
      OR (p_quiz_key = 'lewis_covalent' AND a.type::text = 'lewis_structures_covalent')
      OR (p_quiz_key = 'lewis_ionic' AND a.type::text = 'lewis_structures_ionic') OR (p_quiz_key = 'lewis_diagram' AND a.type::text = 'lewis_diagram')
    )
  FOR SHARE OF ca, c, s, a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz assignment unavailable' USING ERRCODE = '42501';
  END IF;

  -- Serialize submissions for this assignment. Duplicate tabs share one
  -- result per start; a result from a previous start cannot complete a retry.
  SELECT id, quiz_started_at INTO progress, started_timestamp
  FROM public.student_progress
  WHERE student_id = p_student_id
    AND class_activity_id = p_assignment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz has not been started' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO existing_attempt
  FROM public.student_attempts
  WHERE submission_key = p_submission_key
    AND progress_id = progress
    AND quiz_key = p_quiz_key;
  IF FOUND THEN
    IF existing_attempt.started_at <> p_quiz_started_at THEN
      RAISE EXCEPTION 'Submission key reused for a different quiz start' USING ERRCODE = '22023';
    END IF;
    RETURN NEXT existing_attempt;
    RETURN;
  END IF;

  IF started_timestamp IS NULL OR started_timestamp <> p_quiz_started_at THEN
    RAISE EXCEPTION 'Quiz start is stale' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO existing_attempt
  FROM public.student_attempts
  WHERE progress_id = progress
    AND quiz_key = p_quiz_key
    AND started_at = p_quiz_started_at
  ORDER BY created_at DESC
  LIMIT 1;
  IF FOUND THEN
    -- A second tab may have submitted different answers or a different
    -- idempotency key. Return the first result; never create another attempt.
    RETURN NEXT existing_attempt;
    RETURN;
  END IF;

  SELECT count(*)::integer INTO question_pool_count
  FROM public.quiz_questions
  WHERE quiz_key = p_quiz_key AND is_active;

  expected_questions := LEAST(12, question_pool_count);
  answer_count := jsonb_array_length(p_answers);

  IF expected_questions = 0 OR answer_count <> expected_questions THEN
    RAISE EXCEPTION 'Quiz submission has an invalid question count' USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT count(DISTINCT value->>'questionId')
    FROM jsonb_array_elements(p_answers)
  ) <> answer_count THEN
    RAISE EXCEPTION 'Quiz submission contains duplicate questions' USING ERRCODE = '22023';
  END IF;

  FOR answer IN SELECT value FROM jsonb_array_elements(p_answers)
  LOOP
    submitted_question_key := answer->>'questionId';
    IF submitted_question_key IS NULL OR submitted_question_key = ''
       OR (answer->>'selectedIndex') IS NULL
       OR (answer->>'selectedIndex') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Invalid quiz answer' USING ERRCODE = '22023';
    END IF;

    selected_index := (answer->>'selectedIndex')::integer;

    SELECT qq.correct_index, jsonb_array_length(qq.options)
    INTO correct_index, option_count
    FROM public.quiz_questions qq
    WHERE qq.quiz_key = p_quiz_key
      AND qq.question_key = submitted_question_key
      AND qq.is_active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Quiz question is unavailable' USING ERRCODE = '22023';
    END IF;

    IF selected_index >= option_count THEN
      RAISE EXCEPTION 'Quiz answer choice is unavailable' USING ERRCODE = '22023';
    END IF;

    IF selected_index = correct_index THEN
      score_value := score_value + 1;
    END IF;
  END LOOP;

  percentage_value := round((score_value * 100.0) / answer_count, 2);
  passed_value := percentage_value >= 80;
  completed_timestamp := clock_timestamp();

  SELECT COALESCE(max(attempt_number), 0) + 1 INTO next_attempt_number
  FROM public.student_attempts
  WHERE progress_id = progress AND quiz_key = p_quiz_key;

  INSERT INTO public.student_attempts(
    progress_id, attempt_number, quiz_key, question_total, score,
    percentage, passed, submission_key, status, started_at, completed_at
  ) VALUES (
    progress, next_attempt_number, p_quiz_key, answer_count, score_value,
    percentage_value, passed_value, p_submission_key, 'completed',
    p_quiz_started_at, completed_timestamp
  ) RETURNING * INTO inserted_attempt;

  RETURN NEXT inserted_attempt;
END;
$_$;


ALTER FUNCTION "public"."student_quiz_submit"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_quiz_key" "text", "p_quiz_started_at" timestamp with time zone, "p_submission_key" "text", "p_answers" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."teacher_activity_attempt_summary"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT private.teacher_attempt_rows(p_teacher_id, p_class_id, p_assignment_id, true, NULL, false);
$$;


ALTER FUNCTION "public"."teacher_activity_attempt_summary"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."teacher_activity_live_summary"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_include_attempts" boolean DEFAULT false, "p_student_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT private.teacher_attempt_rows(p_teacher_id, p_class_id, p_assignment_id, p_include_attempts,
    CASE WHEN p_student_id IS NULL THEN NULL::uuid[] ELSE ARRAY[p_student_id] END, true);
$$;


ALTER FUNCTION "public"."teacher_activity_live_summary"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_include_attempts" boolean, "p_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."teacher_class_lesson_progress"("p_teacher_id" "uuid", "p_class_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."teacher_class_lesson_progress"("p_teacher_id" "uuid", "p_class_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."teacher_class_updates"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_after" bigint DEFAULT NULL::bigint, "p_assignment_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."teacher_class_updates"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_after" bigint, "p_assignment_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "private"."teacher_changed_students" (
    "class_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "revision" bigint NOT NULL
);


ALTER TABLE "private"."teacher_changed_students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "private"."teacher_class_versions" (
    "class_id" "uuid" NOT NULL,
    "revision" bigint DEFAULT 0 NOT NULL,
    "reset_revision" bigint DEFAULT 0 NOT NULL
);


ALTER TABLE "private"."teacher_class_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "type" "public"."activity_type" NOT NULL,
    "order_index" integer NOT NULL
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "is_correct" boolean DEFAULT false NOT NULL,
    "order_index" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attempt_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attempt_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "answer_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."attempt_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "opens_at" timestamp with time zone,
    "closes_at" timestamp with time zone,
    "passing_threshold" integer DEFAULT 70 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    CONSTRAINT "class_activities_date_window_check" CHECK ((("opens_at" IS NULL) OR ("closes_at" IS NULL) OR ("opens_at" < "closes_at"))),
    CONSTRAINT "class_activities_passing_threshold_check" CHECK ((("passing_threshold" >= 1) AND ("passing_threshold" <= 100)))
);


ALTER TABLE "public"."class_activities" OWNER TO "postgres";


COMMENT ON COLUMN "public"."class_activities"."opens_at" IS 'Inclusive opening instant. NULL means no opening restriction.';



COMMENT ON COLUMN "public"."class_activities"."closes_at" IS 'Exclusive closing instant. NULL means no closing restriction.';



COMMENT ON COLUMN "public"."class_activities"."archived_at" IS 'When set, the assignment is hidden from students and the assign catalog. Attempt history is retained. Re-assigning the same activity creates a new row.';



CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "section" "text" NOT NULL,
    "class_code" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "classes_class_code_check" CHECK (("class_code" ~ '^[A-Z0-9]{6}$'::"text"))
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."measurement_quiz_readings" (
    "mode" "text" NOT NULL,
    "question_key" "text" NOT NULL,
    "reading" numeric(6,2) NOT NULL,
    CONSTRAINT "measurement_quiz_readings_mode_check" CHECK (("mode" = ANY (ARRAY['ruler_tenths'::"text", 'ruler_hundredths'::"text", 'cylinder_whole'::"text", 'cylinder_tenths'::"text"]))),
    CONSTRAINT "measurement_quiz_readings_question_key_check" CHECK (("length"("btrim"("question_key")) > 0)),
    CONSTRAINT "measurement_quiz_readings_reading_check" CHECK (("reading" >= (0)::numeric)),
    CONSTRAINT "measurement_quiz_readings_within_instrument" CHECK (("reading" <= (
CASE
    WHEN ("mode" ~~ 'cylinder_%'::"text") THEN 50
    ELSE 10
END)::numeric))
);


ALTER TABLE "public"."measurement_quiz_readings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."measurement_quiz_session_questions" (
    "session_id" "uuid" NOT NULL,
    "question_index" integer NOT NULL,
    "question_key" "text" NOT NULL,
    "reading" numeric(6,2) NOT NULL,
    "first_answer" "text",
    "is_correct" boolean,
    "answered_at" timestamp with time zone,
    CONSTRAINT "measurement_quiz_session_questions_check" CHECK (((("first_answer" IS NULL) AND ("is_correct" IS NULL) AND ("answered_at" IS NULL)) OR (("first_answer" IS NOT NULL) AND ("is_correct" IS NOT NULL) AND ("answered_at" IS NOT NULL)))),
    CONSTRAINT "measurement_quiz_session_questions_question_index_check" CHECK (("question_index" >= 0)),
    CONSTRAINT "measurement_quiz_session_questions_reading_check" CHECK (("reading" >= (0)::numeric))
);


ALTER TABLE "public"."measurement_quiz_session_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."measurement_quiz_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "progress_id" "uuid" NOT NULL,
    "mode" "text" NOT NULL,
    "attempt_number" integer NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "completed_at" timestamp with time zone,
    "result_attempt_id" "uuid",
    CONSTRAINT "measurement_quiz_sessions_attempt_number_check" CHECK (("attempt_number" > 0)),
    CONSTRAINT "measurement_quiz_sessions_check" CHECK (((("status" = 'in_progress'::"text") AND ("completed_at" IS NULL) AND ("result_attempt_id" IS NULL)) OR (("status" = 'completed'::"text") AND ("completed_at" IS NOT NULL) AND ("result_attempt_id" IS NOT NULL)))),
    CONSTRAINT "measurement_quiz_sessions_mode_check" CHECK (("mode" = ANY (ARRAY['ruler_tenths'::"text", 'ruler_hundredths'::"text", 'cylinder_whole'::"text", 'cylinder_tenths'::"text"]))),
    CONSTRAINT "measurement_quiz_sessions_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."measurement_quiz_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_activity_id" "uuid" NOT NULL,
    "prompt" "text" NOT NULL,
    "allow_multiple_correct" boolean DEFAULT false NOT NULL,
    "order_index" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quiz_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quiz_key" "text" NOT NULL,
    "question_key" "text" NOT NULL,
    "question" "text" NOT NULL,
    "options" "jsonb" NOT NULL,
    "correct_index" integer NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "diagram_key" "text",
    CONSTRAINT "quiz_questions_correct_index_in_range" CHECK (
CASE
    WHEN ("jsonb_typeof"("options") = 'array'::"text") THEN (("correct_index" >= 0) AND ("correct_index" < "jsonb_array_length"("options")))
    ELSE false
END),
    CONSTRAINT "quiz_questions_diagram_key_format" CHECK ((("diagram_key" IS NULL) OR ("diagram_key" ~ '^[a-z0-9]+$'::"text"))),
    CONSTRAINT "quiz_questions_options_is_array" CHECK (
CASE
    WHEN ("jsonb_typeof"("options") = 'array'::"text") THEN ("jsonb_array_length"("options") >= 2)
    ELSE false
END),
    CONSTRAINT "quiz_questions_question_check" CHECK (("length"("btrim"("question")) > 0)),
    CONSTRAINT "quiz_questions_question_key_check" CHECK (("length"("btrim"("question_key")) > 0)),
    CONSTRAINT "quiz_questions_quiz_key_check" CHECK (("quiz_key" ~ '^[a-z0-9_]+$'::"text"))
);


ALTER TABLE "public"."quiz_questions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."quiz_questions"."diagram_key" IS 'Optional covalent compound id used to render a live question diagram; null means text-only.';



CREATE TABLE IF NOT EXISTS "public"."student_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "class_activity_id" "uuid" NOT NULL,
    "status" "public"."progress_status" DEFAULT 'not_started'::"public"."progress_status" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "exploration_started_at" timestamp with time zone,
    "first_quiz_started_at" timestamp with time zone,
    "quiz_started_at" timestamp with time zone,
    "exploration_duration_seconds" bigint,
    "exploration_completed" boolean DEFAULT false NOT NULL,
    "exploration_completed_at" timestamp with time zone,
    CONSTRAINT "student_progress_exploration_duration_nonnegative" CHECK ((("exploration_duration_seconds" IS NULL) OR ("exploration_duration_seconds" >= 0)))
);


ALTER TABLE "public"."student_progress" OWNER TO "postgres";


COMMENT ON COLUMN "public"."student_progress"."exploration_started_at" IS 'First server-recorded start of assigned exploration; null when exploration has not been started.';



COMMENT ON COLUMN "public"."student_progress"."first_quiz_started_at" IS 'First server-recorded start of the assigned quiz; null when no start timestamp was saved.';



COMMENT ON COLUMN "public"."student_progress"."quiz_started_at" IS 'Latest server-recorded quiz start, including an explicit retry after a completed failed attempt.';



COMMENT ON COLUMN "public"."student_progress"."exploration_duration_seconds" IS 'Wall-clock seconds from the first saved exploration start to the first saved quiz start; null when either endpoint is unknown.';



COMMENT ON COLUMN "public"."student_progress"."exploration_completed" IS 'Durable completion marker for the assignment exploration, independent of quiz status.';



COMMENT ON COLUMN "public"."student_progress"."exploration_completed_at" IS 'First known server timestamp when the assignment exploration was completed.';



CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "student_id" "text" NOT NULL,
    "verified" boolean DEFAULT false NOT NULL,
    "auth_user_id" "uuid"
);


ALTER TABLE "public"."students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teachers" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."teachers" OWNER TO "postgres";


ALTER TABLE ONLY "private"."teacher_changed_students"
    ADD CONSTRAINT "teacher_changed_students_pkey" PRIMARY KEY ("class_id", "student_id");



ALTER TABLE ONLY "private"."teacher_class_versions"
    ADD CONSTRAINT "teacher_class_versions_pkey" PRIMARY KEY ("class_id");



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attempt_responses"
    ADD CONSTRAINT "attempt_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_activities"
    ADD CONSTRAINT "class_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_class_code_key" UNIQUE ("class_code");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_teacher_id_name_section_key" UNIQUE ("teacher_id", "name", "section");



ALTER TABLE ONLY "public"."measurement_quiz_readings"
    ADD CONSTRAINT "measurement_quiz_readings_mode_reading_key" UNIQUE ("mode", "reading");



ALTER TABLE ONLY "public"."measurement_quiz_readings"
    ADD CONSTRAINT "measurement_quiz_readings_pkey" PRIMARY KEY ("mode", "question_key");



ALTER TABLE ONLY "public"."measurement_quiz_session_questions"
    ADD CONSTRAINT "measurement_quiz_session_questions_pkey" PRIMARY KEY ("session_id", "question_index");



ALTER TABLE ONLY "public"."measurement_quiz_session_questions"
    ADD CONSTRAINT "measurement_quiz_session_questions_session_id_question_key_key" UNIQUE ("session_id", "question_key");



ALTER TABLE ONLY "public"."measurement_quiz_sessions"
    ADD CONSTRAINT "measurement_quiz_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."measurement_quiz_sessions"
    ADD CONSTRAINT "measurement_quiz_sessions_progress_id_mode_attempt_number_key" UNIQUE ("progress_id", "mode", "attempt_number");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_questions"
    ADD CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_questions"
    ADD CONSTRAINT "quiz_questions_quiz_question_key" UNIQUE ("quiz_key", "question_key");



ALTER TABLE ONLY "public"."student_attempts"
    ADD CONSTRAINT "student_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_progress"
    ADD CONSTRAINT "student_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_progress"
    ADD CONSTRAINT "student_progress_student_id_class_activity_id_key" UNIQUE ("student_id", "class_activity_id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_class_id_student_id_key" UNIQUE ("class_id", "student_id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_pkey" PRIMARY KEY ("id");



CREATE INDEX "teacher_changed_students_revision_idx" ON "private"."teacher_changed_students" USING "btree" ("class_id", "revision");



CREATE UNIQUE INDEX "class_activities_active_class_activity_key" ON "public"."class_activities" USING "btree" ("class_id", "activity_id") WHERE ("archived_at" IS NULL);



CREATE UNIQUE INDEX "classes_teacher_name_section_norm_key" ON "public"."classes" USING "btree" ("teacher_id", "lower"("regexp_replace"("btrim"("name"), '\s+'::"text", ' '::"text", 'g'::"text")), "lower"("regexp_replace"("btrim"("section"), '\s+'::"text", ' '::"text", 'g'::"text")));



CREATE INDEX "idx_answers_question_id" ON "public"."answers" USING "btree" ("question_id");



CREATE INDEX "idx_attempt_responses_answer_id" ON "public"."attempt_responses" USING "btree" ("answer_id");



CREATE INDEX "idx_attempt_responses_attempt_id" ON "public"."attempt_responses" USING "btree" ("attempt_id");



CREATE INDEX "idx_attempt_responses_question_id" ON "public"."attempt_responses" USING "btree" ("question_id");



CREATE INDEX "idx_class_activities_activity_id" ON "public"."class_activities" USING "btree" ("activity_id");



CREATE INDEX "idx_class_activities_class_id" ON "public"."class_activities" USING "btree" ("class_id");



CREATE INDEX "idx_classes_teacher_id" ON "public"."classes" USING "btree" ("teacher_id");



CREATE INDEX "idx_questions_class_activity_id" ON "public"."questions" USING "btree" ("class_activity_id");



CREATE INDEX "idx_student_attempts_progress_id" ON "public"."student_attempts" USING "btree" ("progress_id");



CREATE INDEX "idx_student_progress_class_activity_id" ON "public"."student_progress" USING "btree" ("class_activity_id");



CREATE INDEX "idx_student_progress_student_id" ON "public"."student_progress" USING "btree" ("student_id");



CREATE INDEX "idx_students_class_id" ON "public"."students" USING "btree" ("class_id");



CREATE UNIQUE INDEX "measurement_quiz_one_active_per_mode" ON "public"."measurement_quiz_sessions" USING "btree" ("progress_id", "mode") WHERE ("status" = 'in_progress'::"text");



CREATE UNIQUE INDEX "student_attempts_exploration_progress_number_key" ON "public"."student_attempts" USING "btree" ("progress_id", "attempt_number") WHERE ("quiz_key" IS NULL);



CREATE UNIQUE INDEX "student_attempts_one_active_exploration" ON "public"."student_attempts" USING "btree" ("progress_id") WHERE (("status" = 'in_progress'::"text") AND ("quiz_key" IS NULL));



CREATE UNIQUE INDEX "student_attempts_one_active_quiz" ON "public"."student_attempts" USING "btree" ("progress_id", "quiz_key") WHERE (("status" = 'in_progress'::"text") AND ("quiz_key" IS NOT NULL));



CREATE INDEX "student_attempts_progress_started_idx" ON "public"."student_attempts" USING "btree" ("progress_id", "started_at" DESC);



CREATE UNIQUE INDEX "student_attempts_quiz_progress_number_key" ON "public"."student_attempts" USING "btree" ("progress_id", "quiz_key", "attempt_number") WHERE ("quiz_key" IS NOT NULL);



CREATE UNIQUE INDEX "student_attempts_submission_key" ON "public"."student_attempts" USING "btree" ("submission_key") WHERE ("submission_key" IS NOT NULL);



CREATE UNIQUE INDEX "students_auth_user_id_key" ON "public"."students" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "chemclicks_assignments_broadcast" AFTER INSERT OR DELETE OR UPDATE ON "public"."class_activities" FOR EACH ROW EXECUTE FUNCTION "private"."broadcast_teacher_class_change"();



CREATE OR REPLACE TRIGGER "chemclicks_attempts_broadcast" AFTER INSERT OR DELETE OR UPDATE ON "public"."student_attempts" FOR EACH ROW EXECUTE FUNCTION "private"."broadcast_teacher_class_change"();



CREATE OR REPLACE TRIGGER "chemclicks_catalog_broadcast" AFTER UPDATE OF "title", "type", "order_index" ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "private"."broadcast_teacher_class_change"();



CREATE OR REPLACE TRIGGER "chemclicks_classes_broadcast" AFTER DELETE OR UPDATE ON "public"."classes" FOR EACH ROW EXECUTE FUNCTION "private"."broadcast_teacher_class_change"();



CREATE OR REPLACE TRIGGER "chemclicks_measurement_sessions_broadcast" AFTER INSERT OR DELETE OR UPDATE ON "public"."measurement_quiz_sessions" FOR EACH ROW EXECUTE FUNCTION "private"."broadcast_teacher_class_change"();



CREATE OR REPLACE TRIGGER "chemclicks_progress_broadcast" AFTER INSERT OR DELETE OR UPDATE ON "public"."student_progress" FOR EACH ROW EXECUTE FUNCTION "private"."broadcast_teacher_class_change"();



CREATE OR REPLACE TRIGGER "chemclicks_students_broadcast" AFTER INSERT OR DELETE OR UPDATE ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "private"."broadcast_teacher_class_change"();



CREATE OR REPLACE TRIGGER "student_attempts_mark_exploration_complete" AFTER INSERT OR UPDATE OF "status", "completed_at" ON "public"."student_attempts" FOR EACH ROW WHEN ((("new"."quiz_key" IS NULL) AND ("new"."status" = 'completed'::"text"))) EXECUTE FUNCTION "public"."mark_assignment_exploration_complete"();



CREATE OR REPLACE TRIGGER "student_attempts_updated_at" BEFORE UPDATE ON "public"."student_attempts" FOR EACH ROW EXECUTE FUNCTION "public"."student_attempts_set_updated_at"();



CREATE OR REPLACE TRIGGER "student_progress_preserve_completion_on_quiz_start" BEFORE UPDATE OF "quiz_started_at" ON "public"."student_progress" FOR EACH ROW EXECUTE FUNCTION "public"."preserve_completed_progress_on_quiz_start"();



ALTER TABLE ONLY "private"."teacher_changed_students"
    ADD CONSTRAINT "teacher_changed_students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "private"."teacher_class_versions"
    ADD CONSTRAINT "teacher_class_versions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attempt_responses"
    ADD CONSTRAINT "attempt_responses_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "public"."answers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attempt_responses"
    ADD CONSTRAINT "attempt_responses_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."student_attempts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attempt_responses"
    ADD CONSTRAINT "attempt_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_activities"
    ADD CONSTRAINT "class_activities_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_activities"
    ADD CONSTRAINT "class_activities_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."measurement_quiz_session_questions"
    ADD CONSTRAINT "measurement_quiz_session_questions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."measurement_quiz_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."measurement_quiz_sessions"
    ADD CONSTRAINT "measurement_quiz_sessions_progress_id_fkey" FOREIGN KEY ("progress_id") REFERENCES "public"."student_progress"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."measurement_quiz_sessions"
    ADD CONSTRAINT "measurement_quiz_sessions_result_attempt_id_fkey" FOREIGN KEY ("result_attempt_id") REFERENCES "public"."student_attempts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_class_activity_id_fkey" FOREIGN KEY ("class_activity_id") REFERENCES "public"."class_activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_attempts"
    ADD CONSTRAINT "student_attempts_progress_id_fkey" FOREIGN KEY ("progress_id") REFERENCES "public"."student_progress"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_progress"
    ADD CONSTRAINT "student_progress_class_activity_id_fkey" FOREIGN KEY ("class_activity_id") REFERENCES "public"."class_activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_progress"
    ADD CONSTRAINT "student_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "private"."teacher_changed_students" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "private"."teacher_class_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."answers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attempt_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chemclicks_activities_select_catalog" ON "public"."activities" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "chemclicks_class_activities_insert_own" ON "public"."class_activities" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."classes" "c"
  WHERE (("c"."id" = "class_activities"."class_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "chemclicks_class_activities_select_own" ON "public"."class_activities" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."classes" "c"
  WHERE (("c"."id" = "class_activities"."class_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "chemclicks_class_activities_update_own" ON "public"."class_activities" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."classes" "c"
  WHERE (("c"."id" = "class_activities"."class_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."classes" "c"
  WHERE (("c"."id" = "class_activities"."class_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "chemclicks_classes_delete_own" ON "public"."classes" FOR DELETE TO "authenticated" USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "chemclicks_classes_insert_own" ON "public"."classes" FOR INSERT TO "authenticated" WITH CHECK (("teacher_id" = "auth"."uid"()));



CREATE POLICY "chemclicks_classes_select_own" ON "public"."classes" FOR SELECT TO "authenticated" USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "chemclicks_classes_update_own" ON "public"."classes" FOR UPDATE TO "authenticated" USING (("teacher_id" = "auth"."uid"())) WITH CHECK (("teacher_id" = "auth"."uid"()));



CREATE POLICY "chemclicks_quiz_questions_select_active" ON "public"."quiz_questions" FOR SELECT TO "authenticated" USING (("is_active" AND ("quiz_key" <> ALL (ARRAY['bohr_models'::"text", 'bohr_model_intro'::"text", 'bohr_model_stability'::"text", 'lewis_bonding'::"text", 'lewis_covalent'::"text", 'lewis_ionic'::"text", 'lewis_diagram'::"text"]))));



COMMENT ON POLICY "chemclicks_quiz_questions_select_active" ON "public"."quiz_questions" IS 'Authenticated users may read active questions except assignment-gated Bohr (legacy and split) and Lewis pools, including the Lewis dot diagram pool. Those questions are loaded by the server after an assignment check. Question writes require a privileged server/admin client.';



ALTER TABLE "public"."class_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."measurement_quiz_readings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."measurement_quiz_session_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."measurement_quiz_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quiz_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_attempts_teacher_read" ON "public"."student_attempts" FOR SELECT TO "authenticated" USING ("private"."teacher_can_read_attempt"("progress_id"));



ALTER TABLE "public"."student_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teachers_select_own" ON "public"."teachers" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "teachers_update_own" ON "public"."teachers" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



GRANT USAGE ON SCHEMA "private" TO "authenticated";
GRANT USAGE ON SCHEMA "private" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "private"."broadcast_teacher_class_change"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."record_teacher_class_change"("p_class_id" "uuid", "p_student_id" "uuid", "p_kind" "text", "p_assignment_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."teacher_attempt_rows"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_include_attempts" boolean, "p_student_ids" "uuid"[], "p_require_active" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."teacher_attempt_rows"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_include_attempts" boolean, "p_student_ids" "uuid"[], "p_require_active" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "private"."teacher_can_read_attempt"("p_progress_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."teacher_can_read_attempt"("p_progress_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."teacher_can_receive_class_updates"("p_topic" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."teacher_can_receive_class_updates"("p_topic" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."teacher_lesson_progress_rows"("p_class_id" "uuid", "p_student_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."teacher_lesson_progress_rows"("p_class_id" "uuid", "p_student_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."assignment_progress_state"("p_progress_id" "uuid", "p_activity_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assignment_progress_state"("p_progress_id" "uuid", "p_activity_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_teacher"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_teacher"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_teacher"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_assignment_exploration_complete"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_assignment_exploration_complete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."preserve_completed_progress_on_quiz_start"() TO "anon";
GRANT ALL ON FUNCTION "public"."preserve_completed_progress_on_quiz_start"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."preserve_completed_progress_on_quiz_start"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."student_assignment_progress_states"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."student_assignment_progress_states"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_ids" "uuid"[]) TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."student_attempts" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."student_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."student_attempts" TO "service_role";



REVOKE ALL ON FUNCTION "public"."student_attempt_access"("p_student_id" "uuid", "p_class_id" "uuid", "p_progress_id" "uuid", "p_create" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."student_attempt_access"("p_student_id" "uuid", "p_class_id" "uuid", "p_progress_id" "uuid", "p_create" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."student_attempt_transition"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_action" "text", "p_attempt_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."student_attempt_transition"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_action" "text", "p_attempt_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."student_attempts_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."student_attempts_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."student_attempts_set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."student_measurement_quiz_complete"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_attempt_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."student_measurement_quiz_complete"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_attempt_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."student_measurement_quiz_record_answer"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_attempt_id" "uuid", "p_question_index" integer, "p_answer" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."student_measurement_quiz_record_answer"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_attempt_id" "uuid", "p_question_index" integer, "p_answer" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."student_measurement_quiz_start"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_mode" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."student_measurement_quiz_start"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_mode" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."student_quiz_retry_start"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_quiz_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."student_quiz_retry_start"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_quiz_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."student_quiz_start"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_quiz_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."student_quiz_start"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_quiz_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."student_quiz_submit"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_quiz_key" "text", "p_submission_key" "text", "p_answers" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."student_quiz_submit"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_quiz_key" "text", "p_submission_key" "text", "p_answers" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."student_quiz_submit"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_quiz_key" "text", "p_quiz_started_at" timestamp with time zone, "p_submission_key" "text", "p_answers" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."student_quiz_submit"("p_student_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_quiz_key" "text", "p_quiz_started_at" timestamp with time zone, "p_submission_key" "text", "p_answers" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."teacher_activity_attempt_summary"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."teacher_activity_attempt_summary"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."teacher_activity_live_summary"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_include_attempts" boolean, "p_student_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."teacher_activity_live_summary"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_assignment_id" "uuid", "p_include_attempts" boolean, "p_student_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."teacher_class_lesson_progress"("p_teacher_id" "uuid", "p_class_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."teacher_class_lesson_progress"("p_teacher_id" "uuid", "p_class_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."teacher_class_updates"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_after" bigint, "p_assignment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."teacher_class_updates"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_after" bigint, "p_assignment_id" "uuid") TO "service_role";



GRANT SELECT ON TABLE "private"."teacher_changed_students" TO "service_role";



GRANT SELECT ON TABLE "private"."teacher_class_versions" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."activities" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON TABLE "public"."answers" TO "anon";
GRANT ALL ON TABLE "public"."answers" TO "authenticated";
GRANT ALL ON TABLE "public"."answers" TO "service_role";



GRANT ALL ON TABLE "public"."attempt_responses" TO "anon";
GRANT ALL ON TABLE "public"."attempt_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."attempt_responses" TO "service_role";



GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."class_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."class_activities" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."classes" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";



GRANT ALL ON TABLE "public"."measurement_quiz_readings" TO "service_role";



GRANT ALL ON TABLE "public"."measurement_quiz_session_questions" TO "service_role";



GRANT ALL ON TABLE "public"."measurement_quiz_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."questions" TO "anon";
GRANT ALL ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."quiz_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_questions" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."student_progress" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."student_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."student_progress" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."students" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."teachers" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."teachers" TO "authenticated";
GRANT ALL ON TABLE "public"."teachers" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";





-- Reconstructed trigger bindings omitted from the schema dump.
-- These are application triggers; Supabase-managed auth/realtime objects are
-- supplied by the local Supabase stack.

DROP TRIGGER IF EXISTS student_attempts_updated_at ON public.student_attempts;
CREATE TRIGGER student_attempts_updated_at
  BEFORE UPDATE ON public.student_attempts
  FOR EACH ROW EXECUTE FUNCTION public.student_attempts_set_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created_teacher ON auth.users;
CREATE TRIGGER on_auth_user_created_teacher
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_teacher();

DROP TRIGGER IF EXISTS student_progress_preserve_completion_on_quiz_start
  ON public.student_progress;
CREATE TRIGGER student_progress_preserve_completion_on_quiz_start
  BEFORE UPDATE OF quiz_started_at ON public.student_progress
  FOR EACH ROW EXECUTE FUNCTION public.preserve_completed_progress_on_quiz_start();

DROP TRIGGER IF EXISTS student_attempts_mark_exploration_complete
  ON public.student_attempts;
CREATE TRIGGER student_attempts_mark_exploration_complete
  AFTER INSERT OR UPDATE OF status, completed_at
  ON public.student_attempts
  FOR EACH ROW
  WHEN (NEW.quiz_key IS NULL AND NEW.status = 'completed')
  EXECUTE FUNCTION public.mark_assignment_exploration_complete();

DROP TRIGGER IF EXISTS chemclicks_students_broadcast ON public.students;
CREATE TRIGGER chemclicks_students_broadcast
  AFTER INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.broadcast_teacher_class_change();

DROP TRIGGER IF EXISTS chemclicks_progress_broadcast ON public.student_progress;
CREATE TRIGGER chemclicks_progress_broadcast
  AFTER INSERT OR UPDATE OR DELETE ON public.student_progress
  FOR EACH ROW EXECUTE FUNCTION private.broadcast_teacher_class_change();

DROP TRIGGER IF EXISTS chemclicks_attempts_broadcast ON public.student_attempts;
CREATE TRIGGER chemclicks_attempts_broadcast
  AFTER INSERT OR UPDATE OR DELETE ON public.student_attempts
  FOR EACH ROW EXECUTE FUNCTION private.broadcast_teacher_class_change();

DROP TRIGGER IF EXISTS chemclicks_measurement_sessions_broadcast
  ON public.measurement_quiz_sessions;
CREATE TRIGGER chemclicks_measurement_sessions_broadcast
  AFTER INSERT OR UPDATE OR DELETE ON public.measurement_quiz_sessions
  FOR EACH ROW EXECUTE FUNCTION private.broadcast_teacher_class_change();

DROP TRIGGER IF EXISTS chemclicks_assignments_broadcast ON public.class_activities;
CREATE TRIGGER chemclicks_assignments_broadcast
  AFTER INSERT OR UPDATE OR DELETE ON public.class_activities
  FOR EACH ROW EXECUTE FUNCTION private.broadcast_teacher_class_change();

DROP TRIGGER IF EXISTS chemclicks_classes_broadcast ON public.classes;
CREATE TRIGGER chemclicks_classes_broadcast
  AFTER UPDATE OR DELETE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION private.broadcast_teacher_class_change();

DROP TRIGGER IF EXISTS chemclicks_catalog_broadcast ON public.activities;
CREATE TRIGGER chemclicks_catalog_broadcast
  AFTER UPDATE OF title, type, order_index ON public.activities
  FOR EACH ROW EXECUTE FUNCTION private.broadcast_teacher_class_change();

-- Rewind objects and columns introduced by the tracked migrations so this
-- snapshot can serve as the pre-migration baseline. The tracked migrations
-- will recreate them in timestamp order.

-- The shared assignment-state migration changes this function's OUT columns;
-- leave its creation to that migration so PostgreSQL can replace the return
-- shape legally.
DROP FUNCTION IF EXISTS public.assignment_progress_state(uuid, text);

DROP TRIGGER IF EXISTS student_progress_preserve_completion_on_quiz_start
  ON public.student_progress;
DROP TRIGGER IF EXISTS student_attempts_mark_exploration_complete
  ON public.student_attempts;
DROP TRIGGER IF EXISTS chemclicks_students_broadcast ON public.students;
DROP TRIGGER IF EXISTS chemclicks_progress_broadcast ON public.student_progress;
DROP TRIGGER IF EXISTS chemclicks_attempts_broadcast ON public.student_attempts;
DROP TRIGGER IF EXISTS chemclicks_measurement_sessions_broadcast
  ON public.measurement_quiz_sessions;
DROP TRIGGER IF EXISTS chemclicks_assignments_broadcast ON public.class_activities;
DROP TRIGGER IF EXISTS chemclicks_classes_broadcast ON public.classes;
DROP TRIGGER IF EXISTS chemclicks_catalog_broadcast ON public.activities;

DROP TABLE IF EXISTS public.quiz_questions CASCADE;
DROP TABLE IF EXISTS public.measurement_quiz_session_questions CASCADE;
DROP TABLE IF EXISTS public.measurement_quiz_sessions CASCADE;
DROP TABLE IF EXISTS public.measurement_quiz_readings CASCADE;
DROP TABLE IF EXISTS private.teacher_changed_students CASCADE;
DROP TABLE IF EXISTS private.teacher_class_versions CASCADE;

ALTER TABLE public.students
  DROP COLUMN IF EXISTS auth_user_id;
ALTER TABLE public.class_activities
  DROP COLUMN IF EXISTS archived_at;
ALTER TABLE public.student_attempts
  DROP COLUMN IF EXISTS quiz_key,
  DROP COLUMN IF EXISTS question_total,
  DROP COLUMN IF EXISTS percentage,
  DROP COLUMN IF EXISTS submission_key,
  DROP COLUMN IF EXISTS instrument,
  DROP COLUMN IF EXISTS precision_mode;
ALTER TABLE public.student_progress
  DROP COLUMN IF EXISTS exploration_started_at,
  DROP COLUMN IF EXISTS first_quiz_started_at,
  DROP COLUMN IF EXISTS quiz_started_at,
  DROP COLUMN IF EXISTS exploration_duration_seconds,
  DROP COLUMN IF EXISTS exploration_completed,
  DROP COLUMN IF EXISTS exploration_completed_at;

ALTER TABLE public.class_activities
  ADD CONSTRAINT class_activities_class_activity_key
  UNIQUE (class_id, activity_id);

ALTER TABLE public.student_attempts
  ADD CONSTRAINT student_attempts_progress_number_key
  UNIQUE (progress_id, attempt_number);

CREATE INDEX student_attempts_one_active
  ON public.student_attempts (progress_id)
  WHERE status = 'in_progress';



