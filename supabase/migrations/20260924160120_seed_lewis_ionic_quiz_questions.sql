-- Seed the Lewis Structures ionic compounds quiz questions.
-- Fundamentals and ionic questions are copied from the retired combined
-- lewis_bonding pool (same question keys), plus new ionic questions.
-- Safe to re-run: existing (quiz_key, question_key) rows are left alone.
-- Apply in Supabase: SQL Editor → New query → paste → Run
-- (Apply 20260924150000_quiz_questions.sql first.)

begin;

insert into public.quiz_questions
  (quiz_key, question_key, question, options, correct_index, order_index)
values
    ('lewis_ionic', 'lewis-valence-location', 'Valence electrons are the electrons located in an atom''s:', '["Outermost shell","Innermost shell","Nucleus","Second shell only"]'::jsonb, 0, 1),
    ('lewis_ionic', 'lewis-valence-chlorine', 'How many valence electrons does a neutral chlorine atom (atomic number 17) have?', '["1","17","7","8"]'::jsonb, 2, 2),
    ('lewis_ionic', 'lewis-valence-magnesium', 'How many valence electrons does a neutral magnesium atom (atomic number 12) have?', '["2","12","8","10"]'::jsonb, 0, 3),
    ('lewis_ionic', 'lewis-valence-sulfur', 'How many valence electrons does a neutral sulfur atom (atomic number 16) have?', '["2","4","8","6"]'::jsonb, 3, 4),
    ('lewis_ionic', 'lewis-valence-potassium', 'How many valence electrons does a neutral potassium atom (atomic number 19) have?', '["1","9","19","8"]'::jsonb, 0, 5),
    ('lewis_ionic', 'lewis-dots-show', 'A Lewis dot diagram shows which electrons around the symbol?', '["All of the atom''s electrons","Only the inner-shell electrons","Only the valence electrons","Only paired electrons"]'::jsonb, 2, 6),
    ('lewis_ionic', 'lewis-dots-phosphorus', 'How many dots appear around the symbol in the Lewis dot diagram for a neutral phosphorus atom (atomic number 15)?', '["3","15","5","8"]'::jsonb, 2, 7),
    ('lewis_ionic', 'lewis-dots-identify-aluminum', 'A neutral atom''s Lewis dot diagram has 3 dots. Which of these elements could it be?', '["Carbon","Aluminum","Nitrogen","Magnesium"]'::jsonb, 1, 8),
    ('lewis_ionic', 'lewis-octet-rule', 'The octet rule says that atoms tend to:', '["Gain, lose, or share electrons to have 8 valence electrons","Always have 8 protons","Lose all of their valence electrons","Keep exactly 8 electron shells"]'::jsonb, 0, 9),
    ('lewis_ionic', 'lewis-ionic-definition', 'An ionic bond is the attraction between:', '["Two atoms sharing electrons","Oppositely charged ions","Two positively charged ions","Two neutral noble-gas atoms"]'::jsonb, 1, 10),
    ('lewis_ionic', 'lewis-ionic-between', 'Ionic compounds usually form between:', '["Two nonmetals","Two noble gases","A metal and a nonmetal","Two hydrogen atoms"]'::jsonb, 2, 11),
    ('lewis_ionic', 'lewis-metals-lose-electrons', 'When forming ionic compounds, metal atoms tend to:', '["Gain electrons and become negative ions","Share electrons with other metals","Lose electrons and become positive ions","Keep all of their valence electrons"]'::jsonb, 2, 12),
    ('lewis_ionic', 'lewis-nonmetals-gain-electrons', 'When forming ionic compounds, nonmetal atoms tend to:', '["Gain electrons and become negative ions","Lose electrons and become positive ions","Lose all of their protons","Share electrons with metal atoms"]'::jsonb, 0, 13),
    ('lewis_ionic', 'lewis-cation-definition', 'A cation is an ion that:', '["Has a positive net charge","Has a negative net charge","Has no net charge","Always contains more neutrons than protons"]'::jsonb, 0, 14),
    ('lewis_ionic', 'lewis-anion-definition', 'An anion is an ion that:', '["Has a positive net charge","Has a negative net charge","Has no net charge","Always has more protons than electrons"]'::jsonb, 1, 15),
    ('lewis_ionic', 'lewis-sodium-ion', 'Sodium most commonly forms which ion?', '["Na⁻","Na²⁺","Na⁺","Na²⁻"]'::jsonb, 2, 16),
    ('lewis_ionic', 'lewis-chloride-ion', 'Chlorine most commonly forms which ion?', '["Cl⁺","Cl⁻","Cl²⁻","Cl⁷⁺"]'::jsonb, 1, 17),
    ('lewis_ionic', 'lewis-magnesium-ion', 'Magnesium most commonly forms which ion?', '["Mg⁺","Mg²⁻","Mg⁻","Mg²⁺"]'::jsonb, 3, 18),
    ('lewis_ionic', 'lewis-calcium-ion', 'Calcium (atomic number 20) most commonly forms which ion?', '["Ca⁺","Ca²⁻","Ca²⁺","Ca⁻"]'::jsonb, 2, 19),
    ('lewis_ionic', 'lewis-aluminum-ion', 'Aluminum (atomic number 13) most commonly forms which ion?', '["Al⁺","Al³⁻","Al²⁺","Al³⁺"]'::jsonb, 3, 20),
    ('lewis_ionic', 'lewis-oxide-ion', 'Oxygen most commonly forms which ion?', '["O²⁻","O²⁺","O⁻","O⁶⁺"]'::jsonb, 0, 21),
    ('lewis_ionic', 'lewis-sodium-ion-like-neon', 'After a sodium atom loses one electron to form Na⁺, its electron arrangement matches which noble gas?', '["Helium","Argon","Neon","Krypton"]'::jsonb, 2, 22),
    ('lewis_ionic', 'lewis-chloride-dots-nacl', 'In the Lewis structure of sodium chloride (NaCl), how many dots are shown around the chloride ion (Cl⁻)?', '["8","7","1","0"]'::jsonb, 0, 23),
    ('lewis_ionic', 'lewis-ionic-net-charge', 'The overall net charge of an ionic compound is:', '["Always positive","Always negative","Equal to the metal ion''s charge","Zero"]'::jsonb, 3, 24),
    ('lewis_ionic', 'lewis-kbr-ratio', 'In potassium bromide (KBr), the ratio of K⁺ ions to Br⁻ ions is:', '["2 : 1","1 : 1","1 : 2","3 : 1"]'::jsonb, 1, 25),
    ('lewis_ionic', 'lewis-formula-mgcl2', 'What is the formula of the ionic compound formed from Mg²⁺ and Cl⁻ ions?', '["MgCl","MgCl₂","Mg₂Cl","Mg₂Cl₃"]'::jsonb, 1, 26),
    ('lewis_ionic', 'lewis-formula-caf2', 'What is the formula of the ionic compound formed from calcium and fluorine?', '["CaF₂","CaF","Ca₂F","CaF₃"]'::jsonb, 0, 27),
    ('lewis_ionic', 'lewis-formula-na2o', 'What is the formula of the ionic compound formed from Na⁺ and O²⁻ ions?', '["NaO","NaO₂","Na₂O₃","Na₂O"]'::jsonb, 3, 28),
    ('lewis_ionic', 'lewis-formula-al2o3', 'What is the formula of the ionic compound formed from Al³⁺ and O²⁻ ions?', '["AlO","Al₃O₂","AlO₃","Al₂O₃"]'::jsonb, 3, 29)
on conflict (quiz_key, question_key) do nothing;

commit;
