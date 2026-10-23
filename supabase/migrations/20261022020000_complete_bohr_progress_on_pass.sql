-- Keep the student's assignment progress in sync with a passing Bohr quiz.
-- Failed attempts intentionally leave progress in_progress for retry.
BEGIN;

CREATE OR REPLACE FUNCTION public.sync_bohr_progress_after_quiz()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.quiz_key = 'bohr_models'
     AND NEW.status = 'completed'
     AND NEW.passed IS TRUE THEN
    UPDATE public.student_progress
    SET status = 'completed',
        completed_at = COALESCE(NEW.completed_at, clock_timestamp())
    WHERE id = NEW.progress_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_attempts_sync_bohr_progress
  ON public.student_attempts;

CREATE TRIGGER student_attempts_sync_bohr_progress
AFTER INSERT OR UPDATE OF status, passed, completed_at
ON public.student_attempts
FOR EACH ROW
EXECUTE FUNCTION public.sync_bohr_progress_after_quiz();

COMMIT;
