-- Seed the Lewis Structures & Bonding quiz questions (moved out of the static config file
-- src/components/quiz/lewis/questions.ts into public.quiz_questions).
-- Generated from that config, so the 38 questions, options, answer indexes and order
-- are copied exactly. Safe to re-run: existing (quiz_key, question_key) rows are left alone.
-- Apply in Supabase: SQL Editor → New query → paste → Run
-- (Apply 20260924150000_quiz_questions.sql first; independent of the Bohr seed.)

begin;

insert into public.quiz_questions
  (quiz_key, question_key, question, options, correct_index, order_index)
values
    ('lewis_bonding', 'lewis-valence-location', 'Valence electrons are the electrons located in an atom''s:', '["Outermost shell","Innermost shell","Nucleus","Second shell only"]'::jsonb, 0, 1),
    ('lewis_bonding', 'lewis-valence-nitrogen', 'How many valence electrons does a neutral nitrogen atom have?', '["3","5","7","2"]'::jsonb, 1, 2),
    ('lewis_bonding', 'lewis-valence-chlorine', 'How many valence electrons does a neutral chlorine atom (atomic number 17) have?', '["1","17","7","8"]'::jsonb, 2, 3),
    ('lewis_bonding', 'lewis-valence-magnesium', 'How many valence electrons does a neutral magnesium atom (atomic number 12) have?', '["2","12","8","10"]'::jsonb, 0, 4),
    ('lewis_bonding', 'lewis-valence-sulfur', 'How many valence electrons does a neutral sulfur atom (atomic number 16) have?', '["2","4","8","6"]'::jsonb, 3, 5),
    ('lewis_bonding', 'lewis-valence-potassium', 'How many valence electrons does a neutral potassium atom (atomic number 19) have?', '["1","9","19","8"]'::jsonb, 0, 6),
    ('lewis_bonding', 'lewis-valence-same-group', 'With the exception of helium, main-group elements in the same group (column) generally have the same number of:', '["Protons","Valence electrons","Neutrons","Electron shells"]'::jsonb, 1, 7),
    ('lewis_bonding', 'lewis-dots-show', 'A Lewis dot diagram shows which electrons around the symbol?', '["All of the atom''s electrons","Only the inner-shell electrons","Only the valence electrons","Only paired electrons"]'::jsonb, 2, 8),
    ('lewis_bonding', 'lewis-dot-placement', 'When drawing a Lewis dot diagram, where are the valence-electron dots placed?', '["Inside the element symbol","Around the four sides of the element symbol","Inside the nucleus","In numbered electron shells"]'::jsonb, 1, 9),
    ('lewis_bonding', 'lewis-dot-pairing', 'When drawing a Lewis dot diagram, what is generally done before electrons are paired on the same side?', '["One electron is placed on each available side","All electrons are placed on the same side","Two electrons are placed inside the symbol","The element''s protons are counted"]'::jsonb, 0, 10),
    ('lewis_bonding', 'lewis-dots-oxygen', 'How many dots appear around the symbol in the Lewis dot diagram for a neutral oxygen atom?', '["2","8","4","6"]'::jsonb, 3, 11),
    ('lewis_bonding', 'lewis-dots-carbon', 'How many dots appear around the symbol in the Lewis dot diagram for a neutral carbon atom?', '["4","6","2","12"]'::jsonb, 0, 12),
    ('lewis_bonding', 'lewis-dots-phosphorus', 'How many dots appear around the symbol in the Lewis dot diagram for a neutral phosphorus atom (atomic number 15)?', '["3","15","5","8"]'::jsonb, 2, 13),
    ('lewis_bonding', 'lewis-dots-identify-aluminum', 'A neutral atom''s Lewis dot diagram has 3 dots. Which of these elements could it be?', '["Carbon","Aluminum","Nitrogen","Magnesium"]'::jsonb, 1, 14),
    ('lewis_bonding', 'lewis-octet-rule', 'The octet rule says that atoms tend to:', '["Gain, lose, or share electrons to have 8 valence electrons","Always have 8 protons","Lose all of their valence electrons","Keep exactly 8 electron shells"]'::jsonb, 0, 15),
    ('lewis_bonding', 'lewis-hydrogen-duet', 'When hydrogen forms a bond, how many electrons does it need in its outer shell to be stable?', '["8","1","2","4"]'::jsonb, 2, 16),
    ('lewis_bonding', 'lewis-covalent-definition', 'In a covalent bond, electrons are:', '["Transferred from one atom to another","Shared between atoms","Removed from both atoms","Moved into the nucleus"]'::jsonb, 1, 17),
    ('lewis_bonding', 'lewis-covalent-between', 'Covalent bonds most commonly form between:', '["Two nonmetals","A metal and a nonmetal","Two metals","Two noble gases"]'::jsonb, 0, 18),
    ('lewis_bonding', 'lewis-single-bond-electrons', 'A single covalent bond is made of how many shared electrons?', '["1","4","6","2"]'::jsonb, 3, 19),
    ('lewis_bonding', 'lewis-double-bond-electrons', 'A double covalent bond is made of how many shared electrons?', '["2","4","6","8"]'::jsonb, 1, 20),
    ('lewis_bonding', 'lewis-n2-bond', 'The two atoms in a nitrogen molecule (N₂) are joined by a:', '["Single bond","Double bond","Triple bond","Ionic bond"]'::jsonb, 2, 21),
    ('lewis_bonding', 'lewis-co2-bonds', 'In carbon dioxide (CO₂), carbon is bonded to each oxygen atom by a:', '["Double bond","Single bond","Triple bond","Ionic bond"]'::jsonb, 0, 22),
    ('lewis_bonding', 'lewis-ch4-bonds', 'In methane (CH₄), how many single covalent bonds does the carbon atom form?', '["2","3","1","4"]'::jsonb, 3, 23),
    ('lewis_bonding', 'lewis-water-lone-pairs', 'In the Lewis structure of water (H₂O), how many lone pairs are on the oxygen atom?', '["0","1","2","4"]'::jsonb, 2, 24),
    ('lewis_bonding', 'lewis-ammonia-lone-pairs', 'In the Lewis structure of ammonia (NH₃), how many lone pairs are on the nitrogen atom?', '["1","0","2","3"]'::jsonb, 0, 25),
    ('lewis_bonding', 'lewis-lone-pair-definition', 'A lone pair in a Lewis structure is:', '["A pair of electrons shared between two atoms","A pair of valence electrons not involved in bonding","A single unpaired electron","A pair of protons in the nucleus"]'::jsonb, 1, 26),
    ('lewis_bonding', 'lewis-ionic-definition', 'An ionic bond is the attraction between:', '["Two atoms sharing electrons","Oppositely charged ions","Two positively charged ions","Two neutral noble-gas atoms"]'::jsonb, 1, 27),
    ('lewis_bonding', 'lewis-ionic-between', 'Ionic compounds usually form between:', '["Two nonmetals","Two noble gases","A metal and a nonmetal","Two hydrogen atoms"]'::jsonb, 2, 28),
    ('lewis_bonding', 'lewis-cation-definition', 'A cation is an ion that:', '["Has a positive net charge","Has a negative net charge","Has no net charge","Always contains more neutrons than protons"]'::jsonb, 0, 29),
    ('lewis_bonding', 'lewis-sodium-ion', 'Sodium most commonly forms which ion?', '["Na⁻","Na²⁺","Na⁺","Na²⁻"]'::jsonb, 2, 30),
    ('lewis_bonding', 'lewis-chloride-ion', 'Chlorine most commonly forms which ion?', '["Cl⁺","Cl⁻","Cl²⁻","Cl⁷⁺"]'::jsonb, 1, 31),
    ('lewis_bonding', 'lewis-magnesium-ion', 'Magnesium most commonly forms which ion?', '["Mg⁺","Mg²⁻","Mg⁻","Mg²⁺"]'::jsonb, 3, 32),
    ('lewis_bonding', 'lewis-oxide-ion', 'Oxygen most commonly forms which ion?', '["O²⁻","O²⁺","O⁻","O⁶⁺"]'::jsonb, 0, 33),
    ('lewis_bonding', 'lewis-sodium-ion-like-neon', 'After a sodium atom loses one electron to form Na⁺, its electron arrangement matches which noble gas?', '["Helium","Argon","Neon","Krypton"]'::jsonb, 2, 34),
    ('lewis_bonding', 'lewis-ionic-net-charge', 'The overall net charge of an ionic compound is:', '["Always positive","Always negative","Equal to the metal ion''s charge","Zero"]'::jsonb, 3, 35),
    ('lewis_bonding', 'lewis-formula-mgcl2', 'What is the formula of the ionic compound formed from Mg²⁺ and Cl⁻ ions?', '["MgCl","MgCl₂","Mg₂Cl","Mg₂Cl₃"]'::jsonb, 1, 36),
    ('lewis_bonding', 'lewis-formula-caf2', 'What is the formula of the ionic compound formed from calcium and fluorine?', '["CaF₂","CaF","Ca₂F","CaF₃"]'::jsonb, 0, 37),
    ('lewis_bonding', 'lewis-formula-al2o3', 'What is the formula of the ionic compound formed from Al³⁺ and O²⁻ ions?', '["AlO","Al₃O₂","AlO₃","Al₂O₃"]'::jsonb, 3, 38)
on conflict (quiz_key, question_key) do nothing;

commit;
