-- Run only on a disposable test database after
-- 20261104000300_fix_bohr_quiz_access_and_progress_history.sql is applied there.
-- These fixtures WRITE and roll back; they are not part of npm test.
BEGIN;

DO $$
DECLARE
  marker text := 'review-' || gen_random_uuid()::text;
  public_quiz text := 'review_public_' || replace(gen_random_uuid()::text, '-', '_');
  protected_keys text[] := ARRAY[
    'bohr_models', 'bohr_model_intro', 'bohr_model_stability',
    'lewis_bonding', 'lewis_covalent', 'lewis_ionic'
  ];
  visible_count integer;
BEGIN
  -- Explicit active rows make the denial assertions non-vacuous, even if a
  -- pool has not been seeded or its existing questions are inactive.
  INSERT INTO public.quiz_questions(quiz_key, question_key, question, options, correct_index)
    SELECT quiz_key, marker, 'RLS fixture?', '["a","b"]'::jsonb, 1
    FROM unnest(protected_keys) AS keys(quiz_key);
  INSERT INTO public.quiz_questions(quiz_key, question_key, question, options, correct_index, is_active)
    VALUES
      (public_quiz, marker, 'Visible fixture?', '["a","b"]'::jsonb, 0, true),
      (public_quiz, marker || '-inactive', 'Hidden fixture?', '["a","b"]'::jsonb, 1, false);

  SET LOCAL ROLE service_role;
  SELECT count(correct_index) INTO visible_count FROM public.quiz_questions
    WHERE question_key = marker AND quiz_key = ANY (protected_keys);
  IF visible_count IS DISTINCT FROM cardinality(protected_keys) THEN
    RAISE EXCEPTION 'The server must still read every protected answer-key fixture';
  END IF;
  RESET ROLE;

  SET LOCAL ROLE authenticated;
  SELECT count(correct_index) INTO visible_count FROM public.quiz_questions
    WHERE question_key = marker AND quiz_key = ANY (protected_keys);
  IF visible_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Authenticated client read % protected answer keys', visible_count;
  END IF;
  SELECT count(correct_index) INTO visible_count FROM public.quiz_questions WHERE quiz_key = public_quiz;
  IF visible_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Ordinary active questions must remain readable and inactive ones hidden';
  END IF;
  RESET ROLE;

  SET LOCAL ROLE anon;
  BEGIN
    PERFORM correct_index FROM public.quiz_questions WHERE question_key = marker;
    RAISE EXCEPTION 'Anonymous question read allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
END $$;

SELECT 'PASS: split/legacy Bohr and Lewis answer-key denial, service access, public active-only reads and anonymous denial' AS result;
ROLLBACK;
