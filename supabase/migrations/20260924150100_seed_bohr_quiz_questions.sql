-- Seed the Bohr Models quiz questions (moved out of the static config file
-- src/components/quiz/bohr/questions.ts into public.quiz_questions).
-- Generated from that config, so the 36 questions, options, answer indexes and order
-- are copied exactly. Safe to re-run: existing (quiz_key, question_key) rows are left alone.
-- Apply in Supabase: SQL Editor → New query → paste → Run
-- (Apply 20260924150000_quiz_questions.sql first.)

begin;

insert into public.quiz_questions
  (quiz_key, question_key, question, options, correct_index, order_index)
values
    ('bohr_models', 'bohr-beryllium-shells', 'Beryllium (atomic number 4) has which electron shell distribution?', '["4","2, 1","2, 2","1, 3"]'::jsonb, 2, 1),
    ('bohr_models', 'bohr-boron-outer', 'Boron (atomic number 5) has how many electrons in its outermost shell?', '["2","5","8","3"]'::jsonb, 3, 2),
    ('bohr_models', 'bohr-identify-carbon', 'A neutral atom has the electron shell distribution 2, 4. Which element is it?', '["Oxygen","Boron","Carbon","Nitrogen"]'::jsonb, 2, 3),
    ('bohr_models', 'bohr-oxygen-shells', 'Oxygen (atomic number 8) has which electron shell distribution?', '["8","2, 4","2, 8","2, 6"]'::jsonb, 3, 4),
    ('bohr_models', 'bohr-aluminum-shells', 'Aluminum (atomic number 13) has which electron shell distribution?', '["2, 8, 2","2, 8, 4","2, 8, 3","2, 11"]'::jsonb, 2, 5),
    ('bohr_models', 'bohr-identify-silicon', 'A neutral atom has 14 electrons. Which element is it?', '["Aluminum","Phosphorus","Sulfur","Silicon"]'::jsonb, 3, 6),
    ('bohr_models', 'bohr-phosphorus-outer', 'Phosphorus (atomic number 15) has how many electrons in its outermost shell?', '["3","8","5","15"]'::jsonb, 2, 7),
    ('bohr_models', 'bohr-argon-outer', 'Argon (atomic number 18) has how many electrons in its outermost shell?', '["2","18","6","8"]'::jsonb, 3, 8),
    ('bohr_models', 'bohr-protons-location', 'Where are protons located in a Bohr model?', '["In the shells","In the nucleus","Orbiting the nucleus","Outside the atom"]'::jsonb, 1, 9),
    ('bohr_models', 'bohr-electrons-location', 'Where are electrons located in a Bohr model?', '["Only in the nucleus","In shells around the nucleus","Between protons and neutrons","Randomly throughout the atom"]'::jsonb, 1, 10),
    ('bohr_models', 'bohr-neutral-electron-count', 'In a neutral atom, the number of electrons equals the number of:', '["Neutrons","Protons","Shells","Valence pairs"]'::jsonb, 1, 11),
    ('bohr_models', 'bohr-atomic-number-means', 'The atomic number of an element tells you the number of:', '["Neutrons only","Protons in the nucleus","Electron shells always filled","Molecules it can form"]'::jsonb, 1, 12),
    ('bohr_models', 'bohr-first-shell', 'How many electrons can the first shell hold for elements 1–20?', '["8","2","18","4"]'::jsonb, 1, 13),
    ('bohr_models', 'bohr-second-shell-capacity', 'How many electrons can the second shell hold?', '["2","8","18","20"]'::jsonb, 1, 14),
    ('bohr_models', 'bohr-third-shell-capacity', 'For elements 1–20, how many electrons can the third shell hold before the fourth shell starts filling?', '["2","8","18","20"]'::jsonb, 1, 15),
    ('bohr_models', 'bohr-calcium-shells', 'A neutral calcium atom (atomic number 20) has which electron shell distribution?', '["2, 8, 18, 8","2, 8, 8, 2","8, 8, 2, 2","2, 2, 8, 8"]'::jsonb, 1, 16),
    ('bohr_models', 'bohr-identify-hydrogen', 'Which element has exactly 1 electron in a neutral Bohr model?', '["Helium","Hydrogen","Lithium","Neon"]'::jsonb, 1, 17),
    ('bohr_models', 'bohr-identify-helium', 'A neutral atom with shell distribution 2 is which element?', '["Hydrogen","Helium","Lithium","Beryllium"]'::jsonb, 1, 18),
    ('bohr_models', 'bohr-lithium-shells', 'Lithium (atomic number 3) has which electron shell distribution?', '["3","2, 1","1, 2","2, 8"]'::jsonb, 1, 19),
    ('bohr_models', 'bohr-carbon-second-shell', 'Carbon (atomic number 6) has how many electrons in its second shell?', '["2","4","6","8"]'::jsonb, 1, 20),
    ('bohr_models', 'bohr-nitrogen-shells', 'Nitrogen (atomic number 7) has which electron shell distribution?', '["2, 5","2, 8","7","2, 4, 1"]'::jsonb, 0, 21),
    ('bohr_models', 'bohr-oxygen-electron-count', 'A neutral oxygen atom (atomic number 8) has how many electrons?', '["6","8","16","2"]'::jsonb, 1, 22),
    ('bohr_models', 'bohr-fluorine-valence', 'Fluorine (atomic number 9) has how many electrons in its outer shell?', '["2","7","9","8"]'::jsonb, 1, 23),
    ('bohr_models', 'bohr-identify-neon', 'A neutral atom has the electron shell distribution 2, 8. Which element is it?', '["Oxygen","Neon","Sodium","Fluorine"]'::jsonb, 1, 24),
    ('bohr_models', 'bohr-identify-sodium', 'A neutral atom has the electron shell distribution 2, 8, 1. Which element is it?', '["Neon","Sodium","Magnesium","Fluorine"]'::jsonb, 1, 25),
    ('bohr_models', 'bohr-magnesium-shells', 'Magnesium (atomic number 12) has which electron shell distribution?', '["2, 8, 2","2, 10","2, 8, 1","12"]'::jsonb, 0, 26),
    ('bohr_models', 'bohr-aluminum-electron-count', 'A neutral aluminum atom (atomic number 13) has how many electrons?', '["3","13","26","8"]'::jsonb, 1, 27),
    ('bohr_models', 'bohr-silicon-outer', 'Silicon (atomic number 14) has how many electrons in its outer shell?', '["2","4","8","14"]'::jsonb, 1, 28),
    ('bohr_models', 'bohr-identify-phosphorus', 'A neutral atom has the electron shell distribution 2, 8, 5. Which element is it?', '["Aluminum","Phosphorus","Sulfur","Chlorine"]'::jsonb, 1, 29),
    ('bohr_models', 'bohr-sulfur-shells', 'Sulfur (atomic number 16) has which electron shell distribution?', '["2, 8, 6","2, 8, 8","2, 14","8, 8"]'::jsonb, 0, 30),
    ('bohr_models', 'bohr-chlorine-shells', 'Chlorine (atomic number 17) has which electron shell distribution?', '["2, 8, 7","2, 8, 8","2, 15","8, 8, 1"]'::jsonb, 0, 31),
    ('bohr_models', 'bohr-argon-shells', 'Argon (atomic number 18) has which electron shell distribution?', '["2, 8, 6","2, 8, 8","2, 8, 8, 2","2, 16"]'::jsonb, 1, 32),
    ('bohr_models', 'bohr-potassium-shells', 'Potassium (atomic number 19) has which electron shell distribution?', '["2, 8, 9","2, 8, 8, 1","2, 8, 8","19"]'::jsonb, 1, 33),
    ('bohr_models', 'bohr-identify-calcium', 'A neutral atom has 20 electrons with shell distribution 2, 8, 8, 2. Which element is it?', '["Potassium","Calcium","Argon","Magnesium"]'::jsonb, 1, 34),
    ('bohr_models', 'bohr-calcium-outer', 'Calcium (atomic number 20) has how many electrons in its outermost shell?', '["8","2","20","10"]'::jsonb, 1, 35),
    ('bohr_models', 'bohr-which-fills-first', 'In the Bohr model for elements 1–20, which shell fills first?', '["The outermost shell","The shell closest to the nucleus","The third shell","All shells fill at the same time"]'::jsonb, 1, 36)
on conflict (quiz_key, question_key) do nothing;

commit;
