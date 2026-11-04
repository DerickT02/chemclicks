-- Split the Bohr quiz into lesson-specific pools and bind each new key to
-- its originating assignment type. Apply after the existing quiz/timer
-- migrations and seed migrations. This file is intentionally not applied by
-- the application agent.

BEGIN;

INSERT INTO public.quiz_questions
  (quiz_key, question_key, question, options, correct_index, order_index)
SELECT
  'bohr_model_intro',
  'intro-' || question_key,
  question,
  options,
  correct_index,
  order_index
FROM public.quiz_questions
WHERE quiz_key = 'bohr_models'
  AND question_key IN (
    'bohr-beryllium-shells',
    'bohr-identify-carbon',
    'bohr-protons-location',
    'bohr-electrons-location',
    'bohr-neutral-electron-count',
    'bohr-atomic-number-means',
    'bohr-first-shell',
    'bohr-second-shell-capacity',
    'bohr-third-shell-capacity',
    'bohr-identify-hydrogen',
    'bohr-identify-helium',
    'bohr-which-fills-first'
  )
ON CONFLICT (quiz_key, question_key) DO NOTHING;

INSERT INTO public.quiz_questions
  (quiz_key, question_key, question, options, correct_index, order_index)
VALUES
  ('bohr_model_stability', 'bohr-stability-noble-two', 'Which electron count gives a filled first shell?', '["1","2","8","10"]'::jsonb, 1, 1),
  ('bohr_model_stability', 'bohr-stability-noble-ten', 'Which electron count represents a filled 2, 8 shell arrangement?', '["8","9","10","18"]'::jsonb, 2, 2),
  ('bohr_model_stability', 'bohr-stability-noble-eighteen', 'Which electron count represents a filled 2, 8, 8 shell arrangement?', '["10","16","18","20"]'::jsonb, 2, 3),
  ('bohr_model_stability', 'bohr-stability-neutral', 'An atom has 11 protons and 11 electrons. What is its charge?', '["-1","0","+1","+2"]'::jsonb, 1, 4),
  ('bohr_model_stability', 'bohr-stability-cation', 'An atom has 12 protons and 10 electrons. What is its charge?', '["-2","-1","+1","+2"]'::jsonb, 3, 5),
  ('bohr_model_stability', 'bohr-stability-anion', 'An atom has 9 protons and 10 electrons. What is its charge?', '["-1","0","+1","+2"]'::jsonb, 0, 6),
  ('bohr_model_stability', 'bohr-stability-proton-change', 'Changing the number of protons changes which property?', '["The element identity","Only the shell capacity","The electron charge","Nothing"]'::jsonb, 0, 7),
  ('bohr_model_stability', 'bohr-stability-electron-change', 'Changing the number of electrons while keeping protons fixed creates a change in:', '["Element identity","Ionic charge","Atomic number","Nucleus size"]'::jsonb, 1, 8),
  ('bohr_model_stability', 'bohr-stability-sodium-ion', 'A sodium atom has 11 protons. How many electrons are in a sodium ion with a +1 charge?', '["9","10","11","12"]'::jsonb, 1, 9),
  ('bohr_model_stability', 'bohr-stability-chloride-ion', 'A chlorine atom has 17 protons. How many electrons are in a chloride ion with a -1 charge?', '["16","17","18","19"]'::jsonb, 2, 10),
  ('bohr_model_stability', 'bohr-stability-neutral-rule', 'Which relationship describes a neutral atom?', '["More electrons than protons","Fewer electrons than protons","Equal protons and electrons","No electrons"]'::jsonb, 2, 11),
  ('bohr_model_stability', 'bohr-stability-charge-rule', 'How is ionic charge calculated from particle counts?', '["Electrons minus shells","Protons minus electrons","Protons plus electrons","Electrons divided by protons"]'::jsonb, 1, 12)
ON CONFLICT (quiz_key, question_key) DO NOTHING;

-- The deployed schema has had several compatible revisions of these RPCs.
-- Rewrite their assignment binding in place so the latest deployed function
-- definitions retain the trusted server-side grading and timer checks.
DO $$
DECLARE
  item record;
  original_definition text;
  updated_definition text;
BEGIN
  FOR item IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('student_quiz_start', 'student_quiz_retry_start', 'student_quiz_submit')
  LOOP
    original_definition := pg_get_functiondef(item.oid);
    updated_definition := replace(
      original_definition,
      '(p_quiz_key = ''bohr_models'' AND a.type::text IN (''bohr_model_intro'', ''bohr_model_stability''))',
      '((p_quiz_key = ''bohr_models'' AND a.type::text IN (''bohr_model_intro'', ''bohr_model_stability'')) OR (p_quiz_key = ''bohr_model_intro'' AND a.type::text = ''bohr_model_intro'') OR (p_quiz_key = ''bohr_model_stability'' AND a.type::text = ''bohr_model_stability''))'
    );
    IF updated_definition <> original_definition THEN
      EXECUTE updated_definition;
    END IF;
  END LOOP;

  -- teacher_class_lesson_progress is not rewritten here. An earlier version
  -- appended an unparenthesised OR to its quiz filter, which dropped the
  -- progress-row check and marked every Bohr lesson completed for every
  -- student once anyone had passed the legacy quiz. The function is defined,
  -- accepting both the legacy and split Bohr keys, by
  -- 20261104000100_fix_bohr_lesson_progress_scope.sql and
  -- 20261104000200_shared_assignment_progress_state.sql.

  FOR item IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'sync_bohr_progress_after_quiz'
  LOOP
    original_definition := pg_get_functiondef(item.oid);
    updated_definition := replace(
      original_definition,
      'IF NEW.quiz_key = ''bohr_models''',
      'IF NEW.quiz_key IN (''bohr_models'', ''bohr_model_intro'', ''bohr_model_stability'')'
    );
    IF updated_definition <> original_definition THEN
      EXECUTE updated_definition;
    END IF;
  END LOOP;
END;
$$;

COMMIT;

