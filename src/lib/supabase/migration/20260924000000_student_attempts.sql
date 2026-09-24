-- SCRUM-167: reconcile the existing attempts table without dropping data.
-- Existing score/passed fields are retained. Invalid legacy rows abort the transaction.
BEGIN;

CREATE TABLE IF NOT EXISTS public.student_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  progress_id uuid NOT NULL REFERENCES public.student_progress(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  score numeric,
  passed boolean,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.student_attempts
  ADD COLUMN status text,
  ADD COLUMN created_at timestamptz,
  ADD COLUMN updated_at timestamptz;

UPDATE public.student_attempts
SET status = CASE WHEN completed_at IS NULL THEN 'in_progress' ELSE 'completed' END,
    created_at = started_at,
    updated_at = COALESCE(completed_at, started_at);

ALTER TABLE public.student_attempts
  ALTER COLUMN status SET DEFAULT 'in_progress',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL,
  ADD CONSTRAINT student_attempts_progress_number_key UNIQUE (progress_id, attempt_number),
  ADD CONSTRAINT student_attempts_positive_number CHECK (attempt_number > 0),
  ADD CONSTRAINT student_attempts_valid_status CHECK (status IN ('in_progress', 'completed')),
  ADD CONSTRAINT student_attempts_completion_state CHECK (
    (status = 'in_progress' AND completed_at IS NULL)
    OR (status = 'completed' AND completed_at IS NOT NULL)
  ),
  ADD CONSTRAINT student_attempts_timestamp_order CHECK (
    completed_at IS NULL OR completed_at >= started_at
  );

CREATE INDEX student_attempts_progress_started_idx
  ON public.student_attempts (progress_id, started_at DESC);

CREATE FUNCTION public.student_attempts_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER student_attempts_updated_at
  BEFORE UPDATE ON public.student_attempts
  FOR EACH ROW EXECUTE FUNCTION public.student_attempts_set_updated_at();

-- Deny client access until SCRUM-175 supplies the access policies.
ALTER TABLE public.student_attempts ENABLE ROW LEVEL SECURITY;

COMMIT;
