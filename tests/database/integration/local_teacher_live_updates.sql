-- LOCAL EMPTY POSTGRES ONLY. This builds a minimal disposable schema, not the
-- application baseline. realtime.send is a recording stub: this validates SQL,
-- trigger routing, RLS and report semantics, NOT hosted WebSocket delivery.
\set ON_ERROR_STOP on
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA realtime;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email_confirmed_at timestamptz, is_anonymous boolean DEFAULT false);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('realtime.topic', true) $$;
CREATE TABLE public.teachers (id uuid PRIMARY KEY REFERENCES auth.users(id));
CREATE TABLE public.classes (id uuid PRIMARY KEY, teacher_id uuid REFERENCES public.teachers(id), name text, is_active boolean DEFAULT true);
CREATE TABLE public.activities (id uuid PRIMARY KEY, title text, type text, order_index integer DEFAULT 0);
CREATE TABLE public.class_activities (id uuid PRIMARY KEY, class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE, activity_id uuid REFERENCES public.activities(id), archived_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE public.students (id uuid PRIMARY KEY, class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE, first_name text, last_name text, student_id text, verified boolean DEFAULT false, auth_user_id uuid REFERENCES auth.users(id));
CREATE TABLE public.student_progress (id uuid PRIMARY KEY, student_id uuid REFERENCES public.students(id) ON DELETE CASCADE, class_activity_id uuid REFERENCES public.class_activities(id) ON DELETE CASCADE, status text DEFAULT 'not_started', started_at timestamptz, completed_at timestamptz, quiz_started_at timestamptz, first_quiz_started_at timestamptz, exploration_started_at timestamptz, exploration_duration_seconds integer);
CREATE TABLE public.student_attempts (id uuid PRIMARY KEY, progress_id uuid REFERENCES public.student_progress(id) ON DELETE CASCADE, attempt_number integer, status text, started_at timestamptz, completed_at timestamptz, created_at timestamptz DEFAULT now(), quiz_key text, instrument text, precision_mode text, score integer, question_total integer, percentage numeric, passed boolean);
CREATE TABLE public.measurement_quiz_sessions (id uuid PRIMARY KEY, progress_id uuid REFERENCES public.student_progress(id) ON DELETE CASCADE, status text);
CREATE TABLE realtime.messages (id bigint GENERATED ALWAYS AS IDENTITY, topic text, extension text DEFAULT 'broadcast', payload jsonb, private boolean);
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
-- Simulate an existing broad policy to ensure the restrictive policies win.
CREATE POLICY old_broad_receive ON realtime.messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY old_broad_send ON realtime.messages FOR INSERT TO anon, authenticated WITH CHECK (true);
GRANT USAGE ON SCHEMA auth, realtime TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON realtime.messages TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA realtime TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO realtime.messages(payload, topic, private) VALUES(payload, topic, private)
$$;
-- The live reads build on the shared assignment state from dev.
\ir ../../../supabase/migrations/20261104000200_shared_assignment_progress_state.sql
\ir ../../../supabase/migrations/20261105000000_teacher_class_broadcasts.sql
\ir ../../../supabase/migrations/20261105010000_teacher_live_attempt_summary.sql
\ir ../../../supabase/migrations/20261105020000_budget_teacher_notifications.sql
\ir ../../../supabase/migrations/20261105030000_teacher_student_revisions.sql
\ir ../../../supabase/migrations/20261105040000_teacher_incremental_reads.sql

INSERT INTO auth.users VALUES
('00000000-0000-4000-8000-000000000001', now(), false),
('00000000-0000-4000-8000-000000000002', now(), false),
('00000000-0000-4000-8000-000000000003', now(), false),
('00000000-0000-4000-8000-000000000004', NULL, false),
('00000000-0000-4000-8000-000000000005', now(), true);
INSERT INTO public.teachers SELECT id FROM auth.users;
INSERT INTO public.classes VALUES
('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Owner class', true),
('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'Other class', true),
('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Disabled class', false),
('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', 'Legacy student-owned class', true),
('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000004', 'Unverified owner class', true),
('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000005', 'Anonymous owner class', true);
INSERT INTO public.activities(id, title, type) VALUES ('20000000-0000-4000-8000-000000000001', 'Covalent', 'lewis_structures_covalent');
INSERT INTO public.class_activities(id, class_id, activity_id, archived_at) VALUES
('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', NULL),
('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', NULL);
INSERT INTO public.students VALUES
('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Alex', 'Waiting', 'TEST1', false, '00000000-0000-4000-8000-000000000003'),
('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Other', 'Student', 'TEST2', false, NULL);
INSERT INTO public.student_progress(id, student_id, class_activity_id, status, started_at, completed_at) VALUES
('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'completed', now() - interval '5 minutes', now());
INSERT INTO public.student_attempts(id, progress_id, attempt_number, status, quiz_key, score, question_total, passed, completed_at) VALUES
('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 1, 'completed', 'lewis_covalent', 1, 5, false, now()),
('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 2, 'completed', 'lewis_covalent', 5, 5, true, now());

DO $$
DECLARE n integer;
BEGIN
  IF EXISTS (SELECT 1 FROM realtime.messages WHERE NOT private OR payload - 'kind' - 'assignmentId' <> '{}'::jsonb) THEN RAISE EXCEPTION 'Sensitive/public broadcast'; END IF;
  SELECT count(*) INTO n FROM realtime.messages;
  UPDATE public.students SET verified = verified;
  IF (SELECT count(*) FROM realtime.messages) <> n THEN RAISE EXCEPTION 'No-op updates emitted hints'; END IF;
  UPDATE public.students SET class_id = '10000000-0000-4000-8000-000000000002' WHERE student_id = 'TEST1';
  IF (SELECT count(*) FROM realtime.messages) <> n + 2 THEN RAISE EXCEPTION 'Class transfer did not invalidate both scopes'; END IF;
  UPDATE public.students SET class_id = '10000000-0000-4000-8000-000000000001' WHERE student_id = 'TEST1';
  SELECT count(*) INTO n FROM realtime.messages;
  INSERT INTO public.measurement_quiz_sessions VALUES ('70000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'in_progress');
  DELETE FROM public.measurement_quiz_sessions;
  IF (SELECT count(*) FROM realtime.messages) <> n + 1 THEN RAISE EXCEPTION 'Measurement transaction hints not coalesced'; END IF;
END $$;

-- A 100-student bulk operation produces one roster hint, not 100. Further
-- updates/deletes in that transaction still need only that single hint.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM realtime.messages;
  INSERT INTO public.students(id, class_id, first_name, last_name, student_id)
  SELECT gen_random_uuid(), '10000000-0000-4000-8000-000000000001', 'Bulk', 'Budget test', 'BULK' || i FROM generate_series(1,100) i;
  UPDATE public.students SET verified = true WHERE first_name = 'Bulk';
  DELETE FROM public.students WHERE first_name = 'Bulk';
  IF (SELECT count(*) FROM realtime.messages) <> n + 1 THEN RAISE EXCEPTION 'Bulk operation wasted broadcast messages'; END IF;
END $$;
-- Local deduplication state must reset at commit and roll back at savepoints.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM realtime.messages;
  BEGIN
    UPDATE public.students SET verified = true WHERE student_id = 'TEST1';
    RAISE EXCEPTION 'Test rollback';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  UPDATE public.students SET verified = true WHERE student_id = 'TEST1';
  IF (SELECT count(*) FROM realtime.messages) <> n + 1 THEN RAISE EXCEPTION 'Previous transaction/savepoint suppressed a valid hint'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
SELECT set_config('realtime.topic', 'teacher-class:10000000-0000-4000-8000-000000000001', false);
SET ROLE authenticated;
DO $$ BEGIN
  IF NOT private.teacher_can_receive_class_updates(realtime.topic()) THEN RAISE EXCEPTION 'Owner denied'; END IF;
  IF (SELECT count(*) FROM realtime.messages) = 0 THEN RAISE EXCEPTION 'Owner receive denied'; END IF;
  IF EXISTS (SELECT 1 FROM realtime.messages WHERE topic <> realtime.topic()) THEN RAISE EXCEPTION 'Owner read another topic'; END IF;
  BEGIN
    INSERT INTO realtime.messages(topic, payload) VALUES(realtime.topic(), '{}');
    RAISE EXCEPTION 'Client spoofed a broadcast';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$
DECLARE caller text;
BEGIN
  FOREACH caller IN ARRAY ARRAY['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005'] LOOP
    PERFORM set_config('request.jwt.claim.sub', caller, false);
    SET LOCAL ROLE authenticated;
    IF private.teacher_can_receive_class_updates(realtime.topic()) OR EXISTS (SELECT 1 FROM realtime.messages) THEN RAISE EXCEPTION 'Unauthorized listener allowed: %', caller; END IF;
    RESET ROLE;
  END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', false);
SELECT set_config('realtime.topic', 'teacher-class:10000000-0000-4000-8000-000000000004', false);
SET ROLE authenticated;
DO $$ BEGIN IF private.teacher_can_receive_class_updates(realtime.topic()) THEN RAISE EXCEPTION 'Student with legacy owner profile allowed'; END IF; END $$;
RESET ROLE;
DO $$
DECLARE identity record;
BEGIN
  FOR identity IN SELECT * FROM (VALUES
    ('00000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005'),
    ('00000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006')
  ) AS owners(user_id, class_id) LOOP
    PERFORM set_config('request.jwt.claim.sub', identity.user_id, false);
    PERFORM set_config('realtime.topic', 'teacher-class:' || identity.class_id, false);
    SET LOCAL ROLE authenticated;
    IF private.teacher_can_receive_class_updates(realtime.topic()) THEN RAISE EXCEPTION 'Unverified/anonymous owner allowed'; END IF;
    RESET ROLE;
  END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub', '', false);
SET ROLE anon;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM realtime.messages) THEN RAISE EXCEPTION 'Anon receive allowed'; END IF; END $$;
RESET ROLE;
-- Even a broad old policy and forged request topic cannot expose or publish
-- reserved teacher messages through direct table access.
SELECT set_config('realtime.topic', 'unrelated-public-topic', false);
SET ROLE anon;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM realtime.messages) THEN RAISE EXCEPTION 'Reserved rows leaked through an unrelated topic'; END IF;
  BEGIN
    INSERT INTO realtime.messages(topic, payload) VALUES('teacher-class:10000000-0000-4000-8000-000000000001', '{}');
    RAISE EXCEPTION 'Forged topic bypassed client-send restriction';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
SELECT set_config('realtime.topic', 'teacher-class:10000000-0000-4000-8000-000000000003', false);
SET ROLE authenticated;
DO $$ BEGIN IF private.teacher_can_receive_class_updates(realtime.topic()) THEN RAISE EXCEPTION 'Disabled class allowed'; END IF; END $$;
RESET ROLE;

SET ROLE service_role;
DO $$
DECLARE overview jsonb; history jsonb; other_student jsonb;
BEGIN
  overview := public.teacher_activity_live_summary('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');
  IF overview#>'{students,0,attempts}' <> '[]'::jsonb OR overview#>>'{students,0,attemptCount}' <> '2' THEN RAISE EXCEPTION 'Overview built histories or lost counts'; END IF;
  IF overview#>>'{students,0,overallStatus}' <> 'completed' OR overview#>>'{students,0,passingQuizAttemptNumber}' <> '2' OR overview#>>'{students,0,failedQuizAttemptCount}' <> '1' THEN RAISE EXCEPTION 'Grade summary changed'; END IF;
  history := public.teacher_activity_live_summary('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', true, '40000000-0000-4000-8000-000000000001');
  IF jsonb_array_length(history->'students') <> 1 OR jsonb_array_length(history#>'{students,0,attempts}') <> 2 OR history#>>'{students,0,attempts,0,attemptNumber}' <> '2' THEN RAISE EXCEPTION 'Scoped history/order failed'; END IF;
  other_student := public.teacher_activity_live_summary('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', true, '40000000-0000-4000-8000-000000000002');
  IF other_student->'students' <> '[]'::jsonb THEN RAISE EXCEPTION 'Foreign student history leaked'; END IF;
  BEGIN
    PERFORM public.teacher_activity_live_summary('00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Foreign teacher summary allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.teacher_activity_live_summary('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Browser RPC allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT 'PASS: private hints, old/new scopes, no-op updates, owner/foreign/student/unverified/anonymous/disabled RLS, client spoof denial, lightweight summaries and scoped histories' AS result;
\ir local_teacher_delta_updates.sql
