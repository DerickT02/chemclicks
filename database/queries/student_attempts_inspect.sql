-- Read-only preflight: run before applying the SCRUM-167 migration.
SELECT to_regclass('public.student_attempts') AS existing_table;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'student_attempts'
ORDER BY ordinal_position;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = to_regclass('public.student_attempts');

SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'student_attempts';

SELECT relrowsecurity AS rls_enabled FROM pg_class
WHERE oid = to_regclass('public.student_attempts');

SELECT tgname, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = to_regclass('public.student_attempts') AND NOT tgisinternal;

SELECT policyname, roles, cmd, qual, with_check FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'student_attempts';
