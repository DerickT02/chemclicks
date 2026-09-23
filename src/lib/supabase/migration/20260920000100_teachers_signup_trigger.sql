-- Teachers signup trigger: mirrors every new auth.users row into public.teachers.
-- The teachers table has no INSERT policy by design (see tests/database/integration/
-- teachers.test.ts), so the row must be created server-side. SECURITY DEFINER lets
-- this run with the owner's rights, bypassing RLS.
--
-- display_name is NOT NULL (see tests/database/schema/teachers.test.ts).
-- It uses the display_name passed in auth metadata at signup (options.data.display_name),
-- falling back to the email local part if omitted.
-- Teachers can change it later via the existing UPDATE policy.
--
-- NOTE: If a non-teacher auth user type is ever introduced, gate this trigger on a
-- metadata marker (e.g. NEW.raw_user_meta_data->>'role' = 'teacher'). Today teachers
-- are the only users created in auth.users; students use passwordless cookie sessions.
--
-- Apply in Supabase: SQL Editor → New query → paste → Run.
-- Safe to re-run: CREATE OR REPLACE + DROP TRIGGER IF EXISTS + ON CONFLICT DO NOTHING.

CREATE OR REPLACE FUNCTION public.handle_new_teacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DROP TRIGGER IF EXISTS on_auth_user_created_teacher ON auth.users;

CREATE TRIGGER on_auth_user_created_teacher
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_teacher();

