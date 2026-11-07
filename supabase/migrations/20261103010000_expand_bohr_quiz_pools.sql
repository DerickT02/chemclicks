-- Expand both lesson-specific Bohr quiz pools to 36 questions.
-- Apply after 20261103000000_split_bohr_quizzes.sql.

BEGIN;

-- The original Bohr bank contains 36 introduction questions. The split
-- migration copied the first 12; this is idempotent and fills the remaining
-- rows while preserving their original order and answers.
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
ON CONFLICT (quiz_key, question_key) DO NOTHING;

INSERT INTO public.quiz_questions
  (quiz_key, question_key, question, options, correct_index, order_index)
VALUES
  ('bohr_model_stability', 'bohr-stability-neutral-oxygen', 'An atom has 8 protons and 8 electrons. What is its charge?', '["+1","0","-1","+2"]'::jsonb, 1, 13),
  ('bohr_model_stability', 'bohr-stability-chloride-count', 'A chlorine ion has 17 protons and a -1 charge. How many electrons does it have?', '["16","17","18","19"]'::jsonb, 2, 14),
  ('bohr_model_stability', 'bohr-stability-aluminum-charge', 'An atom has 13 protons and 10 electrons. What is its charge?', '["+1","+2","-3","+3"]'::jsonb, 3, 15),
  ('bohr_model_stability', 'bohr-stability-neon-shells', 'Which shell arrangement represents 10 electrons in a stable noble-gas pattern?', '["2, 8","2, 6, 2","8, 2","10"]'::jsonb, 0, 16),
  ('bohr_model_stability', 'bohr-stability-magnesium-ion', 'A magnesium atom has 12 protons and forms a +2 ion. How many electrons remain?', '["10","12","14","2"]'::jsonb, 0, 17),
  ('bohr_model_stability', 'bohr-stability-oxide-charge', 'An atom has 8 protons and 10 electrons. What is its charge?', '["+2","-2","0","-1"]'::jsonb, 1, 18),
  ('bohr_model_stability', 'bohr-stability-noble-shells', 'Which electron count is a noble-gas count for the first 20 elements?', '["7","9","18","19"]'::jsonb, 2, 19),
  ('bohr_model_stability', 'bohr-stability-argon-arrangement', 'What shell arrangement shows 18 electrons?', '["2, 8, 8","2, 8, 6, 2","8, 8, 2","2, 16"]'::jsonb, 0, 20),
  ('bohr_model_stability', 'bohr-stability-calcium-arrangement', 'What shell arrangement shows 20 electrons for the first 20 elements?', '["2, 8, 10","2, 8, 8, 2","2, 18","8, 8, 4"]'::jsonb, 1, 21),
  ('bohr_model_stability', 'bohr-stability-proton-identity', 'Changing the number of protons changes the atom''s:', '["element identity","electron charge","shell capacity only","number of quizzes"]'::jsonb, 0, 22),
  ('bohr_model_stability', 'bohr-stability-electron-identity', 'Changing only the number of electrons changes the atom''s:', '["element identity","ionic charge","number of protons","atomic number"]'::jsonb, 1, 23),
  ('bohr_model_stability', 'bohr-stability-remove-electron', 'Removing an electron from a neutral atom generally creates a:', '["cation","neutron","noble gas","new element"]'::jsonb, 0, 24),
  ('bohr_model_stability', 'bohr-stability-add-electron', 'Adding an electron to a neutral atom generally creates an:', '["anion","isotope","proton","uncharged nucleus"]'::jsonb, 0, 25),
  ('bohr_model_stability', 'bohr-stability-duet-count', 'Which electron count fills the first shell?', '["1","2","4","8"]'::jsonb, 1, 26),
  ('bohr_model_stability', 'bohr-stability-octet-count', 'Which electron count represents a filled 2, 8 arrangement?', '["8","10","16","18"]'::jsonb, 1, 27),
  ('bohr_model_stability', 'bohr-stability-particle-neutral', 'Which particle relationship describes a neutral atom?', '["protons equal electrons","protons exceed electrons","electrons exceed protons","there are no protons"]'::jsonb, 0, 28),
  ('bohr_model_stability', 'bohr-stability-charge-equation', 'Which equation gives ionic charge?', '["electrons minus protons","protons minus electrons","protons plus electrons","electrons divided by protons"]'::jsonb, 1, 29),
  ('bohr_model_stability', 'bohr-stability-phosphide-charge', 'An atom has 15 protons and 18 electrons. What is its charge?', '["+3","-3","+2","0"]'::jsonb, 1, 30),
  ('bohr_model_stability', 'bohr-stability-sodium-charge', 'An atom has 11 protons and 10 electrons. What is its charge?', '["-1","0","+1","+2"]'::jsonb, 2, 31),
  ('bohr_model_stability', 'bohr-stability-potassium-charge', 'An atom has 19 protons and 18 electrons. What is its charge?', '["+1","-1","+2","0"]'::jsonb, 0, 32),
  ('bohr_model_stability', 'bohr-stability-fluoride-charge', 'An atom has 9 protons and 10 electrons. What is its charge?', '["+1","0","-1","-2"]'::jsonb, 2, 33),
  ('bohr_model_stability', 'bohr-stability-carbon-charge', 'An atom has 6 protons and 10 electrons. What is its charge?', '["+4","-4","-2","0"]'::jsonb, 1, 34),
  ('bohr_model_stability', 'bohr-stability-nitride-charge', 'An atom has 7 protons and 10 electrons. What is its charge?', '["+3","-3","-2","0"]'::jsonb, 1, 35),
  ('bohr_model_stability', 'bohr-stability-silicon-charge', 'An atom has 14 protons and 10 electrons. What is its charge?', '["+4","-4","+2","0"]'::jsonb, 0, 36)
ON CONFLICT (quiz_key, question_key) DO NOTHING;

COMMIT;
