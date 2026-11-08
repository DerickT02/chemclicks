-- SCRUM-234: give the standalone Lewis dot diagram assignment its own quiz.
--
-- Until now lewis_diagram had no quiz and was completed once its exploration
-- was finished (see 20261104000200). It is now graded like the other Lewis
-- lessons: a reviewed `lewis_diagram` question pool, bound to lewis_diagram
-- assignments in the trusted quiz RPCs, 80% to pass, unlimited retries, and
-- completion once that quiz is passed.
--
-- The pool covers single-atom Lewis dot diagrams and valence electrons for
-- elements 1-20 (the explorer's range). It does not repeat the
-- diagram-based covalent molecule questions from SCRUM-131
-- (20261021010000), which stay in the lewis_covalent pool.
--
-- Apply after 20261104000300_fix_bohr_quiz_access_and_progress_history.sql
-- and the 20261105* teacher live-update migrations. This file is
-- intentionally not applied by the application agent.

BEGIN;

-- Dot placement follows src/lib/chemistry/lewis.ts: one dot per side before
-- any side is paired.
INSERT INTO public.quiz_questions
  (quiz_key, question_key, question, options, correct_index, order_index)
VALUES
  ('lewis_diagram', 'ldq-dots-represent',
    'What do the dots around the symbol in a Lewis dot diagram represent?',
    '["All of the atom''s electrons","The atom''s valence electrons","The atom''s protons","The atom''s neutrons"]'::jsonb,
    1, 1),
  ('lewis_diagram', 'ldq-sodium-why-one',
    'Sodium has 11 electrons, but its Lewis dot diagram shows only 1 dot. Why?',
    '["Only electrons in the outermost shell are shown","Sodium loses 10 electrons when drawn","Only unpaired electrons in the inner shells are shown","Each dot stands for 11 electrons"]'::jsonb,
    0, 2),
  ('lewis_diagram', 'ldq-dots-sodium',
    'How many dots are in the Lewis dot diagram for sodium (Na)?',
    '["11","2","8","1"]'::jsonb,
    3, 3),
  ('lewis_diagram', 'ldq-dots-magnesium',
    'How many dots are in the Lewis dot diagram for magnesium (Mg)?',
    '["12","2","3","8"]'::jsonb,
    1, 4),
  ('lewis_diagram', 'ldq-dots-aluminum',
    'How many dots are in the Lewis dot diagram for aluminum (Al)?',
    '["3","13","5","1"]'::jsonb,
    0, 5),
  ('lewis_diagram', 'ldq-dots-silicon',
    'How many dots are in the Lewis dot diagram for silicon (Si)?',
    '["14","2","4","6"]'::jsonb,
    2, 6),
  ('lewis_diagram', 'ldq-dots-phosphorus',
    'How many dots are in the Lewis dot diagram for phosphorus (P)?',
    '["3","15","8","5"]'::jsonb,
    3, 7),
  ('lewis_diagram', 'ldq-dots-sulfur',
    'How many dots are in the Lewis dot diagram for sulfur (S)?',
    '["6","16","2","8"]'::jsonb,
    0, 8),
  ('lewis_diagram', 'ldq-dots-fluorine',
    'How many dots are in the Lewis dot diagram for fluorine (F)?',
    '["9","1","7","2"]'::jsonb,
    2, 9),
  ('lewis_diagram', 'ldq-dots-neon',
    'How many dots are in the Lewis dot diagram for neon (Ne)?',
    '["10","8","2","0"]'::jsonb,
    1, 10),
  ('lewis_diagram', 'ldq-dots-helium',
    'How many dots are in the Lewis dot diagram for helium (He)?',
    '["8","4","2","1"]'::jsonb,
    2, 11),
  ('lewis_diagram', 'ldq-dots-calcium',
    'How many dots are in the Lewis dot diagram for calcium (Ca)?',
    '["2","20","8","4"]'::jsonb,
    0, 12),
  ('lewis_diagram', 'ldq-shells-to-dots',
    'An atom has the electron arrangement 2, 8, 5. How many dots does its Lewis dot diagram show?',
    '["15","2","8","5"]'::jsonb,
    3, 13),
  ('lewis_diagram', 'ldq-identify-chlorine',
    'A period 3 element has 7 dots in its Lewis dot diagram. Which element is it?',
    '["Fluorine","Chlorine","Sulfur","Argon"]'::jsonb,
    1, 14),
  ('lewis_diagram', 'ldq-same-as-hydrogen',
    'Which element has the same number of dots in its Lewis dot diagram as hydrogen?',
    '["Helium","Carbon","Potassium","Neon"]'::jsonb,
    2, 15),
  ('lewis_diagram', 'ldq-same-group-np',
    'Nitrogen and phosphorus both have 5 dots in their Lewis dot diagrams. Why?',
    '["They are in the same group","They are in the same period","They have the same number of protons","They have the same number of electron shells"]'::jsonb,
    0, 16),
  ('lewis_diagram', 'ldq-unpaired-nitrogen',
    'In the Lewis dot diagram for nitrogen (N), how many dots are unpaired?',
    '["1","5","2","3"]'::jsonb,
    3, 17),
  ('lewis_diagram', 'ldq-unpaired-oxygen',
    'In the Lewis dot diagram for oxygen (O), how many dots are unpaired?',
    '["2","6","4","0"]'::jsonb,
    0, 18),
  ('lewis_diagram', 'ldq-pairs-carbon',
    'In the Lewis dot diagram for carbon (C), how many pairs of dots are there?',
    '["2","0","4","1"]'::jsonb,
    1, 19),
  ('lewis_diagram', 'ldq-period-trend',
    'Moving left to right across period 2 from lithium to neon, how does the number of dots in each Lewis dot diagram change?',
    '["It decreases by one each step","It stays the same","It increases by one each step","It doubles each step"]'::jsonb,
    2, 20),
  ('lewis_diagram', 'ldq-max-dots',
    'What is the greatest number of dots any element from hydrogen to calcium shows in its Lewis dot diagram?',
    '["2","4","18","8"]'::jsonb,
    3, 21)
ON CONFLICT (quiz_key, question_key) DO NOTHING;

-- Bind the new key to lewis_diagram assignments in the trusted quiz RPCs.
-- The rewrite keeps every other check of the deployed definitions (verified
-- student, active class, own class, unarchived assignment, opens_at and
-- closes_at), so pending, wrong-class, unassigned, scheduled and closed
-- access are refused exactly as for the other Lewis quizzes.
DO $$
DECLARE
  item record;
  original_definition text;
  updated_definition text;
  missing text;
BEGIN
  FOR item IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('student_quiz_start', 'student_quiz_retry_start', 'student_quiz_submit')
  LOOP
    original_definition := pg_get_functiondef(item.oid);
    IF position('''lewis_diagram'' AND a.type::text' IN original_definition) > 0 THEN
      CONTINUE;
    END IF;
    updated_definition := replace(
      original_definition,
      '(p_quiz_key = ''lewis_ionic'' AND a.type::text = ''lewis_structures_ionic'')',
      '(p_quiz_key = ''lewis_ionic'' AND a.type::text = ''lewis_structures_ionic'') OR (p_quiz_key = ''lewis_diagram'' AND a.type::text = ''lewis_diagram'')'
    );
    IF updated_definition <> original_definition THEN
      EXECUTE updated_definition;
    END IF;
  END LOOP;

  SELECT string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ')
    INTO missing
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('student_quiz_start', 'student_quiz_retry_start', 'student_quiz_submit')
    AND position('lewis_ionic' IN pg_get_functiondef(p.oid)) > 0
    AND position('''lewis_diagram'' AND a.type::text' IN pg_get_functiondef(p.oid)) = 0;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'lewis_diagram quiz binding was not added to: %', missing;
  END IF;

  -- Grade lewis_diagram by its quiz in the shared progress state, so the
  -- teacher's class progress and detailed results show Taking quiz, Needs
  -- retry and Completed for it like the other quizzed lessons.
  FOR item IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'assignment_progress_state'
  LOOP
    original_definition := pg_get_functiondef(item.oid);
    IF position('WHEN ''lewis_diagram'' THEN' IN original_definition) > 0 THEN
      CONTINUE;
    END IF;
    updated_definition := replace(
      original_definition,
      'WHEN ''lewis_structures_ionic'' THEN ARRAY[''lewis_ionic'']',
      'WHEN ''lewis_structures_ionic'' THEN ARRAY[''lewis_ionic'']
    WHEN ''lewis_diagram'' THEN ARRAY[''lewis_diagram'']'
    );
    IF updated_definition = original_definition THEN
      RAISE EXCEPTION 'assignment_progress_state: lewis_structures_ionic mapping not found';
    END IF;
    EXECUTE updated_definition;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'assignment_progress_state'
      AND position('WHEN ''lewis_diagram'' THEN' IN pg_get_functiondef(p.oid)) > 0
  ) THEN
    RAISE EXCEPTION 'assignment_progress_state does not map lewis_diagram to its quiz';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assignment_progress_state(uuid, text) IS
  'Shared assignment status and stage. Quizzed lessons, including the Lewis dot diagram since SCRUM-234, complete once their own quiz is passed.';

-- Like the other assignment-gated quizzes, the lewis_diagram pool (and its
-- answers) is read only by the server with the service-role client. The list
-- keeps every pool hidden by 20261104000300, including the split Bohr pools.
DROP POLICY IF EXISTS "chemclicks_quiz_questions_select_active" ON public.quiz_questions;
CREATE POLICY "chemclicks_quiz_questions_select_active"
  ON public.quiz_questions
  FOR SELECT
  TO authenticated
  USING (
    is_active
    AND quiz_key NOT IN (
      'bohr_models', 'bohr_model_intro', 'bohr_model_stability',
      'lewis_bonding', 'lewis_covalent', 'lewis_ionic', 'lewis_diagram'
    )
  );

COMMENT ON POLICY "chemclicks_quiz_questions_select_active" ON public.quiz_questions IS
  'Authenticated users may read active questions except assignment-gated Bohr (legacy and split) and Lewis pools, including the Lewis dot diagram pool. Those questions are loaded by the server after an assignment check. Question writes require a privileged server/admin client.';

NOTIFY pgrst, 'reload schema';
COMMIT;
