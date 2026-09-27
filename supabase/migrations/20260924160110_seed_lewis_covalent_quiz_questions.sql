-- Seed the Lewis Structures covalent compounds quiz questions.
-- Fundamentals and covalent questions are copied from the retired combined
-- lewis_bonding pool (same question keys), plus new covalent questions.
-- Safe to re-run: existing (quiz_key, question_key) rows are left alone.
-- Apply in Supabase: SQL Editor → New query → paste → Run
-- (Apply 20260924150000_quiz_questions.sql first.)

begin;

insert into public.quiz_questions
  (quiz_key, question_key, question, options, correct_index, order_index)
values
    ('lewis_covalent', 'lewis-valence-location', 'Valence electrons are the electrons located in an atom''s:', '["Outermost shell","Innermost shell","Nucleus","Second shell only"]'::jsonb, 0, 1),
    ('lewis_covalent', 'lewis-valence-nitrogen', 'How many valence electrons does a neutral nitrogen atom have?', '["3","5","7","2"]'::jsonb, 1, 2),
    ('lewis_covalent', 'lewis-valence-same-group', 'With the exception of helium, main-group elements in the same group (column) generally have the same number of:', '["Protons","Valence electrons","Neutrons","Electron shells"]'::jsonb, 1, 3),
    ('lewis_covalent', 'lewis-dots-show', 'A Lewis dot diagram shows which electrons around the symbol?', '["All of the atom''s electrons","Only the inner-shell electrons","Only the valence electrons","Only paired electrons"]'::jsonb, 2, 4),
    ('lewis_covalent', 'lewis-dot-placement', 'When drawing a Lewis dot diagram, where are the valence-electron dots placed?', '["Inside the element symbol","Around the four sides of the element symbol","Inside the nucleus","In numbered electron shells"]'::jsonb, 1, 5),
    ('lewis_covalent', 'lewis-dot-pairing', 'When drawing a Lewis dot diagram, what is generally done before electrons are paired on the same side?', '["One electron is placed on each available side","All electrons are placed on the same side","Two electrons are placed inside the symbol","The element''s protons are counted"]'::jsonb, 0, 6),
    ('lewis_covalent', 'lewis-dots-oxygen', 'How many dots appear around the symbol in the Lewis dot diagram for a neutral oxygen atom?', '["2","8","4","6"]'::jsonb, 3, 7),
    ('lewis_covalent', 'lewis-dots-carbon', 'How many dots appear around the symbol in the Lewis dot diagram for a neutral carbon atom?', '["4","6","2","12"]'::jsonb, 0, 8),
    ('lewis_covalent', 'lewis-octet-rule', 'The octet rule says that atoms tend to:', '["Gain, lose, or share electrons to have 8 valence electrons","Always have 8 protons","Lose all of their valence electrons","Keep exactly 8 electron shells"]'::jsonb, 0, 9),
    ('lewis_covalent', 'lewis-hydrogen-duet', 'When hydrogen forms a bond, how many electrons does it need in its outer shell to be stable?', '["8","1","2","4"]'::jsonb, 2, 10),
    ('lewis_covalent', 'lewis-covalent-definition', 'In a covalent bond, electrons are:', '["Transferred from one atom to another","Shared between atoms","Removed from both atoms","Moved into the nucleus"]'::jsonb, 1, 11),
    ('lewis_covalent', 'lewis-covalent-between', 'Covalent bonds most commonly form between:', '["Two nonmetals","A metal and a nonmetal","Two metals","Two noble gases"]'::jsonb, 0, 12),
    ('lewis_covalent', 'lewis-single-bond-electrons', 'A single covalent bond is made of how many shared electrons?', '["1","4","6","2"]'::jsonb, 3, 13),
    ('lewis_covalent', 'lewis-double-bond-electrons', 'A double covalent bond is made of how many shared electrons?', '["2","4","6","8"]'::jsonb, 1, 14),
    ('lewis_covalent', 'lewis-triple-bond-electrons', 'A triple covalent bond is made of how many shared electrons?', '["2","4","8","6"]'::jsonb, 3, 15),
    ('lewis_covalent', 'lewis-n2-bond', 'The two atoms in a nitrogen molecule (N₂) are joined by a:', '["Single bond","Double bond","Triple bond","Ionic bond"]'::jsonb, 2, 16),
    ('lewis_covalent', 'lewis-cl2-bond', 'The two atoms in a chlorine molecule (Cl₂) are joined by a:', '["Double bond","Single bond","Triple bond","Ionic bond"]'::jsonb, 1, 17),
    ('lewis_covalent', 'lewis-o2-bond', 'The two atoms in an oxygen molecule (O₂) are joined by a:', '["Single bond","Triple bond","Double bond","Ionic bond"]'::jsonb, 2, 18),
    ('lewis_covalent', 'lewis-co2-bonds', 'In carbon dioxide (CO₂), carbon is bonded to each oxygen atom by a:', '["Double bond","Single bond","Triple bond","Ionic bond"]'::jsonb, 0, 19),
    ('lewis_covalent', 'lewis-ch4-bonds', 'In methane (CH₄), how many single covalent bonds does the carbon atom form?', '["2","3","1","4"]'::jsonb, 3, 20),
    ('lewis_covalent', 'lewis-ccl4-bonds', 'In carbon tetrachloride (CCl₄), how many single covalent bonds does the carbon atom form?', '["2","4","3","1"]'::jsonb, 1, 21),
    ('lewis_covalent', 'lewis-hcl-bonds', 'In hydrogen chloride (HCl), the hydrogen and chlorine atoms are joined by a:', '["Single covalent bond","Double covalent bond","Ionic bond","Triple covalent bond"]'::jsonb, 0, 22),
    ('lewis_covalent', 'lewis-oxygen-bonds-formed', 'In most neutral molecules, how many shared electron pairs (covalent bonds) does an oxygen atom usually form? (A double bond counts as two.)', '["2","1","4","6"]'::jsonb, 0, 23),
    ('lewis_covalent', 'lewis-nitrogen-bonds-formed', 'In most neutral molecules, how many shared electron pairs (covalent bonds) does a nitrogen atom usually form? (A triple bond counts as three.)', '["1","5","3","4"]'::jsonb, 2, 24),
    ('lewis_covalent', 'lewis-lone-pair-definition', 'A lone pair in a Lewis structure is:', '["A pair of electrons shared between two atoms","A pair of valence electrons not involved in bonding","A single unpaired electron","A pair of protons in the nucleus"]'::jsonb, 1, 25),
    ('lewis_covalent', 'lewis-water-lone-pairs', 'In the Lewis structure of water (H₂O), how many lone pairs are on the oxygen atom?', '["0","1","2","4"]'::jsonb, 2, 26),
    ('lewis_covalent', 'lewis-ammonia-lone-pairs', 'In the Lewis structure of ammonia (NH₃), how many lone pairs are on the nitrogen atom?', '["1","0","2","3"]'::jsonb, 0, 27),
    ('lewis_covalent', 'lewis-hcl-lone-pairs', 'In the Lewis structure of hydrogen chloride (HCl), how many lone pairs are on the chlorine atom?', '["1","2","4","3"]'::jsonb, 3, 28)
on conflict (quiz_key, question_key) do nothing;

commit;
