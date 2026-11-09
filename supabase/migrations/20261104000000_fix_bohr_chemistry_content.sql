-- Correct the Bohr Stability quiz's ion terminology and silicon example.

BEGIN;

UPDATE public.quiz_questions
SET question = 'A chloride ion has 17 protons and a -1 charge. How many electrons does it have?'
WHERE quiz_key = 'bohr_model_stability'
  AND question_key = 'bohr-stability-chloride-count';

UPDATE public.quiz_questions
SET question = 'A silicon atom has 14 protons and 18 electrons, matching the simplified silicide example. What is its charge?',
    correct_index = 1
WHERE quiz_key = 'bohr_model_stability'
  AND question_key = 'bohr-stability-silicon-charge';

COMMIT;
